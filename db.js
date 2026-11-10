// La.Koiff : base de données SQLite (intégrée à Node.js 22.13+, aucun module à compiler).
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const LK = require("./public/data.js");

/* Emplacement de la base. Chez Hostinger (formule Cloud), le dossier de l'application est remplacé à chaque
   déploiement : la base et les photos sont alors rangées dans le dossier personnel, qui, lui, est conservé. */
const ON_HOSTINGER = __dirname.includes(`${path.sep}hbuilds${path.sep}`);
const FILE = process.env.DB_FILE || (ON_HOSTINGER
  ? path.join(require("node:os").homedir(), "lakoiff-data", "lakoiff.db")
  : path.join(__dirname, "data", "lakoiff.db"));
fs.mkdirSync(path.dirname(FILE), { recursive: true });
/* Photos de profil des coiffeurs : rangées à côté de la base, pour être gardées avec elle */
const PHOTO_DIR = process.env.PHOTO_DIR || path.join(path.dirname(FILE), "photos-coiffeurs");
fs.mkdirSync(PHOTO_DIR, { recursive: true });
/* Réalisations d'exemple : photos ou illustrations des modèles du catalogue que le coiffeur propose */
function demoWorks(p) {
  const vm = require("node:vm"), ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "public", "art.js"), "utf8"), ctx);
  const models = LK.MODELS.filter(m => p.services[m.svc] != null).slice(0, 4);
  models.forEach((m, i) => {
    let file;
    if (m.photo) { file = `r-${p.id}-${i}.webp`; fs.copyFileSync(path.join(__dirname, "public", m.photo), path.join(PHOTO_DIR, file)); }
    else { file = `r-${p.id}-${i}.svg`; fs.writeFileSync(path.join(PHOTO_DIR, file), ctx.window.art(m).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ')); }
    db.prepare("INSERT INTO works (pro_id,file,service_id,created) VALUES (?,?,?,?)").run(p.id, file, m.svc, Date.now() - i * 864e5);
  });
}
/* Photo provisoire des coiffeurs d'exemple (initiales), à remplacer par une vraie photo */
function demoAvatar(p) {
  const ini = p.name.split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase();
  const file = `${p.id}-exemple.svg`;
  fs.writeFileSync(path.join(PHOTO_DIR, file), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.color}"/><stop offset="1" stop-color="#0A1222"/></linearGradient></defs><rect width="200" height="200" fill="url(#g)"/><circle cx="100" cy="82" r="38" fill="#fff" opacity=".18"/><path d="M30 200c6-44 36-64 70-64s64 20 70 64z" fill="#fff" opacity=".18"/><text x="100" y="118" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="64" fill="#fff">${ini}</text></svg>`);
  return file;
}
const db = new DatabaseSync(FILE);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

const SESSION_DAYS = 30;

function hashPin(pin, salt = crypto.randomBytes(16).toString("hex")) {
  return salt + ":" + crypto.scryptSync(String(pin), salt, 32).toString("hex");
}
function checkPin(pro, pin) { return checkHash(pro.pin_hash, pin); }
function checkHash(hash, pin) {
  if (!hash || !pin) return false;
  const [salt, h] = hash.split(":");
  const test = crypto.scryptSync(String(pin), salt, 32);
  return crypto.timingSafeEqual(test, Buffer.from(h, "hex"));
}

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pros (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT, color TEXT, base TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL, whatsapp TEXT NOT NULL, pin_hash TEXT,
      available INTEGER NOT NULL DEFAULT 1, verified INTEGER NOT NULL DEFAULT 1,
      services TEXT NOT NULL DEFAULT '{}', jobs INTEGER NOT NULL DEFAULT 0, since TEXT,
      lat REAL, lon REAL, loc_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, pro_id TEXT NOT NULL REFERENCES pros(id) ON DELETE CASCADE, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, token TEXT NOT NULL, created INTEGER NOT NULL, status TEXT NOT NULL,
      service_id TEXT NOT NULL, model_id TEXT, label TEXT NOT NULL, pro_id TEXT NOT NULL REFERENCES pros(id),
      client_name TEXT, client_phone TEXT NOT NULL, loc TEXT NOT NULL, when_at INTEGER,
      price INTEGER NOT NULL, fee INTEGER NOT NULL, km REAL NOT NULL, eta INTEGER NOT NULL, commission REAL NOT NULL,
      accepted_at INTEGER, depart_at INTEGER, arrive_at INTEGER, done_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS orders_pro ON orders(pro_id, created);
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, pro_id TEXT NOT NULL REFERENCES pros(id), created INTEGER NOT NULL,
      clients INTEGER NOT NULL, amount INTEGER NOT NULL, ref TEXT
    );
    CREATE TABLE IF NOT EXISTS candidatures (
      id INTEGER PRIMARY KEY AUTOINCREMENT, created INTEGER NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL,
      commune TEXT, kind TEXT, specialites TEXT, experience TEXT, message TEXT, status TEXT NOT NULL DEFAULT 'nouvelle'
    );
  `);
  // Mise à niveau : clients restants sur l'abonnement
  const addCol = (t, c, def) => { if (!db.prepare(`PRAGMA table_info(${t})`).all().some(x => x.name === c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`); };
  addCol("pros", "credits", "INTEGER NOT NULL DEFAULT 0");
  addCol("pros", "plan", "TEXT");                          // simple | pro
  addCol("pros", "plan_until", "INTEGER NOT NULL DEFAULT 0");
  addCol("pros", "plan_notice", "INTEGER NOT NULL DEFAULT 0"); // 1 = prévenu de la fin proche, 2 = prévenu de la fin
  addCol("subscriptions", "plan", "TEXT");
  addCol("subscriptions", "currency", "TEXT");
  addCol("orders", "client_id", "TEXT");
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL, created INTEGER NOT NULL, loc TEXT
    );
    CREATE TABLE IF NOT EXISTS client_sessions (token TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT NOT NULL, purpose TEXT NOT NULL, phone TEXT NOT NULL,
      code_hash TEXT NOT NULL, payload TEXT, expires INTEGER NOT NULL, tries INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS orders_client ON orders(client_id, created);
  `);
  // Connexion avec Google
  addCol("clients", "google_sub", "TEXT"); addCol("clients", "email", "TEXT");
  addCol("pros", "google_sub", "TEXT"); addCol("pros", "email", "TEXT");
  // Connexion avec Facebook
  addCol("clients", "facebook_id", "TEXT"); addCol("pros", "facebook_id", "TEXT");
  // Formule commission : montant dû à La.Koiff, et formule choisie à l'inscription
  addCol("pros", "commission_due", "INTEGER NOT NULL DEFAULT 0");
  addCol("pros", "wanted_plan", "TEXT");
  addCol("pros", "photo", "TEXT");   // nom du fichier de la photo de profil
  // Réalisations : photos des coiffures faites par le coiffeur
  db.exec("CREATE TABLE IF NOT EXISTS works (id INTEGER PRIMARY KEY AUTOINCREMENT, pro_id TEXT NOT NULL REFERENCES pros(id) ON DELETE CASCADE, file TEXT NOT NULL, service_id TEXT, created INTEGER NOT NULL)");
  db.exec("CREATE INDEX IF NOT EXISTS works_pro ON works(pro_id, created)");
  db.exec("CREATE TABLE IF NOT EXISTS commission_payments (id INTEGER PRIMARY KEY AUTOINCREMENT, pro_id TEXT NOT NULL REFERENCES pros(id), created INTEGER NOT NULL, amount INTEGER NOT NULL, ref TEXT)");
  // Premier démarrage : coiffeurs d'exemple (code de connexion 1234, à changer)
  if (db.prepare("SELECT COUNT(*) n FROM pros").get().n === 0 && process.env.SEED_DEMO !== "0") {
    const demoWa = String(process.env.DEMO_WHATSAPP || "").replace(/\D/g, "");
    const ins = db.prepare("INSERT INTO pros (id,name,kind,color,base,phone,whatsapp,pin_hash,available,services,jobs,since,credits,plan,plan_until) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    LK.PROS.forEach((p, i) => {
      const phone = "24381000000" + (i + 1);
      ins.run(p.id, p.name, p.kind, p.color, p.base, phone, demoWa || phone, hashPin("1234"), p.id === "yann" ? 0 : 1, JSON.stringify(p.services), p.jobs, p.since, p.id === "studio" ? 0 : LK.PLANS.simple.clients, p.id === "studio" ? "pro" : "simple", Date.now() + 30 * 864e5);
    });
    for (const p of LK.PROS) { db.prepare("UPDATE pros SET photo = ? WHERE id = ?").run(demoAvatar(p), p.id); demoWorks(p); }
    console.log("Coiffeurs d'exemple créés : numéros 0810000001 à 0810000005, code 1234.");
  }
  db.prepare("DELETE FROM sessions WHERE created < ?").run(Date.now() - SESSION_DAYS * 864e5);
}

const parsePro = r => r && { ...r, services: JSON.parse(r.services || "{}"), available: !!r.available };
const parseOrder = r => r && { ...r, loc: JSON.parse(r.loc) };

module.exports = {
  init, hashPin, checkPin,
  allPros: () => db.prepare("SELECT * FROM pros").all().map(parsePro),
  getPro: id => parsePro(db.prepare("SELECT * FROM pros WHERE id = ?").get(id)),
  proByPhone: phone => parsePro(db.prepare("SELECT * FROM pros WHERE phone = ?").get(phone)),
  proPrivate: p => ({ id: p.id, name: p.name, kind: p.kind, color: p.color, base: p.base, phone: p.phone, whatsapp: p.whatsapp, available: p.available, plan: p.plan, planUntil: p.plan_until, credits: p.credits, active: LK.planActive(p), commissionDue: p.commission_due || 0, photo: p.photo ? "/photos-coiffeurs/" + p.photo : null, works: module.exports.works(p.id), wantedPlan: p.wanted_plan || null, verified: !!p.verified, services: p.services, jobs: p.jobs, since: p.since }),
  addPro({ id, name, kind, color, base, phone, whatsapp, pin, passHash, services, verified = 1, available = 1 }) {
    db.prepare("INSERT INTO pros (id,name,kind,color,base,phone,whatsapp,pin_hash,services,jobs,since,verified,available) VALUES (?,?,?,?,?,?,?,?,?,0,?,?,?)")
      .run(id, name, kind || "Indépendant", color || "#2F5BD3", base, phone, whatsapp || phone, passHash || hashPin(pin), JSON.stringify(services || {}), String(new Date().getFullYear()), verified ? 1 : 0, available ? 1 : 0);
    return module.exports.getPro(id);
  },
  setPinHash: (id, h) => db.prepare("UPDATE pros SET pin_hash = ? WHERE id = ?").run(h, id),
  /* ---------- comptes clients ---------- */
  addClient({ id, name, phone, passHash, googleSub = null, facebookId = null, email = null }) {
    db.prepare("INSERT INTO clients (id,name,phone,pass_hash,created,google_sub,facebook_id,email) VALUES (?,?,?,?,?,?,?,?)").run(id, name, phone, passHash, Date.now(), googleSub, facebookId, email);
    return module.exports.getClient(id);
  },
  getClient: id => { const c = db.prepare("SELECT * FROM clients WHERE id = ?").get(id); return c && { ...c, loc: c.loc ? JSON.parse(c.loc) : null }; },
  clientByGoogle: sub => { const c = db.prepare("SELECT * FROM clients WHERE google_sub = ?").get(sub); return c && { ...c, loc: c.loc ? JSON.parse(c.loc) : null }; },
  proByGoogle: sub => parsePro(db.prepare("SELECT * FROM pros WHERE google_sub = ?").get(sub)),
  clientByFacebook: fid => { const c = db.prepare("SELECT * FROM clients WHERE facebook_id = ?").get(fid); return c && { ...c, loc: c.loc ? JSON.parse(c.loc) : null }; },
  proByFacebook: fid => parsePro(db.prepare("SELECT * FROM pros WHERE facebook_id = ?").get(fid)),
  setProFacebook: (id, fid, email) => db.prepare("UPDATE pros SET facebook_id = ?, email = COALESCE(?, email) WHERE id = ?").run(fid, email, id),
  setProGoogle: (id, sub, email) => db.prepare("UPDATE pros SET google_sub = ?, email = ? WHERE id = ?").run(sub, email, id),
  clientByPhone: phone => { const c = db.prepare("SELECT * FROM clients WHERE phone = ?").get(phone); return c && { ...c, loc: c.loc ? JSON.parse(c.loc) : null }; },
  clientPrivate: c => ({ id: c.id, name: c.name, phone: c.phone, loc: c.loc }),
  updateClient(id, patch) {
    const cols = Object.keys(patch); if (!cols.length) return module.exports.getClient(id);
    db.prepare(`UPDATE clients SET ${cols.map(c => c + " = ?").join(", ")} WHERE id = ?`).run(...cols.map(c => c === "loc" ? JSON.stringify(patch[c]) : patch[c]), id);
    return module.exports.getClient(id);
  },
  checkClientPass: (c, pass) => checkHash(c.pass_hash, pass),
  createClientSession(clientId) {
    const t = crypto.randomBytes(24).toString("base64url");
    db.prepare("INSERT INTO client_sessions VALUES (?,?,?)").run(t, clientId, Date.now()); return t;
  },
  deleteClientSession: t => db.prepare("DELETE FROM client_sessions WHERE token = ?").run(t),
  clientBySession(t) {
    const s = db.prepare("SELECT * FROM client_sessions WHERE token = ?").get(t);
    if (!s || s.created < Date.now() - SESSION_DAYS * 864e5) return null;
    return module.exports.getClient(s.client_id);
  },
  ordersForClient: id => db.prepare("SELECT * FROM orders WHERE client_id = ? ORDER BY created DESC LIMIT 30").all(id).map(parseOrder),
  /* ---------- codes de vérification (WhatsApp) ---------- */
  createCode(role, purpose, phone, code, payload) {
    db.prepare("DELETE FROM codes WHERE (role = ? AND purpose = ? AND phone = ?) OR expires < ?").run(role, purpose, phone, Date.now());
    db.prepare("INSERT INTO codes (role,purpose,phone,code_hash,payload,expires) VALUES (?,?,?,?,?,?)").run(role, purpose, phone, hashPin(code), JSON.stringify(payload || {}), Date.now() + 10 * 60e3);
  },
  /* Renvoie le contenu enregistré si le code est bon ; 5 essais maximum */
  useCode(role, purpose, phone, code) {
    const r = db.prepare("SELECT * FROM codes WHERE role = ? AND purpose = ? AND phone = ? AND expires > ? ORDER BY id DESC LIMIT 1").get(role, purpose, phone, Date.now());
    if (!r) return { error: "Code expiré. Demandez un nouveau code." };
    if (r.tries >= 5) return { error: "Trop d'essais. Demandez un nouveau code." };
    if (!checkHash(r.code_hash, String(code || "").trim())) { db.prepare("UPDATE codes SET tries = tries + 1 WHERE id = ?").run(r.id); return { error: "Code incorrect." }; }
    db.prepare("DELETE FROM codes WHERE id = ?").run(r.id);
    return { payload: JSON.parse(r.payload || "{}") };
  },
  updatePro(id, patch) {
    const cols = Object.keys(patch); if (!cols.length) return module.exports.getPro(id);
    const vals = cols.map(c => c === "services" ? JSON.stringify(patch[c]) : patch[c]);
    db.prepare(`UPDATE pros SET ${cols.map(c => c + " = ?").join(", ")} WHERE id = ?`).run(...vals, id);
    return module.exports.getPro(id);
  },
  setPin: (id, pin) => db.prepare("UPDATE pros SET pin_hash = ? WHERE id = ?").run(hashPin(pin), id),
  incJobs: id => db.prepare("UPDATE pros SET jobs = jobs + 1 WHERE id = ?").run(id),
  createSession(proId) {
    const t = crypto.randomBytes(24).toString("base64url");
    db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(t, proId, Date.now()); return t;
  },
  deleteSession: t => db.prepare("DELETE FROM sessions WHERE token = ?").run(t),
  proBySession(t) {
    const s = db.prepare("SELECT * FROM sessions WHERE token = ?").get(t);
    if (!s || s.created < Date.now() - SESSION_DAYS * 864e5) return null;
    return module.exports.getPro(s.pro_id);
  },
  createOrder(o) {
    const cols = Object.keys(o);
    db.prepare(`INSERT INTO orders (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(...cols.map(c => c === "loc" ? JSON.stringify(o.loc) : o[c]));
    return module.exports.getOrder(o.id);
  },
  getOrder: id => parseOrder(db.prepare("SELECT * FROM orders WHERE id = ?").get(String(id))),
  updateOrder(id, patch) {
    const cols = Object.keys(patch);
    db.prepare(`UPDATE orders SET ${cols.map(c => c + " = ?").join(", ")} WHERE id = ?`).run(...cols.map(c => patch[c]), id);
    return module.exports.getOrder(id);
  },
  ordersForPro: id => db.prepare("SELECT * FROM orders WHERE pro_id = ? AND (status IN ('sent','accepted','enroute','arrived') OR created > ?) ORDER BY created DESC LIMIT 50").all(id, Date.now() - 7 * 864e5).map(parseOrder),
  /* Active (ou prolonge) un abonnement après paiement. Même formule encore en cours : le mois s'ajoute à la suite. */
  activatePlan(proId, planId, months = 1, ref = "") {
    const pl = LK.PLANS[planId], p = module.exports.getPro(proId), now = Date.now();
    if (!pl || !p) return null;
    const same = p.plan === planId && (pl.guaranteed ? p.credits > 0 : p.plan_until > now);
    const until = (same ? p.plan_until : now) + pl.days * 864e5 * months;
    const credits = pl.clients == null ? 0 : (same ? p.credits : 0) + pl.clients * months;
    db.prepare("UPDATE pros SET plan = ?, plan_until = ?, credits = ?, plan_notice = 0 WHERE id = ?").run(planId, until, credits, proId);
    db.prepare("INSERT INTO subscriptions (pro_id,created,clients,amount,ref,plan,currency) VALUES (?,?,?,?,?,?,?)")
      .run(proId, now, pl.clients == null ? -1 : pl.clients * months, pl.price * months, ref, planId, pl.currency);
    return module.exports.getPro(proId);
  },
  /* Accepter un client : vérifie l'abonnement et, pour Simple, utilise une place */
  /* Formule commission : le coiffeur la choisit lui-même, sans paiement d'avance */
  setCommissionPlan(id) { db.prepare("UPDATE pros SET plan = 'commission', plan_until = 0, credits = 0, plan_notice = 0 WHERE id = ?").run(id); return module.exports.getPro(id); },
  addCommissionDue: (id, amount) => db.prepare("UPDATE pros SET commission_due = commission_due + ? WHERE id = ?").run(Math.round(amount), id),
  payCommission(id, amount, ref = "") {
    db.prepare("INSERT INTO commission_payments (pro_id,created,amount,ref) VALUES (?,?,?,?)").run(id, Date.now(), Math.round(amount), ref);
    db.prepare("UPDATE pros SET commission_due = MAX(0, commission_due - ?) WHERE id = ?").run(Math.round(amount), id);
    return module.exports.getPro(id);
  },
  listCommissionPayments: id => db.prepare("SELECT * FROM commission_payments WHERE pro_id = ? ORDER BY created DESC").all(id),
  /* Enregistre une nouvelle photo de profil et supprime l'ancienne */
  setProPhoto(id, buffer, ext) {
    const old = module.exports.getPro(id)?.photo;
    const file = `${id}-${crypto.randomBytes(5).toString("hex")}.${ext}`;
    fs.writeFileSync(path.join(PHOTO_DIR, file), buffer);
    db.prepare("UPDATE pros SET photo = ? WHERE id = ?").run(file, id);
    if (old) fs.rm(path.join(PHOTO_DIR, path.basename(old)), () => {});
    return module.exports.getPro(id);
  },
  PHOTO_DIR,
  /* ---------- réalisations ---------- */
  works: proId => db.prepare("SELECT * FROM works WHERE pro_id = ? ORDER BY created DESC").all(proId)
    .map(w => ({ id: w.id, url: "/photos-coiffeurs/" + w.file, serviceId: w.service_id })),
  workCount: proId => db.prepare("SELECT COUNT(*) n FROM works WHERE pro_id = ?").get(proId).n,
  addWork(proId, buffer, ext, serviceId) {
    const file = `r-${proId}-${crypto.randomBytes(5).toString("hex")}.${ext}`;
    fs.writeFileSync(path.join(PHOTO_DIR, file), buffer);
    db.prepare("INSERT INTO works (pro_id,file,service_id,created) VALUES (?,?,?,?)").run(proId, file, serviceId || null, Date.now());
  },
  deleteWork(proId, id) {
    const w = db.prepare("SELECT * FROM works WHERE id = ? AND pro_id = ?").get(id, proId);
    if (!w) return false;
    db.prepare("DELETE FROM works WHERE id = ?").run(id);
    fs.rm(path.join(PHOTO_DIR, path.basename(w.file)), () => {});
    return true;
  },
  setWantedPlan: (id, plan) => db.prepare("UPDATE pros SET wanted_plan = ? WHERE id = ?").run(plan, id),
  useCredit(id) {
    const p = module.exports.getPro(id); if (!p || !LK.planActive(p)) return false;
    if (LK.PLANS[p.plan].clients == null) return true;
    return db.prepare("UPDATE pros SET credits = credits - 1 WHERE id = ? AND credits > 0").run(id).changes === 1;
  },
  refundCredit(id) {
    const p = module.exports.getPro(id);
    if (p && LK.PLANS[p.plan]?.clients != null) db.prepare("UPDATE pros SET credits = credits + 1 WHERE id = ?").run(id);
  },
  setPlanNotice: (id, n) => db.prepare("UPDATE pros SET plan_notice = ? WHERE id = ?").run(n, id),
  listSubscriptions: proId => db.prepare("SELECT * FROM subscriptions WHERE pro_id = ? ORDER BY created DESC").all(proId),
  addCandidature: c => db.prepare("INSERT INTO candidatures (created,name,phone,commune,kind,specialites,experience,message) VALUES (?,?,?,?,?,?,?,?)").run(Date.now(), c.name, c.phone, c.commune, c.kind, c.specialites, c.experience, c.message),
  /* ---------- administration ---------- */
  stats: () => ({
    clients: db.prepare("SELECT COUNT(*) n FROM clients").get().n,
    pros: db.prepare("SELECT COUNT(*) n FROM pros").get().n,
    pending: db.prepare("SELECT COUNT(*) n FROM pros WHERE verified = 0").get().n,
    ordersToday: db.prepare("SELECT COUNT(*) n FROM orders WHERE created > ?").get(Date.now() - 864e5).n,
    ordersDone: db.prepare("SELECT COUNT(*) n FROM orders WHERE status = 'done'").get().n,
    commissionsDue: db.prepare("SELECT COALESCE(SUM(commission_due),0) n FROM pros").get().n
  }),
  doneCount: id => db.prepare("SELECT COUNT(*) n FROM orders WHERE pro_id = ? AND status = 'done'").get(id).n,
  listCandidatures: () => db.prepare("SELECT * FROM candidatures ORDER BY created DESC").all(),
  latestPendingForWhatsApp: wa => parseOrder(db.prepare("SELECT o.* FROM orders o JOIN pros p ON p.id = o.pro_id WHERE p.whatsapp = ? AND o.status = 'sent' ORDER BY o.created DESC LIMIT 1").get(wa))
};
