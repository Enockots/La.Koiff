// La.Koiff : serveur de l'application (API, temps réel, WhatsApp).
// Démarrage : npm start   (voir README.md)
require("dotenv").config();
const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const LK = require("./public/data.js");
const db = require("./db");
const wa = require("./whatsapp");

const PORT = process.env.PORT || 3000;
const CONTACT = String(process.env.CONTACT_WHATSAPP || process.env.DEMO_WHATSAPP || "").replace(/\D/g, "");
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const app = express();
app.set("trust proxy", 1);
/* Une seule adresse : www.domaine renvoie vers domaine (Hostinger lance un programme séparé pour chacun,
   et le suivi en direct ne fonctionne qu'entre visiteurs du même programme). */
const CANON = (() => { try { return new URL(process.env.BASE_URL || "").hostname; } catch { return ""; } })();
app.use((req, res, next) => {
  if (CANON && req.hostname && req.hostname !== CANON && req.hostname === "www." + CANON && req.method === "GET")
    return res.redirect(301, `https://${CANON}${req.originalUrl}`);
  next();
});
/* Rappels d'abonnement : vérifiés au plus une fois par heure, à l'arrivée d'un visiteur
   (les hébergements mutualisés n'assurent pas les minuteries qui tournent en permanence). */
let lastPlanCheck = 0;
app.use((req, res, next) => {
  if (Date.now() - lastPlanCheck > 3600e3) { lastPlanCheck = Date.now(); setImmediate(() => checkPlans().catch(e => console.error(e.message))); }
  next();
});
app.disable("x-powered-by");

/* ---------- utilitaires ---------- */
const now = () => Date.now();
const newId = (n = 8) => crypto.randomBytes(n).toString("base64url");
const clean = (v, max = 120) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const fmtFC = n => Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ") + " FC";
/* Numéro RDC au format international sans "+" : 0859204238 -> 243859204238 */
function normPhone(p) {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("0")) d = "243" + d.slice(1);
  if (d.length === 9) d = "243" + d;
  return d.length >= 11 && d.length <= 15 ? d : null;
}
const svc = id => LK.SERVICES.find(s => s.id === id);
const mdl = id => LK.MODELS.find(m => m.id === id);
const STATUS_TXT = {
  accepted: "votre coiffeur a accepté la demande",
  refused: "votre coiffeur n'est pas disponible, choisissez-en un autre",
  enroute: "votre coiffeur est en route",
  arrived: "votre coiffeur est arrivé à votre porte",
  done: "prestation terminée, merci d'avoir choisi La.Koiff",
  noshow: "votre coiffeur est venu mais ne vous a pas trouvé, la commande est annulée. Repassez commande quand vous êtes disponible"
};

/* Limite simple d'appels par adresse IP */
const hits = new Map();
function limit(key, max, windowMs) {
  return (req, res, next) => {
    const k = key + ":" + req.ip, t = now();
    const list = (hits.get(k) || []).filter(x => t - x < windowMs);
    if (list.length >= max) return res.status(429).json({ error: "Trop de demandes. Réessayez dans quelques minutes." });
    list.push(t); hits.set(k, list); next();
  };
}

/* ---------- temps réel (Server-Sent Events) ---------- */
const streams = { order: new Map(), pro: new Map() };
function subscribe(kind, id, req, res) {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.write("retry: 2000\n\n");
  const set = streams[kind].get(id) || new Set(); set.add(res); streams[kind].set(id, set);
  const ping = setInterval(() => res.write(": ping\n\n"), 25000);
  // Certains hébergeurs (Hostinger : 120 s) coupent les connexions longues : on la ferme proprement avant,
  // le navigateur se reconnecte tout seul et reçoit l'état à jour.
  const cut = setTimeout(() => res.end(), +process.env.SSE_MAX_MS || 100000);
  req.on("close", () => { clearInterval(ping); clearTimeout(cut); set.delete(res); if (!set.size) streams[kind].delete(id); });
}
function push(kind, id, data) {
  const set = streams[kind].get(id); if (!set) return;
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of set) res.write(msg);
}

/* ---------- vues publiques ---------- */
/* Un coiffeur apparaît aux clients s'il est disponible, vérifié, avec une formule active et une photo de profil */
const visible = p => p.available && p.verified && LK.planActive(p) && !!p.photo && db.workCount(p.id) >= LK.WORKS.min;
const photoUrl = p => p.photo ? "/photos-coiffeurs/" + p.photo : null;
function publicPro(p, loc, serviceId) {
  const km = loc ? LK.distanceKm(p.id, p.base, loc) : null;
  return {
    id: p.id, name: p.name, kind: p.kind, color: p.color, photo: photoUrl(p), works: db.works(p.id).slice(0, LK.WORKS.max), jobs: p.jobs, since: p.since, verified: !!p.verified,
    price: serviceId ? LK.priceFor(p, serviceId) : undefined,
    km, fee: km != null ? LK.travelFee(km) : null, eta: km != null ? LK.etaFor(km) : null
  };
}
function publicOrder(o, forPro = false) {
  const p = db.getPro(o.pro_id);
  const out = {
    id: o.id, status: o.status, created: o.created, label: o.label, serviceId: o.service_id, modelId: o.model_id,
    when: o.when_at, price: o.price, fee: o.fee, km: o.km, eta: o.eta, loc: o.loc,
    acceptedAt: o.accepted_at, departAt: o.depart_at, arriveAt: o.arrive_at, doneAt: o.done_at,
    pro: p ? { id: p.id, name: p.name, color: p.color, photo: photoUrl(p), kind: p.kind, base: p.base, whatsapp: p.whatsapp, pos: p.lat != null && o.status === "enroute" ? { lat: p.lat, lon: p.lon, at: p.loc_at } : null } : null
  };
  if (forPro) { out.client = { name: o.client_name, phone: o.client_phone }; out.net = Math.round(o.price * (1 - (o.commission || 0)) + o.fee); out.commissionAmount = Math.round(o.price * (o.commission || 0)); }
  return out;
}
function broadcastOrder(o) {
  push("order", o.id, { type: "order", order: publicOrder(o) });
  push("pro", o.pro_id, { type: "order", order: publicOrder(o, true) });
}

/* ---------- WhatsApp : notifications ---------- */
async function notifyNewOrder(o) {
  const p = db.getPro(o.pro_id);
  const net = Math.round(o.price * (1 - (o.commission || 0)) + o.fee);
  const where = `${o.loc.avenue}, ${o.loc.quartier ? o.loc.quartier + ", " : ""}${o.loc.commune}${o.loc.repere ? " (repère : " + o.loc.repere + ")" : ""}`;
  const when = o.when_at ? new Date(o.when_at).toLocaleString("fr-FR", { timeZone: "Africa/Kinshasa", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "dès que possible";
  await wa.sendTemplate(p.whatsapp, "lk_nouvelle_demande", [o.label, where, when, fmtFC(net), `${BASE_URL}/pro.html`]);
  await wa.sendTemplate(o.client_phone, "lk_confirmation", [o.client_name || "cher client", o.label, p.name, fmtFC(o.price + o.fee), `${BASE_URL}/app.html#suivi-${o.id}.${o.token}`]);
}
async function notifyStatus(o) {
  if (!STATUS_TXT[o.status]) return;
  await wa.sendTemplate(o.client_phone, "lk_statut", [STATUS_TXT[o.status], `${BASE_URL}/app.html#suivi-${o.id}.${o.token}`]);
}

/* Abonnements : textes et rappels WhatsApp */
const planTxt = pl => { return pl.rate != null ? `${pl.name} : ${Math.round(pl.rate * 100)} % par prestation, sans abonnement` : `${pl.name} : ${pl.currency === "USD" ? pl.price + " $ par mois, clients illimités" : fmtFC(pl.price) + " pour " + pl.clients + " clients garantis"}`; };
const renewTxt = () => `Renouvelez par ${LK.PAYMENT.payMethods} au ${LK.PAYMENT.payTo} (${planTxt(LK.PLANS.simple)} ; ${planTxt(LK.PLANS.pro)}), ou choisissez ${planTxt(LK.PLANS.commission)} dans votre espace`;
const dateTxt = t => new Date(t).toLocaleDateString("fr-FR", { timeZone: "Africa/Kinshasa", day: "numeric", month: "long" });
async function notifyPlan(proId, status) {
  const p = db.getPro(proId), pl = LK.PLANS[p.plan];
  if (!pl || pl.clients == null) return;
  let msg = null;
  if (status === "accepted" && p.credits === 1) msg = "il vous reste 1 client sur votre abonnement La.Koiff Simple";
  // Les 4 clients sont reçus quand la dernière prestation est terminée (plus de place, plus de course en cours)
  if (status === "done" && p.credits === 0 && !db.ordersForPro(proId).some(o => ["accepted", "enroute", "arrived"].includes(o.status)))
    msg = `vous avez reçu vos ${pl.clients} clients de La.Koiff Simple, vous n'apparaissez plus aux clients. ${renewTxt()}`;
  if (msg) await wa.sendTemplate(p.whatsapp, "lk_abonnement", [msg, `${BASE_URL}/pro.html`]);
}
/* Formule commission : rappel quand le montant dû approche de la limite, puis suspension */
async function notifyCommission(proId, before = 0) {
  const p = db.getPro(proId), C = LK.PLANS.commission;
  if (p.plan !== "commission") return;
  const due = p.commission_due, howTo = `Payez par ${LK.PAYMENT.payMethods} au ${LK.PAYMENT.payTo}`;
  let msg = null;
  // un seul message par seuil franchi (80 % de la limite, puis la limite)
  if (due >= C.limit && before < C.limit) msg = `vos commissions dues atteignent ${fmtFC(due)} : votre profil est suspendu jusqu'au paiement. ${howTo}`;
  else if (due >= C.limit * 0.8 && before < C.limit * 0.8) msg = `vos commissions dues sont de ${fmtFC(due)}. Au-delà de ${fmtFC(C.limit)}, votre profil est suspendu. ${howTo}`;
  if (msg) await wa.sendTemplate(p.whatsapp, "lk_abonnement", [msg, `${BASE_URL}/pro.html`]);
}
/* Toutes les heures : prévient 3 jours avant la fin du mois d'abonnement, puis à la fin */
async function checkPlans() {
  const t = now();
  for (const p of db.allPros()) {
    if (!p.plan || LK.PLANS[p.plan]?.guaranteed || LK.PLANS[p.plan]?.rate != null) continue;   // Simple : pas de date limite
    if (p.plan_until > t && p.plan_until - t < 3 * 864e5 && p.plan_notice < 1) {
      db.setPlanNotice(p.id, 1);
      await wa.sendTemplate(p.whatsapp, "lk_abonnement", [`votre abonnement ${LK.PLANS[p.plan].name} se termine le ${dateTxt(p.plan_until)}. ${renewTxt()}`, `${BASE_URL}/pro.html`]).catch(e => console.error("WhatsApp :", e.message));
    } else if (p.plan_until <= t && p.plan_notice < 2) {
      db.setPlanNotice(p.id, 2);
      push("pro", p.id, { type: "pro", pro: db.proPrivate(p) });
      await wa.sendTemplate(p.whatsapp, "lk_abonnement", [`votre abonnement ${LK.PLANS[p.plan].name} est terminé, vous n'apparaissez plus aux clients. ${renewTxt()}`, `${BASE_URL}/pro.html`]).catch(e => console.error("WhatsApp :", e.message));
    }
  }
}

/* ---------- changement de statut (règles) ---------- */
const NEXT = { sent: ["accepted", "refused", "cancelled"], accepted: ["enroute", "cancelled"], enroute: ["arrived"], arrived: ["done", "noshow"] };
function setStatus(o, status) {
  if (!(NEXT[o.status] || []).includes(status)) return { error: "Action impossible à ce stade de la commande." };
  // Abonnement : accepter un client utilise une place ; une annulation après acceptation la rend
  if (status === "accepted" && !db.useCredit(o.pro_id)) return { error: `Votre abonnement est terminé ou épuisé. ${renewTxt()}.` };
  // Une place n'est perdue que pour une prestation réellement faite : client qui annule ou client absent = place rendue
  if ((status === "cancelled" && o.status === "accepted") || status === "noshow") db.refundCredit(o.pro_id);
  const col = { accepted: "accepted_at", enroute: "depart_at", arrived: "arrive_at", done: "done_at" }[status];
  const upd = db.updateOrder(o.id, { status, ...(col ? { [col]: now() } : {}) });
  if (status === "done") db.incJobs(o.pro_id);
  // Formule commission : la part de La.Koiff est due une fois la prestation réalisée
  if (status === "done" && o.commission > 0) { const before = db.getPro(o.pro_id).commission_due; db.addCommissionDue(o.pro_id, o.price * o.commission); notifyCommission(o.pro_id, before).catch(e => console.error("WhatsApp :", e.message)); }
  if (["accepted", "done"].includes(status)) notifyPlan(o.pro_id, status).catch(e => console.error("WhatsApp :", e.message));
  if (["accepted", "cancelled", "noshow", "done"].includes(status)) { const p = db.getPro(o.pro_id); push("pro", p.id, { type: "pro", pro: db.proPrivate(p) }); }
  broadcastOrder(upd);
  notifyStatus(upd).catch(e => console.error("WhatsApp :", e.message));
  return { order: upd };
}

/* ---------- auth coiffeur ---------- */
function proAuth(req, res, next) {
  const t = (req.get("authorization") || "").replace(/^Bearer\s+/i, "") || req.query.t;
  const pro = t && db.proBySession(t);
  if (!pro) return res.status(401).json({ error: "Session expirée. Reconnectez-vous." });
  req.pro = pro; next();
}

/* ===================== ROUTES ===================== */
app.post("/webhook", express.raw({ type: "*/*", limit: "1mb" }), (req, res) => {
  if (!wa.checkSignature(req.body, req.get("x-hub-signature-256"))) return res.sendStatus(401);
  res.sendStatus(200);
  let body; try { body = JSON.parse(req.body.toString("utf8")); } catch { return; }
  for (const msg of wa.incomingMessages(body)) handleWhatsAppReply(msg).catch(e => console.error("Webhook :", e.message));
});
app.get("/webhook", (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === process.env.WHATSAPP_VERIFY_TOKEN) return res.send(req.query["hub.challenge"]);
  res.sendStatus(403);
});
/* Le coiffeur répond OUI ou NON sur WhatsApp */
async function handleWhatsAppReply({ from, text }) {
  const answer = text.trim().toLowerCase();
  const yes = /^(oui|ok|d'accord|accepter|1)\b/.test(answer), no = /^(non|refuser|2)\b/.test(answer);
  if (!yes && !no) return;
  const o = db.latestPendingForWhatsApp(from);
  if (!o) return wa.sendText(from, "La.Koiff : aucune demande en attente pour vous.");
  const r = setStatus(o, yes ? "accepted" : "refused");
  if (r.error) return wa.sendText(from, "La.Koiff : " + r.error);
  await wa.sendText(from, yes ? `La.Koiff : demande acceptée (${o.label}). Ouvrez votre espace pour lancer le trajet : ${BASE_URL}/pro.html` : "La.Koiff : demande refusée. Le client va choisir un autre coiffeur.");
}

/* Photo de profil du coiffeur : image envoyée par l'appli (déjà réduite), vérifiée puis enregistrée */
/* Image envoyée par l'appli (déjà réduite) : vérifiée avant d'être enregistrée */
function readImage(body) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(body?.image || ""));
  if (!m) return { error: "Choisissez une photo (JPG, PNG ou WebP)." };
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 2 * 1024 * 1024) return { error: "Photo trop lourde (2 Mo maximum)." };
  // vérifie que le fichier est vraiment une image du bon type
  const sig = { jpeg: [0xFF, 0xD8, 0xFF], png: [0x89, 0x50, 0x4E, 0x47], webp: [0x52, 0x49, 0x46, 0x46] }[m[1]];
  if (!sig.every((b, i) => buf[i] === b)) return { error: "Ce fichier n'est pas une image valide." };
  return { buf, ext: m[1] === "jpeg" ? "jpg" : m[1] };
}
/* Réalisations du coiffeur : ajout et suppression */
app.post("/api/pro/works", express.json({ limit: "3mb" }), proAuth, limit("works", 60, 3600e3), (req, res) => {
  const img = readImage(req.body); if (img.error) return res.status(400).json(img);
  if (db.workCount(req.pro.id) >= LK.WORKS.max) return res.status(400).json({ error: `Vous avez déjà ${LK.WORKS.max} réalisations. Supprimez-en une pour en ajouter une autre.` });
  const sid = svc(clean(req.body?.serviceId, 20)) ? clean(req.body.serviceId, 20) : null;
  db.addWork(req.pro.id, img.buf, img.ext, sid);
  const p = db.getPro(req.pro.id); push("pro", p.id, { type: "pro", pro: db.proPrivate(p) });
  res.status(201).json({ pro: db.proPrivate(p) });
});
app.delete("/api/pro/works/:id", proAuth, (req, res) => {
  if (!db.deleteWork(req.pro.id, +req.params.id)) return res.status(404).json({ error: "Photo introuvable." });
  res.json({ pro: db.proPrivate(db.getPro(req.pro.id)) });
});
app.post("/api/pro/photo", express.json({ limit: "3mb" }), proAuth, limit("photo", 20, 3600e3), (req, res) => {
  const img = readImage(req.body); if (img.error) return res.status(400).json(img);
  const p = db.setProPhoto(req.pro.id, img.buf, img.ext);
  push("pro", p.id, { type: "pro", pro: db.proPrivate(p) });
  res.json({ pro: db.proPrivate(p) });
});
app.use(express.json({ limit: "20kb" }));

app.get("/api/config", (req, res) => res.json({ usdRate: LK.USD_RATE, whatsapp: wa.enabled, contact: CONTACT }));

/* Candidature « Devenir coiffeur La.Koiff » */
app.post("/api/candidatures", limit("cand", 5, 3600e3), (req, res) => {
  const b = req.body || {};
  if (clean(b.website)) return res.status(201).json({ ok: true });          // piège à robots
  const name = clean(b.name, 60), phone = normPhone(b.phone), commune = clean(b.commune, 40);
  if (!name) return res.status(400).json({ error: "Indiquez votre nom." });
  if (!phone) return res.status(400).json({ error: "Indiquez un numéro WhatsApp valide, par exemple 0859 204 238." });
  if (!LK.COMMUNES[commune]) return res.status(400).json({ error: "Choisissez votre commune." });
  const c = { name, phone, commune, kind: clean(b.kind, 40), specialites: clean([].concat(b.specialites || []).join(", "), 300), experience: clean(b.experience, 40), message: clean(b.message, 600) };
  db.addCandidature(c);
  if (CONTACT) wa.sendTemplate(CONTACT, "lk_candidature", [c.name, "+" + c.phone, c.commune, c.specialites || "non précisé", c.experience || "non précisé"]).catch(e => console.error("WhatsApp :", e.message));
  console.log(`Nouvelle candidature : ${c.name} (+${c.phone}, ${c.commune})`);
  res.status(201).json({ ok: true });
});

/* Coiffeurs disponibles pour un service, triés par heure d'arrivée */
app.get("/api/pros", (req, res) => {
  const serviceId = clean(req.query.service, 20), commune = clean(req.query.commune, 40);
  if (!svc(serviceId) || !LK.COMMUNES[commune]) return res.status(400).json({ error: "Service ou commune inconnu." });
  const lat = req.query.lat ? +req.query.lat : null, lon = req.query.lon ? +req.query.lon : null;
  const loc = { commune, lat: Number.isFinite(lat) ? lat : null, lon: Number.isFinite(lon) ? lon : null };
  const list = db.allPros().filter(p => visible(p) && p.services[serviceId] != null)
    .map(p => ({ ...publicPro(p, loc, serviceId), _wait: LK.PLANS[p.plan]?.guaranteed ? 1 : 0 })).filter(p => p.km <= LK.MAX_KM)
    // Par tranche de 10 min d'arrivée, les coiffeurs Simple qui attendent encore leurs clients passent devant
    .sort((a, b) => Math.floor(a.eta / 10) - Math.floor(b.eta / 10) || b._wait - a._wait || a.eta - b.eta)
    .map(({ _wait, ...p }) => p);
  res.json({ pros: list });
});
/* Prix de départ par service (pour le catalogue) */
app.get("/api/prices", (req, res) => {
  const out = {};
  for (const p of db.allPros()) if (visible(p)) for (const k of Object.keys(p.services)) out[k] = Math.min(out[k] ?? Infinity, LK.priceFor(p, k));
  res.json({ from: out });
});

/* Création d'une commande par le client */
app.post("/api/orders", limit("order", 12, 3600e3), (req, res) => {
  const b = req.body || {};
  const s = svc(clean(b.serviceId, 20)), p = db.getPro(clean(b.proId, 20));
  if (!s || !p || !visible(p) || p.services[s.id] == null) return res.status(400).json({ error: "Ce coiffeur n'est plus disponible pour ce service. Choisissez-en un autre." });
  const account = clientFromReq(req);
  if (!account) return res.status(401).json({ error: "Créez un compte ou connectez-vous pour commander.", needAccount: true });
  const phone = account.phone;
  if (!phone) return res.status(400).json({ error: "Indiquez un numéro WhatsApp valide, par exemple 0859 204 238." });
  const l = b.loc || {};
  const commune = clean(l.commune, 40);
  if (!LK.COMMUNES[commune]) return res.status(400).json({ error: "Choisissez votre commune." });
  const loc = {
    commune, quartier: clean(l.quartier, 80), avenue: clean(l.avenue, 120), repere: clean(l.repere, 200),
    lat: Number.isFinite(+l.lat) && l.lat !== null ? +l.lat : null, lon: Number.isFinite(+l.lon) && l.lon !== null ? +l.lon : null
  };
  if (!loc.avenue) return res.status(400).json({ error: "Indiquez l'avenue et le numéro pour que le coiffeur vous trouve." });
  let when = null;
  if (b.when) { when = Date.parse(b.when); if (!Number.isFinite(when) || when < now() - 5 * 60e3) return res.status(400).json({ error: "Choisissez une date de rendez-vous à venir." }); }
  const km = LK.distanceKm(p.id, p.base, loc);
  if (km > LK.MAX_KM) return res.status(400).json({ error: "Ce coiffeur est trop loin de votre adresse." });
  const m = mdl(clean(b.modelId, 20));
  const o = db.createOrder({
    id: newId(6), token: newId(12), created: now(), status: "sent", service_id: s.id, model_id: m && m.svc === s.id ? m.id : null,
    label: m && m.svc === s.id ? m.name : s.name, pro_id: p.id, client_id: account?.id || null, client_name: clean(b.client?.name, 60) || account?.name || "", client_phone: phone,
    loc, when_at: when, price: LK.priceFor(p, s.id), fee: LK.travelFee(km), km, eta: LK.etaFor(km), commission: p.plan === "commission" ? LK.PLANS.commission.rate : 0
  });
  push("pro", p.id, { type: "new", order: publicOrder(o, true) });
  notifyNewOrder(o).catch(e => console.error("WhatsApp :", e.message));
  res.status(201).json({ order: publicOrder(o), token: o.token });
});
/* Suivi client (protégé par le jeton reçu à la commande) */
function clientOrder(req, res) {
  const o = db.getOrder(req.params.id);
  if (!o || !crypto.timingSafeEqual(Buffer.from(String(req.query.token || "").padEnd(16).slice(0, 16)), Buffer.from(o.token.padEnd(16).slice(0, 16)))) { res.status(404).json({ error: "Commande introuvable." }); return null; }
  return o;
}
app.get("/api/orders/:id", (req, res) => { const o = clientOrder(req, res); if (o) res.json({ order: publicOrder(o) }); });
app.get("/api/orders/:id/stream", (req, res) => { const o = clientOrder(req, res); if (!o) return; subscribe("order", o.id, req, res); res.write(`data: ${JSON.stringify({ type: "order", order: publicOrder(o) })}\n\n`); });
app.post("/api/orders/:id/cancel", (req, res) => { const o = clientOrder(req, res); if (!o) return; const r = setStatus(o, "cancelled"); if (r.error) return res.status(409).json(r); res.json({ order: publicOrder(r.order) }); });


/* ===================== COMPTES (clients et coiffeurs) ===================== */
/* Vérification du numéro par un code WhatsApp : activée dès que WhatsApp est branché (ou forcée avec VERIFY_PHONE=1) */
const VERIFY = process.env.VERIFY_PHONE ? process.env.VERIFY_PHONE === "1" : wa.enabled;
const newCode = () => String(crypto.randomInt(0, 1e6)).padStart(6, "0");
function passError(pw) { return String(pw || "").length < 6 ? "Choisissez un mot de passe d'au moins 6 caractères." : null; }
async function sendCode(role, purpose, phone, payload) {
  const code = newCode();
  db.createCode(role, purpose, phone, code, payload);
  if (wa.enabled) await wa.sendAuthCode(phone, code);
  else console.log(`[Code de vérification] ${role} ${purpose} +${phone} : ${code}`);
}
function clientFromReq(req) {
  const t = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return t ? db.clientBySession(t) : null;
}
function clientAuth(req, res, next) {
  const c = clientFromReq(req);
  if (!c) return res.status(401).json({ error: "Session expirée. Reconnectez-vous." });
  req.client = c; next();
}
const signupLimit = limit("signup", 8, 3600e3), codeLimit = limit("code", 15, 3600e3);

/* ---- Compte client ---- */
function createClientAccount(name, phone, passHash, g = {}) {
  if (db.clientByPhone(phone) || (g.googleSub && db.clientByGoogle(g.googleSub)) || (g.facebookId && db.clientByFacebook(g.facebookId))) return null;
  const c = db.addClient({ id: newId(8), name, phone, passHash, googleSub: g.googleSub || null, facebookId: g.facebookId || null, email: g.email || null });
  return { token: db.createClientSession(c.id), client: db.clientPrivate(c) };
}
app.post("/api/client/signup", signupLimit, async (req, res) => {
  const b = req.body || {}, name = clean(b.name, 60), phone = normPhone(b.phone);
  if (!name) return res.status(400).json({ error: "Indiquez votre prénom." });
  if (!phone) return res.status(400).json({ error: "Indiquez un numéro WhatsApp valide, par exemple 0859 204 238." });
  const g = googlePending(b.google);
  if (b.google && !g) return res.status(400).json({ error: "La connexion a expiré. Recommencez avec le bouton Google ou Facebook." });
  const pe = g ? null : passError(b.password); if (pe) return res.status(400).json({ error: pe });
  if (db.clientByPhone(phone)) return res.status(409).json({ error: "Un compte existe déjà avec ce numéro. Connectez-vous avec votre mot de passe." });
  const passHash = db.hashPin(g ? crypto.randomBytes(18).toString("hex") : b.password);
  const gx = socialFields(g);
  if (!VERIFY) { if (g) pendingGoogle.delete(b.google); return res.status(201).json(createClientAccount(name, phone, passHash, gx)); }
  try { await sendCode("client", "signup", phone, { name, passHash, ...gx }); } catch (e) { console.error("WhatsApp :", e.message); return res.status(502).json({ error: "Le code n'a pas pu être envoyé sur WhatsApp. Vérifiez le numéro et réessayez." }); }
  res.json({ needCode: true });
});
app.post("/api/client/verify", codeLimit, (req, res) => {
  const phone = normPhone(req.body?.phone), r = phone ? db.useCode("client", "signup", phone, req.body?.code) : { error: "Numéro invalide." };
  if (r.error) return res.status(400).json(r);
  const out = createClientAccount(r.payload.name, phone, r.payload.passHash, { googleSub: r.payload.googleSub, facebookId: r.payload.facebookId, email: r.payload.email });
  if (!out) return res.status(409).json({ error: "Un compte existe déjà avec ce numéro. Connectez-vous." });
  res.status(201).json(out);
});
app.post("/api/client/login", limit("clogin", 10, 15 * 60e3), (req, res) => {
  const phone = normPhone(req.body?.phone), c = phone && db.clientByPhone(phone);
  if (!c || !db.checkClientPass(c, req.body?.password)) return res.status(401).json({ error: "Numéro ou mot de passe incorrect." });
  res.json({ token: db.createClientSession(c.id), client: db.clientPrivate(c) });
});
app.post("/api/client/logout", clientAuth, (req, res) => { db.deleteClientSession(req.get("authorization").replace(/^Bearer\s+/i, "")); res.json({ ok: true }); });
app.get("/api/client/me", clientAuth, (req, res) => res.json({ client: db.clientPrivate(req.client) }));
app.patch("/api/client/me", clientAuth, (req, res) => {
  const b = req.body || {}, patch = {};
  if (b.name != null && clean(b.name, 60)) patch.name = clean(b.name, 60);
  if (b.loc && LK.COMMUNES[clean(b.loc.commune, 40)]) {
    const l = b.loc;
    patch.loc = { commune: clean(l.commune, 40), quartier: clean(l.quartier, 80), avenue: clean(l.avenue, 120), repere: clean(l.repere, 200),
      lat: Number.isFinite(+l.lat) && l.lat !== null ? +l.lat : null, lon: Number.isFinite(+l.lon) && l.lon !== null ? +l.lon : null };
  }
  res.json({ client: db.clientPrivate(db.updateClient(req.client.id, patch)) });
});
app.get("/api/client/orders", clientAuth, (req, res) => res.json({ orders: db.ordersForClient(req.client.id).map(o => ({ ...publicOrder(o), token: o.token })) }));

/* ---- Compte coiffeur : inscription, puis vérification par l'équipe La.Koiff ---- */
function createProAccount(d, phone) {
  if (db.proByPhone(phone)) return null;
  const services = {};
  for (const id of d.services || []) { const s = svc(id); if (s) services[s.id] = s.price; }
  const colors = ["#0E4D3F", "#B5476B", "#2F5BD3", "#9A6A12", "#6B4FB0", "#C2413A"];
  const id = d.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "").slice(0, 10) + newId(3).toLowerCase().replace(/[^a-z0-9]/g, "");
  if ((d.googleSub && db.proByGoogle(d.googleSub)) || (d.facebookId && db.proByFacebook(d.facebookId))) return null;
  const p = db.addPro({ id, name: d.name, kind: d.kind, color: colors[crypto.randomInt(colors.length)], base: d.commune, phone, passHash: d.passHash, services, verified: 0 });
  if (d.wantedPlan === "commission") db.setCommissionPlan(p.id); else if (d.wantedPlan) db.setWantedPlan(p.id, d.wantedPlan);
  if (d.googleSub) db.setProGoogle(p.id, d.googleSub, d.email || null);
  if (d.facebookId) db.setProFacebook(p.id, d.facebookId, d.email || null);
  if (CONTACT) wa.sendTemplate(CONTACT, "lk_candidature", [p.name, "+" + phone, p.base, Object.keys(services).map(k => svc(k).name).join(", ") || "non précisé", d.kind || "non précisé"]).catch(e => console.error("WhatsApp :", e.message));
  console.log(`Nouveau compte coiffeur à vérifier : ${p.name} (+${phone}, ${p.base})`);
  return { token: db.createSession(p.id), pro: db.proPrivate(db.getPro(p.id)) };
}
app.post("/api/pro/signup", signupLimit, async (req, res) => {
  const b = req.body || {}, name = clean(b.name, 60), phone = normPhone(b.phone), commune = clean(b.commune, 40);
  if (!name) return res.status(400).json({ error: "Indiquez votre nom ou le nom de votre salon." });
  if (!phone) return res.status(400).json({ error: "Indiquez un numéro WhatsApp valide, par exemple 0859 204 238." });
  if (!LK.COMMUNES[commune]) return res.status(400).json({ error: "Choisissez la commune où vous travaillez." });
  const g = googlePending(b.google);
  if (b.google && !g) return res.status(400).json({ error: "La connexion a expiré. Recommencez avec le bouton Google ou Facebook." });
  const pe = g ? null : passError(b.password); if (pe) return res.status(400).json({ error: pe });
  if (db.proByPhone(phone)) return res.status(409).json({ error: "Un compte coiffeur existe déjà avec ce numéro. Connectez-vous avec votre mot de passe." });
  const d = { name, commune, wantedPlan: LK.PLANS[clean(b.plan, 20)] ? clean(b.plan, 20) : null, kind: clean(b.kind, 40), services: [].concat(b.services || []).map(x => clean(x, 20)).slice(0, 30),
    passHash: db.hashPin(g ? crypto.randomBytes(18).toString("hex") : b.password), ...socialFields(g) };
  if (!VERIFY) { if (g) pendingGoogle.delete(b.google); return res.status(201).json(createProAccount(d, phone)); }
  try { await sendCode("pro", "signup", phone, d); } catch (e) { console.error("WhatsApp :", e.message); return res.status(502).json({ error: "Le code n'a pas pu être envoyé sur WhatsApp. Vérifiez le numéro et réessayez." }); }
  res.json({ needCode: true });
});
app.post("/api/pro/verify", codeLimit, (req, res) => {
  const phone = normPhone(req.body?.phone), r = phone ? db.useCode("pro", "signup", phone, req.body?.code) : { error: "Numéro invalide." };
  if (r.error) return res.status(400).json(r);
  const out = createProAccount(r.payload, phone);
  if (!out) return res.status(409).json({ error: "Un compte coiffeur existe déjà avec ce numéro. Connectez-vous." });
  res.status(201).json(out);
});

/* ---- Mot de passe oublié (code envoyé sur WhatsApp) ---- */
app.post("/api/auth/reset", codeLimit, async (req, res) => {
  const role = req.body?.role === "pro" ? "pro" : "client", phone = normPhone(req.body?.phone);
  if (!phone) return res.status(400).json({ error: "Indiquez votre numéro WhatsApp." });
  if (!wa.enabled) return res.status(503).json({ error: `Pour changer votre mot de passe, écrivez à La.Koiff sur WhatsApp${CONTACT ? " au +" + CONTACT : ""}.` });
  const exists = role === "pro" ? db.proByPhone(phone) : db.clientByPhone(phone);
  if (exists) { try { await sendCode(role, "reset", phone, {}); } catch (e) { console.error("WhatsApp :", e.message); } }
  res.json({ needCode: true });   // même réponse si le numéro n'existe pas
});
app.post("/api/auth/reset/confirm", codeLimit, (req, res) => {
  const role = req.body?.role === "pro" ? "pro" : "client", phone = normPhone(req.body?.phone);
  const pe = passError(req.body?.password); if (pe) return res.status(400).json({ error: pe });
  const r = phone ? db.useCode(role, "reset", phone, req.body?.code) : { error: "Numéro invalide." };
  if (r.error) return res.status(400).json(r);
  const h = db.hashPin(req.body.password);
  if (role === "pro") { const p = db.proByPhone(phone); db.setPinHash(p.id, h); return res.json({ token: db.createSession(p.id), pro: db.proPrivate(db.getPro(p.id)) }); }
  const c = db.clientByPhone(phone); db.updateClient(c.id, { pass_hash: h });
  res.json({ token: db.createClientSession(c.id), client: db.clientPrivate(c) });
});
app.get("/api/auth/config", (req, res) => res.json({ verify: VERIFY, reset: wa.enabled, googleClientId: GOOGLE_ID || null, facebookAppId: FB_ID || null }));

/* ---- Connexion avec Google ----
   Le site reçoit un jeton signé par Google, le serveur le vérifie. Compte déjà lié : connexion directe.
   Première fois : on demande le numéro WhatsApp (indispensable pour les commandes) pour créer le compte. */
const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = GOOGLE_ID ? new OAuth2Client(GOOGLE_ID) : null;
const pendingGoogle = new Map();   // jeton temporaire -> { sub, email, name, exp }
/* Champs à enregistrer sur le compte selon le réseau utilisé (Google ou Facebook) */
function socialFields(g) {
  if (!g) return {};
  return g.provider === "facebook" ? { facebookId: g.sub, email: g.email } : { googleSub: g.sub, email: g.email };
}
function googlePending(t) {
  if (!t) return null; const g = pendingGoogle.get(String(t));
  if (!g || g.exp < now()) { pendingGoogle.delete(String(t)); return null; }
  return g;
}
app.post("/api/auth/google", limit("google", 20, 15 * 60e3), async (req, res) => {
  if (!googleClient) return res.status(503).json({ error: "La connexion avec Google n'est pas encore activée sur ce site." });
  const role = req.body?.role === "pro" ? "pro" : "client";
  let info;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: String(req.body?.credential || ""), audience: GOOGLE_ID });
    info = ticket.getPayload();
  } catch (e) { return res.status(401).json({ error: "La connexion avec Google n'a pas pu être vérifiée. Réessayez." }); }
  if (!info?.sub || info.email_verified === false) return res.status(401).json({ error: "Votre adresse Google n'est pas vérifiée." });
  if (role === "pro") {
    const p = db.proByGoogle(info.sub);
    if (p) return res.json({ token: db.createSession(p.id), pro: db.proPrivate(p) });
  } else {
    const c = db.clientByGoogle(info.sub);
    if (c) return res.json({ token: db.createClientSession(c.id), client: db.clientPrivate(c) });
  }
  for (const [k, v] of pendingGoogle) if (v.exp < now()) pendingGoogle.delete(k);
  const pending = newId(16);
  pendingGoogle.set(pending, { provider: "google", sub: info.sub, email: info.email || null, name: info.given_name || info.name || "", exp: now() + 30 * 60e3 });
  res.json({ needProfile: true, provider: "google", pending, name: role === "pro" ? (info.name || "") : (info.given_name || info.name || ""), email: info.email || "" });
});

/* ---- Connexion avec Facebook ----
   Le site reçoit un jeton d'accès Facebook ; le serveur vérifie auprès de Facebook qu'il est valide et destiné à La.Koiff. */
const FB_ID = process.env.FACEBOOK_APP_ID || "", FB_SECRET = process.env.FACEBOOK_APP_SECRET || "";
const FB_GRAPH = "https://graph.facebook.com/v19.0";
async function facebookUser(accessToken) {
  const dbg = await fetch(`https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(FB_ID + "|" + FB_SECRET)}`).then(r => r.json());
  if (!dbg?.data?.is_valid || String(dbg.data.app_id) !== String(FB_ID)) throw new Error("jeton refusé");
  const me = await fetch(`${FB_GRAPH}/me?fields=id,name,first_name,email&access_token=${encodeURIComponent(accessToken)}`).then(r => r.json());
  if (!me?.id || String(me.id) !== String(dbg.data.user_id)) throw new Error("profil introuvable");
  return me;
}
app.post("/api/auth/facebook", limit("facebook", 20, 15 * 60e3), async (req, res) => {
  if (!FB_ID || !FB_SECRET) return res.status(503).json({ error: "La connexion avec Facebook n'est pas encore activée sur ce site." });
  const role = req.body?.role === "pro" ? "pro" : "client";
  let me;
  try { me = await facebookUser(String(req.body?.accessToken || "")); }
  catch (e) { return res.status(401).json({ error: "La connexion avec Facebook n'a pas pu être vérifiée. Réessayez." }); }
  if (role === "pro") {
    const p = db.proByFacebook(me.id);
    if (p) return res.json({ token: db.createSession(p.id), pro: db.proPrivate(p) });
  } else {
    const c = db.clientByFacebook(me.id);
    if (c) return res.json({ token: db.createClientSession(c.id), client: db.clientPrivate(c) });
  }
  for (const [k, v] of pendingGoogle) if (v.exp < now()) pendingGoogle.delete(k);
  const pending = newId(16);
  pendingGoogle.set(pending, { provider: "facebook", sub: String(me.id), email: me.email || null, name: me.first_name || me.name || "", exp: now() + 30 * 60e3 });
  res.json({ needProfile: true, provider: "facebook", pending, name: role === "pro" ? (me.name || "") : (me.first_name || me.name || ""), email: me.email || "" });
});


/* ===================== ADMINISTRATION (espace La.Koiff) =====================
   Accessible sur /admin.html avec le mot de passe ADMIN_PASSWORD (réglage du site).
   Permet de vérifier les coiffeurs, activer leurs formules et enregistrer les paiements, sans ligne de commande. */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const adminSessions = new Map();   // jeton -> expiration
function adminAuth(req, res, next) {
  const t = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const exp = t && adminSessions.get(t);
  if (!exp || exp < now()) { adminSessions.delete(t); return res.status(401).json({ error: "Session administrateur expirée. Reconnectez-vous." }); }
  next();
}
app.post("/api/admin/login", limit("admin", 8, 15 * 60e3), (req, res) => {
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 10) return res.status(503).json({ error: "Espace administrateur désactivé : définissez ADMIN_PASSWORD (10 caractères minimum) dans les réglages du site." });
  const a = Buffer.from(String(req.body?.password || "")), b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: "Mot de passe incorrect." });
  const t = crypto.randomBytes(24).toString("base64url"); adminSessions.set(t, now() + 12 * 3600e3);
  res.json({ token: t });
});
const adminPro = p => ({ ...db.proPrivate(p), verified: !!p.verified, visible: visible(p), worksCount: db.workCount(p.id), done: db.doneCount(p.id), created: p.since });
app.get("/api/admin/overview", adminAuth, (req, res) => res.json({ stats: db.stats(), pros: db.allPros().map(adminPro).sort((x, y) => x.verified - y.verified) }));
function adminTarget(req, res) { const p = db.getPro(clean(req.params.id, 40)); if (!p) res.status(404).json({ error: "Coiffeur introuvable." }); return p; }
app.post("/api/admin/pros/:id/verify", adminAuth, (req, res) => {
  const p = adminTarget(req, res); if (!p) return;
  const on = req.body?.verified !== false;
  db.updatePro(p.id, { verified: on ? 1 : 0 });
  const q = db.getPro(p.id);
  if (on) {
    const missing = [!q.photo && "ajoutez votre photo de profil", db.workCount(q.id) < LK.WORKS.min && `ajoutez au moins ${LK.WORKS.min} photos de vos réalisations`, !LK.planActive(q) && "choisissez votre formule (Simple, Pro ou Commission)"].filter(Boolean);
    const msg = missing.length ? `votre compte coiffeur est vérifié. Pour recevoir vos premiers clients, ${missing.join(" et ")} dans votre espace` : "votre compte coiffeur est vérifié : vous êtes maintenant visible par les clients";
    wa.sendTemplate(q.whatsapp, "lk_abonnement", [msg, `${BASE_URL}/pro.html`]).catch(e => console.error("WhatsApp :", e.message));
  }
  push("pro", q.id, { type: "pro", pro: db.proPrivate(q) });
  res.json({ pro: adminPro(q) });
});
app.post("/api/admin/pros/:id/plan", adminAuth, (req, res) => {
  const p = adminTarget(req, res); if (!p) return;
  const plan = clean(req.body?.plan, 20), months = Math.max(1, Math.min(12, parseInt(req.body?.months, 10) || 1)), ref = clean(req.body?.ref, 60);
  let q;
  if (plan === "commission") q = db.setCommissionPlan(p.id);
  else if (plan === "simple" || plan === "pro") q = db.activatePlan(p.id, plan, months, ref);
  else return res.status(400).json({ error: "Formule inconnue." });
  const pl = LK.PLANS[plan];
  const msg = plan === "commission" ? `vous êtes passé à la formule ${pl.name} : ${Math.round(pl.rate * 100)} % par prestation, rien à payer d'avance`
    : plan === "simple" ? `votre abonnement ${pl.name} est activé : ${q.credits} clients garantis` : `votre abonnement ${pl.name} est activé jusqu'au ${dateTxt(q.plan_until)} : clients illimités`;
  wa.sendTemplate(q.whatsapp, "lk_abonnement", [msg, `${BASE_URL}/pro.html`]).catch(e => console.error("WhatsApp :", e.message));
  push("pro", q.id, { type: "pro", pro: db.proPrivate(q) });
  res.json({ pro: adminPro(q) });
});
app.post("/api/admin/pros/:id/commission-payment", adminAuth, (req, res) => {
  const p = adminTarget(req, res); if (!p) return;
  const amount = Math.round(+req.body?.amount);
  if (!(amount > 0)) return res.status(400).json({ error: "Indiquez le montant reçu." });
  const q = db.payCommission(p.id, amount, clean(req.body?.ref, 60));
  wa.sendTemplate(q.whatsapp, "lk_abonnement", [`paiement de ${fmtFC(amount)} reçu, merci. Reste à payer : ${fmtFC(q.commission_due)}`, `${BASE_URL}/pro.html`]).catch(e => console.error("WhatsApp :", e.message));
  push("pro", q.id, { type: "pro", pro: db.proPrivate(q) });
  res.json({ pro: adminPro(q) });
});
app.post("/api/admin/pros/:id/password", adminAuth, (req, res) => {
  const p = adminTarget(req, res); if (!p) return;
  const pw = String(req.body?.password || ""); if (pw.length < 6) return res.status(400).json({ error: "6 caractères minimum." });
  db.setPin(p.id, pw); res.json({ ok: true });
});

/* ---------- espace coiffeur ---------- */
app.post("/api/pro/login", limit("login", 10, 15 * 60e3), (req, res) => {
  const phone = normPhone(req.body?.phone), pin = clean(req.body?.pin, 12);
  const pro = phone && db.proByPhone(phone);
  if (!pro || !db.checkPin(pro, pin)) return res.status(401).json({ error: "Numéro ou code incorrect." });
  res.json({ token: db.createSession(pro.id), pro: db.proPrivate(pro) });
});
app.post("/api/pro/logout", proAuth, (req, res) => { db.deleteSession(req.get("authorization").replace(/^Bearer\s+/i, "")); res.json({ ok: true }); });
app.get("/api/pro/me", proAuth, (req, res) => res.json({ pro: db.proPrivate(req.pro) }));
app.patch("/api/pro/me", proAuth, (req, res) => {
  const b = req.body || {}, patch = {};
  if (typeof b.available === "boolean") patch.available = b.available ? 1 : 0;
  if (b.services && typeof b.services === "object") {
    const sv = {};
    for (const [k, v] of Object.entries(b.services)) {
      if (!svc(k) || v == null) continue;
      if (LK.PRICES_FIXED) { sv[k] = svc(k).price; continue; }   // prix fixés par La.Koiff : le coiffeur choisit seulement ses services
      const n = Math.round(+v / 500) * 500; if (n >= 1000 && n <= 5e6) sv[k] = n;
    }
    patch.services = sv;
  }
  res.json({ pro: db.proPrivate(db.updatePro(req.pro.id, patch)) });
});
/* Le coiffeur choisit sa formule. Commission : activée tout de suite (sans paiement d'avance).
   Simple / Pro : on enregistre son choix ; l'abonnement est activé après vérification du paiement. */
app.post("/api/pro/plan", proAuth, (req, res) => {
  const plan = clean(req.body?.plan, 20), p = req.pro;
  if (!LK.PLANS[plan]) return res.status(400).json({ error: "Formule inconnue." });
  if (plan === "commission") {
    const cur = LK.PLANS[p.plan];
    if (cur && cur.rate == null && LK.planActive(p)) return res.status(409).json({ error: `Votre abonnement ${cur.name} est encore en cours. Vous pourrez passer à la commission quand il sera terminé.` });
    return res.json({ pro: db.proPrivate(db.setCommissionPlan(p.id)) });
  }
  db.setWantedPlan(p.id, plan);
  res.json({ pro: db.proPrivate(db.getPro(p.id)), pending: true });
});
app.get("/api/pro/orders", proAuth, (req, res) => res.json({ orders: db.ordersForPro(req.pro.id).map(o => publicOrder(o, true)) }));
app.get("/api/pro/stream", proAuth, (req, res) => subscribe("pro", req.pro.id, req, res));
app.post("/api/pro/orders/:id/:action", proAuth, (req, res) => {
  const o = db.getOrder(req.params.id);
  if (!o || o.pro_id !== req.pro.id) return res.status(404).json({ error: "Commande introuvable." });
  const status = { accept: "accepted", refuse: "refused", depart: "enroute", arrive: "arrived", done: "done", noshow: "noshow" }[req.params.action];
  if (!status) return res.status(400).json({ error: "Action inconnue." });
  const r = setStatus(o, status);
  if (r.error) return res.status(409).json(r);
  res.json({ order: publicOrder(r.order, true) });
});
/* Position GPS du coiffeur pendant le trajet */
app.post("/api/pro/location", proAuth, limit("loc", 240, 3600e3), (req, res) => {
  const lat = +req.body?.lat, lon = +req.body?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return res.status(400).json({ error: "Position invalide." });
  db.updatePro(req.pro.id, { lat, lon, loc_at: now() });
  for (const o of db.ordersForPro(req.pro.id).filter(x => x.status === "enroute")) {
    const dest = o.loc.lat != null ? [o.loc.lat, o.loc.lon] : LK.COMMUNES[o.loc.commune];
    const left = LK.haversine([lat, lon], dest) * 1.35;
    push("order", o.id, { type: "pos", lat, lon, at: now(), etaLeft: Math.max(1, Math.round(left / 18 * 60 + 2)) });
  }
  res.json({ ok: true });
});

/* ---------- site ---------- */
app.use("/photos-coiffeurs", express.static(db.PHOTO_DIR, { maxAge: "7d", fallthrough: false, setHeaders: r => r.setHeader("X-Content-Type-Options", "nosniff") }));
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1h", extensions: ["html"] }));
app.use((req, res) => res.status(404).json({ error: "Page introuvable." }));

db.init();
setInterval(() => { lastPlanCheck = Date.now(); checkPlans().catch(e => console.error(e.message)); }, 3600e3);
app.listen(PORT, process.env.HOST || "0.0.0.0", () => {
  console.log(`La.Koiff en ligne sur ${BASE_URL}`);
  console.log(wa.enabled ? "WhatsApp : activé" : "WhatsApp : désactivé (messages affichés ici). Remplissez WHATSAPP_TOKEN et WHATSAPP_PHONE_ID dans .env");
});
