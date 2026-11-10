// Affiche les candidatures « Devenir coiffeur ». Exemple : npm run candidatures
require("dotenv").config();
const db = require("../db");
db.init();
const list = db.listCandidatures();
if (!list.length) console.log("Aucune candidature pour le moment.");
for (const c of list) console.log(`${new Date(c.created).toLocaleString("fr-FR")} · ${c.name} · +${c.phone} · ${c.commune} · ${c.kind || ""} · ${c.specialites || ""} · ${c.experience || ""}${c.message ? "\n   « " + c.message + " »" : ""}`);
