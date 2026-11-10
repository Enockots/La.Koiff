// Liste les comptes coiffeurs. Exemple : npm run coiffeurs           (tous)
//                                       npm run coiffeurs -- attente (à vérifier seulement)
require("dotenv").config();
const db = require("../db");
const LK = require("../public/data.js");
db.init();
const onlyPending = process.argv[2] === "attente";
const day = t => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
const list = db.allPros().filter(p => !onlyPending || !p.verified);
if (!list.length) console.log(onlyPending ? "Aucun compte coiffeur en attente de vérification." : "Aucun coiffeur.");
for (const p of list) {
  const pl = LK.PLANS[p.plan];
  const plan = !pl ? "sans formule"
    : pl.rate != null ? `${pl.name} (dû : ${p.commission_due} FC)`
    : pl.guaranteed ? `${pl.name} (${p.credits} clients garantis restants)`
    : p.plan_until > Date.now() ? `${pl.name} jusqu'au ${day(p.plan_until)}` : `${pl.name} terminé`;
  const wanted = p.wanted_plan && p.wanted_plan !== p.plan ? ` · souhaite ${LK.PLANS[p.wanted_plan]?.name}` : "";
  const services = Object.keys(p.services).map(k => LK.SERVICES.find(s => s.id === k)?.name).filter(Boolean).join(", ") || "aucun service";
  console.log(`${p.verified ? "✓ vérifié " : "… à vérifier"} · ${p.name} · 0${p.phone.slice(3)} · ${p.base} · ${p.kind || ""} · ${plan}${wanted} · ${p.photo ? "photo ✓" : "SANS PHOTO"} · ${db.workCount(p.id)} réalisation(s) · ${services}`);
}
