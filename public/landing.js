/* La.Koiff : page d'accueil */
(function(){
const { fmt, usd, fmtDur, esc, toast } = UI;
let CONTACT = "243859204238";   // numéro WhatsApp de La.Koiff (remplacé par CONTACT_WHATSAPP du serveur)

/* Prix de départ : ceux du serveur si disponibles, sinon ceux du catalogue */
const fromData = () => { const f = {}; for(const p of LK.PROS) for(const k of Object.keys(p.services)) f[k] = Math.min(f[k] ?? Infinity, LK.priceFor(p, k)); return f; };
let PRICES = fromData();

function renderStyles(){
  const pick = ["box","knotless","fulani","boho","nattes"].map(id=>LK.MODELS.find(m=>m.id===id)).filter(Boolean);
  document.getElementById("styles").innerHTML = pick.map(m=>{
    const s = LK.SERVICES.find(x=>x.id===m.svc), p = PRICES[m.svc];
    return `<a class="style-card" href="app.html#modele-${m.id}">
      <img src="${m.photo}" alt="${esc(m.name)}" loading="lazy">
      <span class="sc-info"><b>${esc(m.name)}</b><span>${fmtDur(s.dur)}${p!=null?` · dès ${fmt(p)}`:""}</span></span></a>`;
  }).join("");
  document.querySelectorAll("[data-price]").forEach(el=>{ const p = PRICES[el.dataset.price]; el.textContent = p!=null ? `dès ${fmt(p)} (${usd(p)})` : ""; });
  document.getElementById("fee-ex").textContent = `${fmt(LK.travelFee(5))} (${usd(LK.travelFee(5))})`;
}
renderStyles();
fetch("/api/prices").then(r=>r.ok?r.json():null).then(d=>{ if(d?.from && Object.keys(d.from).length){ PRICES = d.from; renderStyles(); } }).catch(()=>{});
fetch("/api/config").then(r=>r.ok?r.json():null).then(d=>{ if(d?.contact){ CONTACT = d.contact; setContact(); document.getElementById("join-wa").href = "https://wa.me/"+CONTACT; } }).catch(()=>{});
function setContact(){
  const a = document.getElementById("contact-link");
  a.href = "https://wa.me/"+CONTACT;
  a.textContent = "+"+CONTACT.replace(/^(\d{3})(\d{3})(\d{3})(\d{3})$/,"$1 $2 $3 $4");
}
document.getElementById("year").textContent = new Date().getFullYear();
/* Formules coiffeur : abonnement ou commission, au choix */
{ const P = LK.PLANS, pct = Math.round(P.commission.rate*100);
  const price = pl => pl.currency==="USD" ? `${pl.price} $` : fmt(pl.price);
  const other = pl => { const pr = LK.planPrice(pl); return pl.currency==="USD" ? `≈ ${fmt(pr.fc)}` : usd(pl.price); };
  const card = (pl, best) => `<div class="lk-plan ${best?"best":""}">
    ${best?`<span class="lk-plan-tag">Pour les plus actifs</span>`:""}
    <b class="lk-plan-name">${esc(pl.name)}</b>
    <div class="lk-plan-price"><span>${price(pl)}</span>${pl.guaranteed ? "" : " / mois"}</div>
    <span class="sm muted">${pl.guaranteed ? `pour ${pl.clients} clients garantis · ` : ""}${other(pl)}</span>
    <ul><li>${pl.clients==null ? "<b>Clients illimités</b> pendant le mois" : `<b>${pl.clients} clients garantis</b>`}</li>
      ${pl.guaranteed?"<li><b>Garantis</b> : places sans date limite</li><li>Client absent ou qui annule : place rendue</li>":""}
      <li><b>Aucune commission</b></li><li>Demandes sur WhatsApp</li>${pl.clients==null?"<li>Idéal pour les salons et les coiffeurs à plein temps</li>":"<li>Idéal pour commencer</li>"}</ul>
  </div>`;
  const comm = `<div class="lk-plan">
    <b class="lk-plan-name">${esc(P.commission.name)}</b>
    <div class="lk-plan-price"><span>${pct} %</span> par prestation</div>
    <span class="sm muted">rien à payer d'avance</span>
    <ul><li><b>Pas d'abonnement</b> : vous payez seulement quand vous travaillez</li>
      <li><b>Clients illimités</b></li>
      <li>${pct} % du prix de la prestation, hors déplacement, versé à La.Koiff</li>
      <li>Demandes sur WhatsApp</li></ul>
  </div>`;
  document.getElementById("lk-plans").innerHTML = card(P.simple, false) + card(P.pro, true) + comm;
  document.getElementById("sub-faq").textContent = `Le coiffeur choisit la formule qui lui convient : La.Koiff Simple à ${price(P.simple)} pour ${P.simple.clients} clients garantis (sans date limite), La.Koiff Pro à ${price(P.pro)} par mois avec des clients illimités, ou La.Koiff Commission, sans abonnement, à ${pct} % du prix de chaque prestation réalisée`;
}

/* Menu mobile */
const nav = document.getElementById("nav"), menu = document.getElementById("menu-btn");
menu.addEventListener("click", ()=>{ const open = nav.classList.toggle("open"); menu.setAttribute("aria-expanded", open); });
nav.addEventListener("click", e=>{ if(e.target.closest("a")){ nav.classList.remove("open"); menu.setAttribute("aria-expanded", false); } });

/* Lien WhatsApp de la carte « Créez votre compte coiffeur » */
document.getElementById("join-wa").href = "https://wa.me/"+CONTACT;
})();
