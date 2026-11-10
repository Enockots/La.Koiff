// Formule commission : voir le montant dû par un coiffeur, enregistrer un paiement, ou l'y passer.
//   npm run commission -- 0810000001 voir
//   npm run commission -- 0810000001 payer 20000 MP12345    (paiement reçu, avec sa référence)
//   npm run commission -- 0810000001 activer                (passer le coiffeur à la formule commission)
//   npm run commission -- liste                             (tous les coiffeurs à la commission et leur dû)
require("dotenv").config();
const db = require("../db");
const LK = require("../public/data.js");
db.init();
const fc = n => Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ") + " FC";
const day = t => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const C = LK.PLANS.commission;
const [tel, what, amount, ref = ""] = process.argv.slice(2);
if (tel === "liste") {
  const list = db.allPros().filter(p => p.plan === "commission");
  if (!list.length) console.log("Aucun coiffeur à la commission.");
  for (const p of list) console.log(`${p.name} · 0${p.phone.slice(3)} · dû : ${fc(p.commission_due)}${p.commission_due >= C.limit ? " · SUSPENDU" : ""}`);
  process.exit(0);
}
let d = String(tel || "").replace(/\D/g, ""); if (d.length === 10 && d.startsWith("0")) d = "243" + d.slice(1);
const pro = d && db.proByPhone(d);
if (!pro || !["voir", "payer", "activer"].includes(what)) {
  console.error("Usage : npm run commission -- 08XXXXXXXX voir | payer MONTANT [référence] | activer");
  console.error("        npm run commission -- liste");
  process.exit(1);
}
if (what === "activer") { db.setCommissionPlan(pro.id); console.log(`${pro.name} est à la formule ${C.name} (${Math.round(C.rate * 100)} % par prestation).`); process.exit(0); }
if (what === "payer") {
  const n = Math.round(+amount);
  if (!(n > 0)) { console.error("Indiquez le montant reçu, par exemple : payer 20000 MP12345"); process.exit(1); }
  const p = db.payCommission(pro.id, n, ref);
  console.log(`Paiement de ${fc(n)} enregistré pour ${p.name}. Reste dû : ${fc(p.commission_due)}.${LK.planActive(p) ? " Profil disponible." : " Profil encore suspendu."}`);
  process.exit(0);
}
console.log(`${pro.name} : formule ${LK.PLANS[pro.plan]?.name || "aucune"}, commissions dues ${fc(pro.commission_due)} (limite ${fc(C.limit)}).`);
for (const r of db.listCommissionPayments(pro.id)) console.log(`  ${day(r.created)} · payé ${fc(r.amount)}${r.ref ? " · réf. " + r.ref : ""}`);
