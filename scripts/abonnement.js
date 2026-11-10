// Active ou renouvelle l'abonnement d'un coiffeur après réception de son paiement.
//   npm run abonnement -- 0810000001 simple              La.Koiff Simple : 4 clients garantis
//   npm run abonnement -- 0810000001 pro 3 MP12345       La.Koiff Pro, 3 mois, référence du paiement
//   (pour simple, le nombre multiplie les places : « simple 2 » = 8 clients garantis)
//   npm run abonnement -- 0810000001 voir                formule en cours et historique
require("dotenv").config();
const db = require("../db");
const LK = require("../public/data.js");
db.init();
const [tel, what, n = "1", ref = ""] = process.argv.slice(2);
let d = String(tel || "").replace(/\D/g, ""); if (d.length === 10 && d.startsWith("0")) d = "243" + d.slice(1);
const pro = d && db.proByPhone(d);
const money = (v, cur) => cur === "USD" ? `${v} $` : v.toLocaleString("fr-FR").replace(/ | /g, " ") + " FC";
const day = t => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
if (!pro || !["simple", "pro", "voir"].includes(what)) {
  console.error("Usage : npm run abonnement -- 08XXXXXXXX simple|pro [nombre de mois] [référence du paiement]");
  console.error("        npm run abonnement -- 08XXXXXXXX voir");
  process.exit(1);
}
if (what === "voir") {
  const pl = LK.PLANS[pro.plan];
  console.log(`${pro.name} : ${pl ? pl.name : "aucun abonnement"}${pl && !pl.guaranteed ? `, jusqu'au ${day(pro.plan_until)}` : ""}${pl && pl.clients != null ? `, ${pro.credits} client(s) garanti(s) restant(s)` : pl ? ", clients illimités" : ""}. ${LK.planActive(pro) ? "Visible par les clients." : "Pas visible par les clients."}`);
  for (const s of db.listSubscriptions(pro.id)) console.log(`  ${day(s.created)} · ${LK.PLANS[s.plan]?.name || "Abonnement"} · ${s.clients < 0 ? "illimité" : s.clients + " clients"} · ${money(s.amount, s.currency)}${s.ref ? " · réf. " + s.ref : ""}`);
  process.exit(0);
}
const months = Math.max(1, Math.min(12, parseInt(n, 10) || 1));
const p = db.activatePlan(pro.id, what, months, ref), pl = LK.PLANS[what];
console.log(pl.guaranteed
  ? `${pl.name} activé pour ${p.name} (${money(pl.price * months, pl.currency)}) : ${p.credits} clients garantis, sans date limite.`
  : `${pl.name} activé pour ${p.name} jusqu'au ${day(p.plan_until)} (${money(pl.price * months, pl.currency)}). Clients illimités.`);
