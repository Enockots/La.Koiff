// Valide le compte d'un coiffeur après vérification (pièce d'identité, expérience, photos).
// Exemple : npm run valider -- 0812345678
require("dotenv").config();
const db = require("../db");
const wa = require("../whatsapp");
const LK = require("../public/data.js");
db.init();
let d = String(process.argv[2] || "").replace(/\D/g, ""); if (d.length === 10 && d.startsWith("0")) d = "243" + d.slice(1);
const p = d && db.proByPhone(d);
if (!p) { console.error("Usage : npm run valider -- 08XXXXXXXX   (la liste : npm run coiffeurs -- attente)"); process.exit(1); }
db.updatePro(p.id, { verified: 1 });
const active = LK.planActive(p), missing = [];
if (!p.photo) missing.push("sa photo de profil (à ajouter dans son espace)");
const nWorks = db.workCount(p.id);
if (nWorks < LK.WORKS.min) missing.push(`au moins ${LK.WORKS.min} photos de ses réalisations (il en a ${nWorks})`);
if (!p.available) missing.push("activé « Disponible » dans son espace");
if (!active) missing.push("une formule active (commission dans son espace, ou abonnement : npm run abonnement)");
console.log(`Compte vérifié : ${p.name}. ${missing.length ? "Il apparaîtra aux clients dès qu'il aura " + missing.join(" et ") + "." : "Il est maintenant visible par les clients."}`);
const base = (process.env.BASE_URL || "").replace(/\/$/, "");
const msg = missing.length
  ? `votre compte coiffeur est vérifié. Pour recevoir vos premiers clients, ${[!p.photo && "ajoutez votre photo de profil", nWorks < LK.WORKS.min && `ajoutez au moins ${LK.WORKS.min} photos de vos réalisations`, !active && "choisissez votre formule (Simple, Pro ou Commission)"].filter(Boolean).join(" et ")} dans votre espace`
  : "votre compte coiffeur est vérifié : vous êtes maintenant visible par les clients";
wa.sendTemplate(p.whatsapp, "lk_abonnement", [msg, `${base}/pro.html`]).catch(e => console.error("WhatsApp :", e.message));
