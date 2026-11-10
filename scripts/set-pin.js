// Change le code d'un coiffeur. Exemple : npm run set-pin -- 0810000001 5739
require("dotenv").config();
const db = require("../db");
db.init();
const [tel, pin] = process.argv.slice(2);
let d = String(tel || "").replace(/\D/g, ""); if (d.length === 10 && d.startsWith("0")) d = "243" + d.slice(1);
const pro = db.proByPhone(d);
if (!pro || !pin || pin.length < 4) { console.error("Usage : npm run set-pin -- 08XXXXXXXX NOUVEAUCODE (4 chiffres minimum)"); process.exit(1); }
db.setPin(pro.id, pin);
console.log(`Code changé pour ${pro.name}.`);
