// Ajoute un coiffeur vérifié.
// Exemple : npm run add-pro -- --nom "Grâce K." --tel 0812345678 --commune Lemba --code 4821 --services "tresse,vanill,nattes"
require("dotenv").config();
const db = require("../db");
const LK = require("../public/data.js");
const arg = k => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : undefined; };
const norm = p => { let d = String(p || "").replace(/\D/g, ""); if (d.length === 10 && d.startsWith("0")) d = "243" + d.slice(1); return d; };
db.init();
const name = arg("nom"), phone = norm(arg("tel")), base = arg("commune"), pin = arg("code");
if (!name || phone.length < 11 || !LK.COMMUNES[base] || !pin || pin.length < 4) {
  console.error("Usage : npm run add-pro -- --nom \"Prénom N.\" --tel 08XXXXXXXX --commune Lemba --code 1234 [--whatsapp 08XXXXXXXX] [--type \"Salon\"] [--services \"coupeH,tresse\"]");
  console.error("Communes : " + Object.keys(LK.COMMUNES).join(", "));
  console.error("Services : " + LK.SERVICES.map(s => s.id + " (" + s.name + ")").join(", "));
  process.exit(1);
}
const services = {};
for (const part of String(arg("services") || "").split(",").filter(Boolean)) {
  const [k, v] = part.split("="); const s = LK.SERVICES.find(x => x.id === k.trim());
  if (s) services[s.id] = LK.PRICES_FIXED || !v ? s.price : Math.round(+v);   // prix fixés par La.Koiff par défaut
}
const id = name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "").slice(0, 12) + Math.random().toString(36).slice(2, 6);
db.addPro({ id, name, kind: arg("type"), base, phone, whatsapp: norm(arg("whatsapp")) || phone, pin, services });
console.log(`Coiffeur ajouté : ${name} (${id}). Connexion sur /pro.html avec le ${arg("tel")} et son code.`);
console.log("Remarque : les trajets exacts sur la carte existent pour les coiffeurs d'exemple ; pour les nouveaux, la distance est estimée.");
