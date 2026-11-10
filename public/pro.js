/* La.Koiff : espace coiffeur */
(function(){
const { resizePhoto, fmt, usd, fmtDur, esc, hhmm, dayTxt, svc, km, ICON, avatar, toast, store } = UI;
const $screen = document.getElementById("screen");
const S = { token: store.get("proToken", null), pro:null, orders:[], edit:null, gps:null, busy:false, auth:{tab: location.hash==="#inscription" ? "signup" : "login"}, authCfg:{} };
UI.api("/api/auth/config").then(c=>{ S.authCfg = c; if(!S.pro) render(true); }).catch(()=>{});
const address = l => [l.avenue, l.quartier, l.commune].filter(Boolean).join(", ");

async function api(path, opts={}){
  try{ return await UI.api(path, { ...opts, headers: { Authorization: "Bearer "+S.token } }); }
  catch(e){ if(/Session expirée/.test(e.message)) logout(); throw e; }
}

/* ---------------- écrans ---------------- */
/* ---------------- connexion et création de compte ---------------- */
function viewLogin(){
  const t = S.auth.tab, ph = esc(S.auth.phone||"");
  const tabs = `<div class="role-switch auth-tabs" role="group" aria-label="Connexion ou inscription"><button type="button" data-act="auth-tab" data-id="login" aria-pressed="${t==="login"}">Se connecter</button><button type="button" data-act="auth-tab" data-id="signup" aria-pressed="${t==="signup"}">Créer un compte</button></div>`;
  let form;
  if(t==="login") form = `<form class="card form" data-form="login">
      <label for="l-phone">Votre numéro</label><input id="l-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" value="${ph}" placeholder="Ex. : 0859 204 238" required>
      <label for="l-pin">Mot de passe</label><input id="l-pin" name="pin" type="password" autocomplete="current-password" required>
      <button class="btn" type="submit">Se connecter</button>
      <button class="linkbtn" type="button" data-act="auth-tab" data-id="reset">Mot de passe oublié ?</button></form>`;
  else if(t==="signup") form = `<form class="card form" data-form="signup">
      <label for="s-name">Nom complet ou nom du salon</label><input id="s-name" name="name" autocomplete="name" placeholder="Ex. : Grâce Kabeya" required>
      <label for="s-phone">Numéro WhatsApp</label><input id="s-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" value="${ph}" placeholder="Ex. : 0859 204 238" required>
      <label for="s-pass">Mot de passe (6 caractères minimum)</label><input id="s-pass" name="password" type="password" autocomplete="new-password" minlength="6" required>
      <label for="s-commune">Commune où vous travaillez</label><select id="s-commune" name="commune" required><option value="">Choisissez…</option>${Object.keys(LK.COMMUNES).map(c=>`<option>${c}</option>`).join("")}</select>
      <label for="s-kind">Vous êtes</label><select id="s-kind" name="kind"><option>Coiffeur indépendant</option><option>Coiffeuse indépendante</option><option>Salon de coiffure</option></select>
      <fieldset class="specs"><legend>Les services que vous proposez</legend><div class="chips wrapchips">${LK.SERVICES.map(s=>`<label class="chip chk"><input type="checkbox" name="services" value="${s.id}"><span>${esc(s.name)}</span></label>`).join("")}</div></fieldset>
      <button class="btn" type="submit">Créer mon compte coiffeur</button>
      <span class="sm muted">${S.authCfg.verify ? "Vous recevez un code de vérification sur WhatsApp. " : ""}Votre compte est ensuite vérifié par l'équipe La.Koiff avant d'apparaître aux clients.</span></form>`;
  else if(t==="code" || t==="reset-code") form = `<form class="card form" data-form="${t}">
      <p class="sm" style="margin:0">Entrez le code à 6 chiffres reçu sur WhatsApp au <b class="mono">${ph}</b>.</p>
      <label for="c-code">Code</label><input id="c-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required>
      ${t==="reset-code" ? `<label for="c-pass">Nouveau mot de passe</label><input id="c-pass" name="password" type="password" autocomplete="new-password" minlength="6" required>` : ""}
      <button class="btn" type="submit">Valider</button>
      <button class="linkbtn" type="button" data-act="auth-tab" data-id="${t==="code"?"signup":"reset"}">Changer de numéro ou renvoyer un code</button></form>`;
  else form = `<form class="card form" data-form="reset">
      <p class="sm" style="margin:0">Indiquez votre numéro : vous recevez un code sur WhatsApp pour choisir un nouveau mot de passe.</p>
      <label for="r-phone">Votre numéro</label><input id="r-phone" name="phone" type="tel" inputmode="tel" value="${ph}" required>
      <button class="btn" type="submit">Recevoir un code</button>
      <button class="linkbtn" type="button" data-act="auth-tab" data-id="login">Retour à la connexion</button></form>`;
  return `<div class="body" style="max-width:520px;width:100%;margin:0 auto">
    <h2 class="hello">Espace coiffeur</h2>
    <p class="muted" style="margin:0">Recevez les demandes des clients près de chez vous, acceptez-les et partagez votre trajet.</p>
    ${["login","signup"].includes(t) ? tabs : ""}${form}
  </div>`;
}
/* Compte en attente de vérification */
/* Réalisations : au moins LK.WORKS.min photos pour apparaître aux clients */
function worksCard(p){
  const W = LK.WORKS, list = p.works || [], n = list.length, ok = n >= W.min;
  const offered = LK.SERVICES.filter(s => p.services[s.id] != null);
  return `<div class="card works-card ${ok?"":"photo-missing"}"><h4>Mes réalisations · ${n}/${W.max}</h4>
    <p class="sm ${ok?"muted":""}" style="margin:0;${ok?"":"color:var(--warn);font-weight:600"}">${ok
      ? "Les clients voient ces photos avant de vous choisir. Mettez vos plus belles coiffures."
      : `Ajoutez au moins ${W.min} photos de coiffures que vous avez faites (encore ${W.min-n}) : sans elles, vous n'apparaissez pas aux clients.`}</p>
    ${n ? `<div class="works-grid">${list.map(w=>`<figure class="work"><img src="${esc(w.url)}" alt="${esc(svc(w.serviceId)?.name || "Réalisation")}" loading="lazy">
      ${w.serviceId?`<figcaption>${esc(svc(w.serviceId)?.name||"")}</figcaption>`:""}<button class="work-del" data-act="del-work" data-id="${w.id}" aria-label="Supprimer cette photo">×</button></figure>`).join("")}</div>` : ""}
    ${n < W.max ? `<div class="works-add">
      <label class="sm" for="work-svc" style="font-weight:700">Coiffure sur la photo</label>
      <select id="work-svc"><option value="">Non précisée</option>${offered.map(s=>`<option value="${s.id}" ${S.workSvc===s.id?"selected":""}>${esc(s.name)}</option>`).join("")}</select>
      <label class="btn small" for="works-in">${S.uploadingWorks ? `Envoi ${S.uploadingWorks}…` : "Ajouter des photos"}</label>
      <input type="file" id="works-in" accept="image/*" multiple ${S.uploadingWorks?"disabled":""}></div>` : ""}
    <span class="sm muted">Conseil : la coiffure en entier, bien éclairée, sur un fond simple. Uniquement vos propres réalisations.</span></div>`;
}
/* Photo de profil : obligatoire pour apparaître aux clients */
function photoCard(p){
  return `<div class="card photo-card ${p.photo?"":"photo-missing"}"><h4>Ma photo de profil</h4>
    <div class="ph-row">${p.photo ? `<img class="ph-big" src="${esc(p.photo)}" alt="Votre photo de profil">` : `<div class="ph-empty">Pas encore de photo</div>`}
      <div style="display:grid;gap:8px;min-width:0">
        <p class="sm ${p.photo?"muted":""}" style="margin:0;${p.photo?"":"color:var(--warn);font-weight:600"}">${p.photo ? "Les clients voient cette photo quand ils choisissent un coiffeur." : "Ajoutez une photo de vous, bien visible : sans photo, vous n'apparaissez pas aux clients."}</p>
        <label class="btn small" for="photo-in">${S.uploading ? "Envoi…" : p.photo ? "Changer ma photo" : "Ajouter ma photo"}</label>
        <input type="file" id="photo-in" accept="image/*" ${S.uploading?"disabled":""}>
      </div></div>
    <span class="sm muted">Conseil : votre visage de face, à la lumière du jour, sans lunettes de soleil.</span></div>`;
}
function pendingCard(p){
  if(p.verified) return "";
  return `<div class="card pending"><h4>Compte en attente de vérification</h4>
    <p class="sm" style="margin:0">Bienvenue ${esc(p.name.split(" ")[0])} ! L'équipe La.Koiff vous contacte sur WhatsApp pour vérifier votre pièce d'identité, votre expérience et quelques photos de vos réalisations.</p>
    <ol class="mini-steps sm" style="margin:0"><li>Ajoutez votre photo de profil et au moins 3 photos de vos réalisations ci-dessous, et préparez votre pièce d'identité.</li><li>Choisissez vos services ci-dessous.</li><li>Choisissez votre abonnement : vous apparaissez aux clients dès la vérification.</li></ol>
    ${LK.PAYMENT.payTo?`<a class="btn small wa" style="text-decoration:none;justify-self:start" href="https://wa.me/${LK.PAYMENT.payTo.replace(/\D/g,"")}?text=${encodeURIComponent(`Bonjour La.Koiff, je viens de créer mon compte coiffeur.\nNom : ${p.name}\nNuméro : +${p.phone}\nCommune : ${p.base}`)}" target="_blank" rel="noopener">${ICON.phone} Envoyer mes photos sur WhatsApp</a>`:""}
  </div>`;
}
function orderCard(o){
  const s = svc(o.serviceId), when = o.when ? `${dayTxt(o.when)} à ${hhmm(o.when)}` : "Dès que possible";
  const waClient = `https://wa.me/${o.client.phone}?text=${encodeURIComponent(`Bonjour ${o.client.name||""}, ici votre coiffeur La.Koiff pour ${o.label}.`)}`;
  const contact = `<a class="btn small wa" href="${waClient}" target="_blank" rel="noopener">${ICON.phone} WhatsApp ${esc(o.client.name||"client")}</a>`;
  const info = `<div class="sm">${esc(address(o.loc))}${o.loc.repere?`<br>Repère : ${esc(o.loc.repere)}`:""}<br>${km(o.km)} · ${fmtDur(s.dur)} · ${when}</div>`;
  if(o.status==="sent") return `<div class="request">
    <h4>Nouvelle demande · ${hhmm(o.created)}</h4>
    <div style="display:flex;justify-content:space-between;align-items:end;gap:10px"><div><b style="font-size:17px">${esc(o.label)}</b>${info}</div>
      <div style="text-align:right"><div class="sm">${o.commissionAmount?"Vous gagnez":"Vous encaissez"}</div><div class="gain mono">${fmt(o.net)}</div><div class="sm">${o.commissionAmount?`après ${fmt(o.commissionAmount)} de commission`:usd(o.net)}</div></div></div>
    <div class="btns"><button class="btn ghost" data-act="refuse" data-id="${o.id}">Refuser</button><button class="btn" data-act="accept" data-id="${o.id}">Accepter</button></div>
  </div>`;
  const next = { accepted:["depart", o.when?"Partir maintenant":"Je pars"], enroute:["arrive","Je suis arrivé"], arrived:["done","Prestation terminée"] }[o.status];
  return `<div class="card">
    <h4>${o.status==="accepted"&&o.when?"Rendez-vous à venir":o.status==="enroute"?"En route":o.status==="arrived"?"Chez le client":"Course acceptée"}</h4>
    <b>${esc(o.label)}</b> <span class="sm muted">· ${esc(o.client.name||"Client")} · ${fmt(o.price+o.fee)} à encaisser</span>
    ${info}
    ${o.status==="enroute"?`<div id="map-${o.id}">${UI.mapHtml()}</div><div class="notice" id="gps-note">${S.gps==="on"?"Votre position est partagée avec le client.":S.gps==="err"?"Position indisponible : autorisez la localisation pour que le client vous suive.":"Activation du partage de position…"}</div>`:""}
    <div class="callrow">${contact}</div>
    <button class="btn" data-act="${next[0]}" data-id="${o.id}">${next[1]}</button>
    ${o.status==="arrived"?`<button class="btn ghost" data-act="noshow" data-id="${o.id}">Le client est absent</button><span class="sm muted">Client absent : la commande est annulée${S.pro?.plan==="simple"?" et votre place La.Koiff Simple vous est rendue":""}.</span>`:""}
  </div>`;
}
/* Abonnement : formule en cours, clients restants, renouvellement */
const priceTxt = pl => { const pr = LK.planPrice(pl); return pl.currency==="USD" ? `${pl.price} $ (≈ ${fmt(pr.fc)})` : `${fmt(pl.price)} (${usd(pl.price)})`; };
function offer(pl, p, current){
  if(pl.rate != null) return `<div class="plan">
    <div class="plan-head"><b>${esc(pl.name)}</b>${current?`<span class="badge">Votre formule</span>`:""}</div>
    <div class="plan-price mono">${Math.round(pl.rate*100)} % <span class="sm muted">par prestation</span></div>
    <p class="sm muted" style="margin:0">Rien à payer d'avance, clients illimités. Vous versez ${Math.round(pl.rate*100)} % du prix de chaque prestation réalisée (hors déplacement).</p>
    ${current ? "" : `<button class="btn small" data-act="choose-plan" data-id="commission">Choisir cette formule</button>`}
  </div>`;
  const msg = `Bonjour La.Koiff, je paie l'abonnement ${pl.name} (${pl.currency==="USD"?pl.price+" $ par mois":fmt(pl.price)+" pour "+pl.clients+" clients"}).\nNom : ${p.name}\nNuméro : +${p.phone}\nRéférence du paiement : `;
  return `<div class="plan ${pl.id==="pro"?"plan-pro":""}">
    <div class="plan-head"><b>${esc(pl.name)}</b>${current?`<span class="badge">Votre formule</span>`:p.wantedPlan===pl.id?`<span class="badge">Choisie, paiement à vérifier</span>`:""}</div>
    <div class="plan-price mono">${priceTxt(pl)} <span class="sm muted">${pl.guaranteed?"":"/ mois"}</span></div>
    <p class="sm muted" style="margin:0">${pl.clients==null?"Clients illimités pendant le mois. Pas de commission.":`${pl.clients} clients garantis, sans date limite. Pas de commission.`}</p>
    <a class="btn small wa" href="https://wa.me/${LK.PAYMENT.payTo.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener" data-act="want-plan" data-id="${pl.id}">${ICON.phone} J'ai payé, envoyer la référence</a>
  </div>`;
}
function subCard(p){
  const pl = LK.PLANS[p.plan], now = Date.now(), active = !!p.active;
  const daysLeft = p.planUntil ? Math.ceil((p.planUntil-now)/864e5) : 0;
  const until = p.planUntil ? dayTxt(p.planUntil) : "";
  const GUARANTEE = "Garantie La.Koiff : une place n'est utilisée que pour une prestation réalisée. Si le client annule ou s'il est absent, la place vous est rendue. Vos places n'ont pas de date limite : vous recevez bien vos clients.";
  let head, note = "", warn = false;
  if(pl && pl.rate != null){
    const due = p.commissionDue || 0, pct = Math.min(100, due/pl.limit*100), over = due >= pl.limit;
    head = `<div class="sub-row"><div><span class="plan-name">${esc(pl.name)} · ${Math.round(pl.rate*100)} % par prestation</span><br><span class="big mono">${fmt(due)}</span> <span class="muted">à verser à La.Koiff</span></div><span class="sm muted">limite ${fmt(pl.limit)}</span></div>
      <div class="sub-bar" aria-hidden="true"><i style="width:${pct}%;${over||pct>=80?"background:var(--bad)":""}"></i></div>`;
    note = over ? `<b>Profil suspendu</b> : vos commissions dues ont atteint ${fmt(pl.limit)}. Payez-les pour redevenir disponible.`
      : `Clients illimités, rien à payer d'avance. Après chaque prestation, ${Math.round(pl.rate*100)} % du prix (hors déplacement) s'ajoute ici. Au-delà de ${fmt(pl.limit)} non payés, votre profil est suspendu.`;
    warn = over;
    const payMsg = `Bonjour La.Koiff, je paie mes commissions (${fmt(due)}).\nNom : ${p.name}\nNuméro : +${p.phone}\nRéférence du paiement : `;
    const payBlock = due > 0 ? `<div class="renew"><p class="sm" style="margin:0">Payez par ${esc(LK.PAYMENT.payMethods)} au <b class="mono">${esc(LK.PAYMENT.payTo)}</b>, puis envoyez la référence. Le montant dû baisse dès la vérification.</p>
      <a class="btn small wa" href="https://wa.me/${LK.PAYMENT.payTo.replace(/\D/g,"")}?text=${encodeURIComponent(payMsg)}" target="_blank" rel="noopener">${ICON.phone} J'ai payé mes commissions</a></div>` : "";
    return `<div class="card sub ${warn?"empty-sub":""}"><h4>Ma formule</h4>${head}<p class="sm ${warn?"":"muted"}" style="margin:0;${warn?"color:var(--bad)":""}">${note}</p>${payBlock}
      ${S.showPlans ? `<div class="renew"><p class="sm" style="margin:0">Préférez un abonnement ? Payez-le, il remplace la commission dès la vérification.</p><div class="plans-row">${offer(LK.PLANS.simple,p,false)}${offer(LK.PLANS.pro,p,false)}</div></div>` : `<button class="btn ghost small" data-act="plans" style="justify-self:start">Voir les autres formules</button>`}</div>`;
  }
  if(!pl || (!pl.guaranteed && daysLeft <= 0) || (pl.guaranteed && p.credits <= 0)){
    head = `<div class="sub-row"><div>${pl?`<span class="plan-name">${esc(pl.name)}</span><br>`:""}<span class="big">${pl ? "À renouveler" : "Aucun abonnement"}</span></div></div>`;
    note = !pl ? "Choisissez un abonnement pour apparaître aux clients."
      : pl.guaranteed ? `Vous avez reçu vos ${pl.clients} clients La.Koiff Simple. Renouvelez Simple, ou passez à Pro pour des clients illimités.`
      : `Votre abonnement ${esc(pl.name)} est terminé. Vous n'apparaissez plus aux clients.`;
    warn = true;
  } else if(pl.clients==null){
    head = `<div class="sub-row"><div><span class="plan-name">${esc(pl.name)}</span><br><span class="big">Illimité</span> <span class="muted">clients ce mois-ci</span></div><span class="sm muted">jusqu'au ${until}</span></div>`;
    note = daysLeft<=3 ? `Votre abonnement se termine dans ${daysLeft} jour${daysLeft>1?"s":""} : pensez à le renouveler.` : "Acceptez autant de clients que vous voulez jusqu'à la fin du mois.";
  } else {
    const left = Math.max(0,p.credits), pct = Math.min(100, left/pl.clients*100);
    head = `<div class="sub-row"><div><span class="plan-name">${esc(pl.name)}</span><br><span class="big mono">${left}</span> <span class="muted">client${left>1?"s":""} garanti${left>1?"s":""} restant${left>1?"s":""}</span></div><span class="sm muted">sans date limite</span></div>
      <div class="sub-bar" aria-hidden="true"><i style="width:${pct}%"></i></div>`;
    note = (left===1 ? "Plus qu'un client : pensez à renouveler, ou passez à Pro. " : "") + GUARANTEE;
  }
  const showOffers = !active || (!pl?.guaranteed && daysLeft<=3) || (pl?.clients!=null && p.credits<=1) || S.showPlans;
  return `<div class="card sub ${warn?"empty-sub":""}">
    <h4>Ma formule</h4>${head}
    <p class="sm ${warn?"":"muted"}" style="margin:0;${warn?"color:var(--bad)":""}">${note}</p>
    ${showOffers ? `<div class="renew"><p class="sm" style="margin:0">Payez par ${esc(LK.PAYMENT.payMethods)} au <b class="mono">${esc(LK.PAYMENT.payTo)}</b>, puis envoyez la référence du paiement. Votre abonnement est activé dès la vérification. Vous gardez tout le prix de vos prestations et du déplacement.</p>
      <div class="plans-row three">${offer(LK.PLANS.simple,p,p.plan==="simple"&&active)}${offer(LK.PLANS.pro,p,p.plan==="pro"&&active)}${offer(LK.PLANS.commission,p,false)}</div></div>`
      : `<button class="btn ghost small" data-act="plans" style="justify-self:start">Voir les abonnements</button>`}
  </div>`;
}
function viewDash(){
  const p = S.pro;
  const live = S.orders.filter(o=>["sent","accepted","enroute","arrived"].includes(o.status));
  const past = S.orders.filter(o=>!live.includes(o)).slice(0,10);
  const services = S.edit || p.services;
  const offers = LK.SERVICES.map(s=>{
    const on = services[s.id]!=null;
    return `<div class="offer"><button class="switch" role="switch" aria-checked="${on}" aria-label="Proposer ${esc(s.name)}" data-act="toggle-svc" data-id="${s.id}"></button>
      <span class="nm">${esc(s.name)}<small>${s.cat} · ${fmtDur(s.dur)} · ${usd(LK.PRICES_FIXED||!on?s.price:services[s.id])}</small></span>
      ${LK.PRICES_FIXED ? `<span class="mono fixed-price" ${on?"":"style=\"opacity:.4\""}>${fmt(s.price)}</span>` : `<label class="price-in" ${on?"":"style=\"opacity:.4\""}><input id="price-${s.id}" type="number" min="1000" step="500" inputmode="numeric" value="${on?services[s.id]:s.price}" data-price="${s.id}" ${on?"":"disabled"} aria-label="Prix ${esc(s.name)}"><span class="sm">FC</span></label>`}</div>`;
  }).join("");
  const statusTxt = { done:"Terminée", refused:"Refusée", cancelled:"Annulée par le client", noshow:"Client absent" };
  return `<div class="appbar">${avatar(p,38)}<h2>${esc(p.name)}</h2>
      ${p.active ? `<span class="sm muted">${p.available?"Disponible":"Hors ligne"}</span><button class="switch" role="switch" aria-checked="${p.available}" aria-label="Disponible" data-act="avail"></button>`
        : `<span class="pill s-off">Profil indisponible</span>`}</div>
    <div class="body">
      ${pendingCard(p)}
      ${photoCard(p)}
      ${worksCard(p)}
      ${subCard(p)}
      ${live.length ? live.map(orderCard).join("") : `<div class="notice">${p.active&&(!p.photo||(p.works||[]).length<LK.WORKS.min)?`<b>Pour apparaître aux clients</b>, ajoutez ${[!p.photo&&"votre photo de profil",(p.works||[]).length<LK.WORKS.min&&`au moins ${LK.WORKS.min} photos de vos réalisations`].filter(Boolean).join(" et ")}.`:!p.active?(p.plan==="simple"?`<b>Votre profil n'est plus disponible pour les clients</b> : vous avez réalisé vos ${LK.PLANS.simple.clients} prestations La.Koiff Simple. Il redevient disponible dès que vous renouvelez votre abonnement (Simple ou Pro).`:"<b>Votre profil n'est pas disponible pour les clients</b> tant que votre abonnement n'est pas actif."):p.available?"Vous êtes visible par les clients proches. Les nouvelles demandes s'affichent ici et arrivent aussi sur votre WhatsApp.":"Vous êtes hors ligne : les clients ne vous voient pas."}</div>`}
      <div class="card"><h4>${LK.PRICES_FIXED?"Mes services":"Mes services et prix"}</h4>
        ${LK.PRICES_FIXED?`<p class="sm muted" style="margin:0">Activez les services que vous proposez. Les prix sont fixés par La.Koiff, les mêmes pour tous les coiffeurs. Vous gardez tout le prix et les frais de déplacement.</p>`:""}
        <div>${offers}</div>
        ${S.edit?`<button class="btn" data-act="save-svc">${LK.PRICES_FIXED?"Enregistrer mes services":"Enregistrer mes prix"}</button>`:""}</div>
      ${past.length?`<div class="card"><h4>Dernières demandes</h4><div class="lines">${past.map(o=>`<div><span>${esc(o.label)} · ${dayTxt(o.created)}</span><span class="sm muted">${statusTxt[o.status]||o.status}</span></div>`).join("")}</div></div>`:""}
      <div class="trust">${ICON.shield}<span>Profil vérifié depuis ${esc(p.since)} · ${p.jobs} prestations réalisées.<br>Les clients vous contactent sur WhatsApp au <b class="mono">+${esc(p.whatsapp)}</b></span></div>
      <button class="btn ghost" data-act="logout">Se déconnecter</button>
    </div>`;
}
function render(keep){
  const y = window.scrollY;
  $screen.innerHTML = S.pro ? viewDash() : viewLogin();
  if(keep) window.scrollTo(0,y);
  const enroute = S.orders.find(o=>o.status==="enroute");
  if(enroute){ UI.layoutMap(UI.routeFor(S.pro.id, enroute.loc, S.pro.base), false); UI.placeDot(0, S.lastPos || null); }
  syncGps();
}

/* ---------------- données ---------------- */
let es = null;
async function load(){
  try{
    const [me, list] = await Promise.all([api("/api/pro/me"), api("/api/pro/orders")]);
    S.pro = me.pro; S.orders = list.orders; render();
    if(es) es.close();
    es = new EventSource(`/api/pro/stream?t=${encodeURIComponent(S.token)}`);
    // À chaque reconnexion (connexion coupée par l'hébergeur ou le réseau), on recharge les demandes
    let opened = false;
    es.onopen = async () => {
      if(opened){ try{ const [me, list] = await Promise.all([api("/api/pro/me"), api("/api/pro/orders")]); S.pro = me.pro; S.orders = list.orders; render(true); }catch{} }
      opened = true;
    };
    es.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if(m.type==="pro"){ S.pro = m.pro; return render(true); }
      const i = S.orders.findIndex(o=>o.id===m.order.id);
      if(i>=0) S.orders[i] = m.order; else S.orders.unshift(m.order);
      if(m.type==="new"){ toast("Nouvelle demande : "+m.order.label); try{ navigator.vibrate?.([200,100,200]); }catch{} }
      else if(m.order.status==="cancelled") toast("Le client a annulé : "+m.order.label);
      render(true);
    };
  }catch(e){ if(S.token) toast(e.message); render(); }
}
function logout(){ store.del("proToken"); S.token=null; S.pro=null; S.orders=[]; if(es) es.close(); stopGps(); location.href = "connexion.html#coiffeur"; }

/* ---------------- partage de position pendant le trajet ---------------- */
let watchId = null, lastSent = 0;
function syncGps(){
  const enroute = S.orders.some(o=>o.status==="enroute");
  if(enroute && watchId==null) startGps(); else if(!enroute && watchId!=null) stopGps();
}
function startGps(){
  if(!navigator.geolocation){ S.gps="err"; return; }
  watchId = navigator.geolocation.watchPosition(async pos=>{
    const {latitude:lat, longitude:lon} = pos.coords; S.lastPos = {lat, lon};
    if(S.gps!=="on"){ S.gps="on"; const n=document.getElementById("gps-note"); if(n) n.textContent="Votre position est partagée avec le client."; }
    UI.placeDot(0, S.lastPos);
    sendPos();
  }, ()=>{ S.gps="err"; const n=document.getElementById("gps-note"); if(n) n.textContent="Position indisponible : autorisez la localisation pour que le client vous suive."; },
  { enableHighAccuracy:true, maximumAge:10000, timeout:20000 });
}
/* Envoie la position au plus toutes les 15 s, en gardant toujours la plus récente */
let sendTimer = null;
function sendPos(){
  const wait = 15000 - (Date.now()-lastSent);
  if(wait > 0){ if(!sendTimer) sendTimer = setTimeout(()=>{ sendTimer=null; sendPos(); }, wait); return; }
  lastSent = Date.now();
  api("/api/pro/location", { method:"POST", body:S.lastPos }).catch(()=>{});
}
function stopGps(){ clearTimeout(sendTimer); sendTimer=null; if(watchId!=null) navigator.geolocation.clearWatch(watchId); watchId=null; S.gps=null; }

/* ---------------- actions ---------------- */
$screen.addEventListener("submit", async e=>{
  const f = e.target.closest("form[data-form]"); if(!f) return; e.preventDefault();
  const fd = new FormData(f), v = Object.fromEntries(fd), kind = f.dataset.form, btn = f.querySelector("button[type=submit]"); btn.disabled = true;
  const enter = async r => { S.token = r.token; store.set("proToken", r.token); S.auth = {tab:"login"}; if(location.hash) history.replaceState(null,"",location.pathname); await load(); };
  try{
    if(kind==="login") await enter(await UI.api("/api/pro/login", { method:"POST", body:{phone:v.phone, pin:v.pin} }));
    else if(kind==="signup"){
      const r = await UI.api("/api/pro/signup", { method:"POST", body:{ ...v, services: fd.getAll("services") } });
      if(r.needCode){ S.auth = {tab:"code", phone:v.phone}; return render(); }
      await enter(r); toast("Compte créé. L'équipe La.Koiff va vérifier votre profil.");
    }
    else if(kind==="code"){ await enter(await UI.api("/api/pro/verify", { method:"POST", body:{phone:S.auth.phone, code:v.code} })); toast("Compte créé. L'équipe La.Koiff va vérifier votre profil."); }
    else if(kind==="reset"){ await UI.api("/api/auth/reset", { method:"POST", body:{role:"pro", phone:v.phone} }); S.auth = {tab:"reset-code", phone:v.phone}; render(); }
    else if(kind==="reset-code"){ await enter(await UI.api("/api/auth/reset/confirm", { method:"POST", body:{role:"pro", phone:S.auth.phone, code:v.code, password:v.password} })); toast("Mot de passe changé."); }
  }catch(err){ btn.disabled = false; toast(err.message); }
});
$screen.addEventListener("click", async e=>{
  const t = e.target.closest("[data-act]"); if(!t || t.disabled) return;
  const a = t.dataset.act, id = t.dataset.id;
  try{
    if(["accept","refuse","depart","arrive","done","noshow"].includes(a)){
      t.disabled = true;
      const r = await api(`/api/pro/orders/${id}/${a}`, { method:"POST" });
      S.orders = S.orders.map(o=>o.id===id ? r.order : o);
      toast({accept:"Demande acceptée. Le client est prévenu.", refuse:"Demande refusée.", depart:"Bonne route ! Le client voit votre trajet.", arrive:"Le client sait que vous êtes arrivé.", done:"Prestation terminée. Merci !", noshow:"Commande annulée : client absent. Votre place est rendue."}[a]);
      if(a==="done"||a==="noshow"){ const me = await api("/api/pro/me"); S.pro = me.pro; }
      return render(true);
    }
    if(a==="auth-tab"){ S.auth = { tab:id, phone:S.auth.phone }; return render(); }
    if(a==="choose-plan"){ t.disabled = true; S.pro = (await api("/api/pro/plan", { method:"POST", body:{plan:id} })).pro; S.showPlans = false; toast("Formule commission activée : vous ne payez qu'après vos prestations."); return render(true); }
    if(a==="want-plan"){ api("/api/pro/plan", { method:"POST", body:{plan:id} }).then(r=>{ S.pro = r.pro; render(true); }).catch(()=>{}); return; }
    if(a==="del-work"){ t.disabled = true; S.pro = (await api(`/api/pro/works/${id}`, { method:"DELETE" })).pro; toast("Photo supprimée."); return render(true); }
    if(a==="plans"){ S.showPlans = true; return render(true); }
    if(a==="avail"){ S.pro = (await api("/api/pro/me", { method:"PATCH", body:{available:!S.pro.available} })).pro; return render(true); }
    if(a==="toggle-svc"){ S.edit = S.edit || {...S.pro.services}; if(S.edit[id]!=null) delete S.edit[id]; else S.edit[id]=svc(id).price; return render(true); }
    if(a==="save-svc"){ S.pro = (await api("/api/pro/me", { method:"PATCH", body:{services:S.edit} })).pro; S.edit=null; toast(LK.PRICES_FIXED ? "Services enregistrés. Les clients voient les services que vous proposez." : "Prix enregistrés. Les clients voient vos nouveaux tarifs."); return render(true); }
    if(a==="logout"){ try{ await api("/api/pro/logout", {method:"POST"}); }catch{} return logout(); }
  }catch(err){ toast(err.message); render(true); }
});
$screen.addEventListener("change", async e=>{
  const t = e.target;
  if(t.id==="work-svc"){ S.workSvc = t.value; return; }
  if(t.id==="works-in" && t.files?.length){
    const files = [...t.files].slice(0, LK.WORKS.max - (S.pro.works||[]).length), sid = document.getElementById("work-svc")?.value || S.workSvc || "";
    let added = 0;
    for(let i=0;i<files.length;i++){
      S.uploadingWorks = `${i+1}/${files.length}`; render(true);
      try{ const image = await resizePhoto(files[i], 900, false); S.pro = (await api("/api/pro/works", { method:"POST", body:{ image, serviceId:sid } })).pro; added++; }
      catch(err){ toast(err.message); }
    }
    S.uploadingWorks = null; render(true);
    if(added) toast(added>1 ? `${added} photos ajoutées.` : "Photo ajoutée.");
    return;
  }
  if(t.id==="photo-in" && t.files?.[0]){
    S.uploading = true; render(true);
    try{ const image = await resizePhoto(t.files[0]); S.pro = (await api("/api/pro/photo", { method:"POST", body:{ image } })).pro; toast("Photo enregistrée. Les clients la voient maintenant."); }
    catch(err){ toast(err.message); }
    S.uploading = false; return render(true);
  }
  if(!t.dataset.price) return;
  S.edit = S.edit || {...S.pro.services};
  const v = Math.max(1000, Math.round((+t.value||0)/500)*500); S.edit[t.dataset.price]=v; render(true);
});
window.addEventListener("resize", ()=>{ if(S.orders.some(o=>o.status==="enroute")) render(true); });
/* Profil indisponible : on vérifie chaque minute si l'abonnement a été renouvelé */
setInterval(async ()=>{
  if(!S.pro || S.pro.active) return;
  try{ const r = await api("/api/pro/me"); if(r.pro.active){ S.pro = r.pro; toast("Abonnement activé : votre profil est de nouveau disponible pour les clients."); render(true); } }catch{}
}, 60000);

if(S.token) load(); else location.replace("connexion.html#" + (location.hash==="#inscription" ? "coiffeur-inscription" : "coiffeur"));
})();
