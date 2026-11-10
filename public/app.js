/* La.Koiff : application client */
(function(){
const { fmt, usd, fmtDur, esc, hhmm, dayTxt, svc, mdl, km, ICON, chev, pic, appbar, avatar, toast, api, store } = UI;
const $screen = document.getElementById("screen");
const CATS = ["Femme","Homme","Événement"];
const DEFAULT_LOC = { commune:"Gombe", quartier:"", avenue:"", repere:"", lat:null, lon:null };

const S = {
  screen:"home", cat:"Femme", modelId:null, serviceId:null, proId:null, pros:null, prices:store.get("prices", {}), slot:"now", when:null,
  loc: store.get("loc", DEFAULT_LOC), client: store.get("client", {name:"", phone:""}),
  order:null, token:null, pos:null, busy:false, gpsState:null, locBack:"home"
};
(function(){ const d=new Date(); d.setDate(d.getDate()+1); d.setHours(10,0,0,0); S.when=localISO(d); })();
function localISO(d){ const z=n=>String(n).padStart(2,"0"); return d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate())+"T"+z(d.getHours())+":"+z(d.getMinutes()); }
const address = l => [l.avenue, l.quartier, l.commune].filter(Boolean).join(", ");
const curLabel = () => (S.modelId && mdl(S.modelId)?.svc===S.serviceId) ? mdl(S.modelId).name : svc(S.serviceId).name;

/* ---------------- écrans ---------------- */
function viewHome(){
  const rows = LK.MODELS.filter(m=>m.cat===S.cat).map(m=>{
    const fp = S.prices[m.svc], sv = svc(m.svc);
    return `<button class="mrow" data-act="model" data-id="${m.id}" ${fp==null?"disabled":""}>
      <span class="nm"><b>${esc(m.name)}</b><span class="meta">${fmtDur(sv.dur)} · ${fp!=null?"dès "+fmt(fp):"indisponible"}</span></span>${chev}</button>`;
  }).join("");
  const o = S.order, active = o && ["sent","accepted","enroute","arrived"].includes(o.status);
  return `<div class="body">
    <button class="addr" data-act="loc" style="text-align:left;width:100%">${ICON.pin}<div style="flex:1;min-width:0"><span class="lbl">Le coiffeur vient à</span>
      <b class="one">${S.loc.avenue?esc(address(S.loc)):"Indiquez votre adresse"}</b>${S.loc.repere?`<span class="sm muted one">Repère : ${esc(S.loc.repere)}</span>`:""}</div>
      <span class="sm" style="color:var(--primary);font-weight:700">Modifier</span></button>
    ${active?`<button class="trust" data-act="track" style="border:0;text-align:left;background:var(--comb);color:var(--on-comb)">${ICON.scissors}<span><b>Commande en cours</b> · ${esc(o.label)} avec ${esc(o.pro.name)}. Voir le suivi →</span></button>`:""}
    <h2 class="hello">Choisissez votre modèle</h2>
    <div class="chips" role="group" aria-label="Catégories">${CATS.map(c=>`<button class="chip" data-act="cat" data-id="${c}" aria-pressed="${c===S.cat}">${c}</button>`).join("")}</div>
    <div class="mlist">${rows}</div>
    <div class="trust">${ICON.shield}<span>Chaque coiffeur est <b>vérifié</b> : pièce d'identité, diplôme ou expérience, et matériel contrôlés.</span></div>
  </div>`;
}
function viewModel(){
  const m = mdl(S.modelId), sv = svc(m.svc), fp = S.prices[m.svc];
  return appbar(m.name, "home") + `<div class="body two-col">
    <div class="photo">${pic(m)}</div>
    <div class="card"><div class="lines">
      <div><span>Prestation</span><span>${esc(sv.name)}</span></div>
      <div><span>Durée</span><span>${fmtDur(sv.dur)}</span></div>
      <div><span>Prix</span><span class="mono">${fp!=null?`dès ${fmt(fp)} <span class="muted">(${usd(fp)})</span>`:"indisponible"}</span></div>
    </div></div>
  </div>
  <div class="foot"><button class="btn" data-act="pick" data-id="${m.svc}">Voir les coiffeurs disponibles</button></div>`;
}
/* Profil d'un coiffeur : ses réalisations en grand, avant de le choisir */
function viewProProfile(){
  const p = (S.pros||[]).find(x=>x.id===S.profileId);
  if(!p){ S.screen = "list"; return viewList(); }
  const works = p.works || [];
  return appbar(p.name, "list") + `<div class="body">
    <div class="pro-head prof-head">${avatar(p, 72)}<div style="min-width:0"><b style="font-size:20px">${esc(p.name)}</b> ${p.verified?`<span class="badge">${ICON.check}Vérifié</span>`:""}
      <div class="sm muted">${esc(p.kind)} · ${p.jobs} prestations · depuis ${esc(p.since)}</div>
      <div class="sm muted">Arrivée ~${p.eta} min · ${km(p.km)} · ${fmt(p.price)} + ${fmt(p.fee)} de déplacement</div></div></div>
    <h3 class="sec-t">Ses réalisations</h3>
    <div class="gallery">${works.map((w,i)=>`<button class="g-item" data-act="zoom" data-id="${i}" aria-label="Agrandir la photo ${i+1}"><img src="${esc(w.url)}" alt="${esc(svc(w.serviceId)?.name || "Réalisation")}" loading="lazy">${w.serviceId?`<span>${esc(svc(w.serviceId)?.name||"")}</span>`:""}</button>`).join("")}</div>
    ${S.zoom!=null && works[S.zoom] ? `<div class="lightbox" data-act="unzoom" role="dialog" aria-label="Photo agrandie"><img src="${esc(works[S.zoom].url)}" alt="">
      <div class="lb-bar"><button class="btn ghost small" data-act="zoom" data-id="${(S.zoom-1+works.length)%works.length}">‹ Précédente</button><span class="sm">${S.zoom+1} / ${works.length}</span><button class="btn ghost small" data-act="zoom" data-id="${(S.zoom+1)%works.length}">Suivante ›</button></div>
      <button class="lb-close" data-act="unzoom" aria-label="Fermer">×</button></div>` : ""}
  </div>
  <div class="foot"><button class="btn" data-act="choose" data-id="${p.id}">Choisir ${esc(p.name.split(" ")[0])}</button></div>`;
}

function viewList(){
  const s = svc(S.serviceId), m = S.modelId && mdl(S.modelId)?.svc===s.id ? mdl(S.modelId) : null;
  let content;
  if(S.pros==null) content = `<div class="empty">Recherche des coiffeurs près de vous…</div>`;
  else if(!S.pros.length) content = `<div class="empty">Aucun coiffeur disponible pour ce service près de ${esc(S.loc.commune)} en ce moment.<br>Réessayez un peu plus tard.</div>`;
  else content = `<div class="pros-grid">${S.pros.map(p=>`
    <div class="pro">
      <div class="pro-head">${avatar(p)}<div style="flex:1;min-width:0"><b>${esc(p.name)}</b> ${p.verified?`<span class="badge">${ICON.check}Vérifié</span>`:""}<div class="sm muted">${esc(p.kind)} · ${p.jobs} prestations</div></div></div>
      ${p.works?.length ? `<button class="works-strip" data-act="pro-profile" data-id="${p.id}" aria-label="Voir les réalisations de ${esc(p.name)}">
        ${p.works.slice(0,4).map(w=>`<img src="${esc(w.url)}" alt="" loading="lazy">`).join("")}<span>Voir ses ${p.works.length} réalisations</span></button>` : ""}
      <div class="pro-stats">
        <div class="stat"><span>Arrivée</span><b>~${p.eta} min</b></div>
        <div class="stat"><span>Distance</span><b>${km(p.km)}</b></div>
        <div class="stat"><span>Prix</span><b>${fmt(p.price)}</b><small>${usd(p.price)}</small></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <span class="sm muted">+ ${fmt(p.fee)} (${usd(p.fee)}) de déplacement</span>
        <button class="btn small" data-act="choose" data-id="${p.id}">Choisir</button>
      </div>
    </div>`).join("")}</div>`;
  return appbar(m ? m.name : s.name, m ? "model" : "home") + `<div class="body">
    ${m?`<div class="mhero">${pic(m)}<div><b>${esc(m.name)}</b><div class="sm muted">${esc(s.name)} · ${fmtDur(s.dur)}</div></div></div>`:""}
    <p class="sm muted" style="margin:0">Coiffeurs près de ${esc(S.loc.commune)} · triés par heure d'arrivée</p>
    ${content}
  </div>`;
}
function viewCheckout(){
  const s = svc(S.serviceId), p = S.pros.find(x=>x.id===S.proId), total = p.price + p.fee;
  return appbar("Récapitulatif", "list") + `<div class="body">
    <div class="card"><div class="pro-head">${avatar(p)}<div><b>${esc(curLabel())}</b><div class="sm muted">avec ${esc(p.name)} · ${fmtDur(s.dur)}</div></div></div></div>
    <div class="card"><h4>Quand</h4>
      <div class="slots">${[["now","Dès que possible"],["plan","Planifier"]].map(([k,l])=>`<button class="chip" data-act="slot" data-id="${k}" aria-pressed="${S.slot===k}">${l}</button>`).join("")}</div>
      ${S.slot==="now"?`<span class="sm muted">Arrivée estimée vers <b class="mono">${hhmm(Date.now()+p.eta*60000)}</b></span>`
        :`<label class="addr" for="when-in" style="padding:8px 12px"><div style="flex:1"><span class="sm muted">Date et heure du rendez-vous</span><input id="when-in" type="datetime-local" value="${S.when}" min="${localISO(new Date())}"></div></label>`}
    </div>
    <div class="card"><h4>Où</h4><div class="sm">${S.loc.avenue?"":`<span style="color:var(--warn);font-weight:700">Adresse à compléter : indiquez votre avenue et un point de repère.</span><br>`}<b>${esc(address(S.loc))}</b>${S.loc.repere?`<br><span class="muted">Repère : ${esc(S.loc.repere)}</span>`:""}</div><button class="btn ghost small" data-act="loc">Changer d'adresse</button></div>
    ${S.account ? `<div class="card"><h4>Vos coordonnées</h4><div class="sm">Commande au nom de <b>${esc(S.account.name)}</b> · <span class="mono">+${esc(S.account.phone)}</span></div>
      <span class="sm muted">Vous recevez la confirmation et le suivi sur WhatsApp. La commande s'ajoute à votre compte.</span>
      <input type="hidden" id="c-name" value="${esc(S.account.name)}"><input type="hidden" id="c-phone" value="${esc(S.account.phone)}"></div>` : `<div class="card"><h4>Vos coordonnées</h4><p class="sm muted" style="margin:0">Chargement de votre compte…</p></div>`}
    <div class="card"><h4>Prix</h4><div class="lines">
      <div><span>${esc(curLabel())}</span><span class="mono">${fmt(p.price)}</span></div>
      <div><span>Déplacement (${km(p.km)})</span><span class="mono">${fmt(p.fee)}</span></div>
      <div class="total"><span>Total</span><span class="mono">${fmt(total)}</span></div>
      <div class="sm muted"><span>Soit environ</span><span class="mono">${usd(total).replace("≈ ","")}</span></div>
    </div><span class="sm muted">Réglé au coiffeur à la fin de la prestation.</span></div>
  </div>
  <div class="foot"><button class="btn" data-act="order" ${S.busy?"disabled":""}>${S.busy?"Envoi…":`Commander · ${fmt(total)}`}</button></div>`;
}
function viewLoc(){
  const l = S.loc;
  const msg = S.gpsState==="wait" ? `<div class="notice">Recherche de votre position…</div>`
    : S.gpsState==="ok" ? `<div class="notice">Position trouvée. Commune détectée : <b>${esc(l.commune)}</b>. Complétez l'avenue et un point de repère.</div>`
    : S.gpsState==="err" ? `<div class="notice">Impossible d'obtenir votre position. Autorisez la localisation dans votre navigateur, ou choisissez votre commune ci-dessous.</div>` : "";
  return appbar("Votre adresse", S.locBack) + `<div class="body">
    <button class="btn ghost" data-act="gps">${ICON.pin} Utiliser ma position actuelle</button>${msg}
    <div class="card form">
      <label for="loc-commune">Commune</label><select id="loc-commune">${Object.keys(LK.COMMUNES).map(c=>`<option ${c===l.commune?"selected":""}>${c}</option>`).join("")}</select>
      <label for="loc-quartier">Quartier</label><input id="loc-quartier" value="${esc(l.quartier)}" placeholder="Ex. : Righini, Matonge, Kingabwa…">
      <label for="loc-avenue">Avenue et numéro</label><input id="loc-avenue" value="${esc(l.avenue)}" placeholder="Ex. : Av. Kasa-Vubu, n° 45">
      <label for="loc-repere">Point de repère</label><textarea id="loc-repere" rows="2" placeholder="Ex. : en face de l'église, portail noir">${esc(l.repere)}</textarea>
      <span class="sm muted">Le point de repère aide le coiffeur à trouver votre porte.</span>
    </div>
  </div>
  <div class="foot"><button class="btn" data-act="loc-save">Enregistrer l'adresse</button></div>`;
}
function viewTrack(){
  const o = S.order;
  if(!o) return appbar("Suivi", "home") + `<div class="body"><div class="empty">Chargement de votre commande…</div></div>`;
  const p = o.pro;
  if(["refused","cancelled","noshow"].includes(o.status)) return appbar("Suivi", "home") + `<div class="body">
    <div class="empty"><b style="color:var(--ink);font-size:18px">${o.status==="refused"?esc(p.name)+" n'est pas disponible":o.status==="noshow"?esc(p.name)+" ne vous a pas trouvé":"Demande annulée"}</b><br>${o.status==="noshow"?"Votre coiffeur est venu mais vous étiez absent : la commande est annulée. ":""}Aucun montant n'est dû.</div>
    <button class="btn" data-act="pick" data-id="${o.serviceId}">Choisir un autre coiffeur</button></div>`;
  const block = (label, big, right="") => `<div class="eta"><div><div class="sm muted">${label}</div><div class="big mono">${big}</div></div>${right}</div>`;
  const left = etaLeft();
  const eta = o.status==="done" ? block("Prestation terminée","Merci&nbsp;!")
    : o.status==="arrived" ? block(`${esc(p.name)} est à votre porte`,"Arrivé")
    : o.status==="sent" ? block(`En attente de la réponse de ${esc(p.name)}`,"…", o.when?`<div style="text-align:right"><div class="sm muted">Rendez-vous</div><b class="mono">${hhmm(o.when)}</b></div>`:"")
    : o.status==="accepted" && o.when ? block(`Rendez-vous confirmé · ${dayTxt(o.when)}`, hhmm(o.when))
    : o.status==="accepted" ? block(`${esc(p.name)} a accepté · départ imminent`, hhmm(Date.now()+o.eta*60000))
    : block(S.pos?"En route · position en direct":"En route · arrivée prévue", `<span id="eta-big">${hhmm(Date.now()+left*60000)}</span>`, `<div style="text-align:right"><div class="sm muted">Temps restant</div><b class="mono" id="eta-min">${left} min</b></div>`);
  const wa = `https://wa.me/${p.whatsapp}?text=${encodeURIComponent(`Bonjour ${p.name.split(" ")[0]}, je suis votre client La.Koiff : ${o.label}, ${address(o.loc)}${o.loc.repere?" (repère : "+o.loc.repere+")":""}.`)}`;
  return appbar("Suivi de la commande", "home") + `<div class="body">
    ${UI.mapHtml()}
    ${eta}
    <div class="card">
      <div class="pro-head">${avatar(p)}<div style="flex:1"><b>${esc(p.name)}</b> <span class="badge">${ICON.check}Vérifié</span><div class="sm muted">${esc(o.label)} · ${fmt(o.price+o.fee)} (${usd(o.price+o.fee)})</div></div></div>
      ${o.status!=="done"?`<div class="callrow"><a class="btn small wa" href="${wa}" target="_blank" rel="noopener">${ICON.phone} WhatsApp ${esc(p.name.split(" ")[0])}</a></div>
        <p class="callnote">Ouvre la discussion WhatsApp avec votre coiffeur. Touchez l'icône téléphone dans WhatsApp pour l'appeler.</p>`:""}
    </div>
    ${o.status==="sent"?`<button class="btn ghost" data-act="cancel">Annuler la demande</button>`:""}
    ${o.status==="done"?`<button class="btn" data-act="reset">Nouvelle commande</button>`:""}
  </div>`;
}
/* Minutes restantes : position GPS du coiffeur si disponible, sinon temps écoulé depuis son départ */
function etaLeft(){
  const o = S.order; if(!o) return 0;
  if(S.pos?.etaLeft) return S.pos.etaLeft;
  if(o.status!=="enroute" || !o.departAt) return o.eta;
  return Math.max(1, Math.ceil(o.eta - (Date.now()-o.departAt)/60000));
}
function progress(){
  const o = S.order; if(!o) return 0;
  if(["arrived","done"].includes(o.status)) return 1;
  if(o.status!=="enroute" || !o.departAt) return 0;
  return Math.min(.95, (Date.now()-o.departAt)/(o.eta*60000));
}


/* ---------------- compte client ---------------- */
S.ctoken = store.get("clientToken", null); S.account = null; S.auth = {tab:"login"}; S.myOrders = null; S.authCfg = {};
const capi = (path, opts={}) => api(path, { ...opts, headers: { ...(opts.headers||{}), ...(S.ctoken ? { Authorization: "Bearer "+S.ctoken } : {}) } });
function useAccountLoc(){ if(S.account?.loc && !S.loc.avenue){ S.loc = S.account.loc; store.set("loc", S.loc); } }
function setSession(r){ S.ctoken = r.token; store.set("clientToken", r.token); S.account = r.client; useAccountLoc(); updateAccountBtn(); }
function updateAccountBtn(){ const b = document.getElementById("account-btn"); if(b) b.textContent = S.account ? S.account.name.split(" ")[0] : "Se connecter"; }
async function loadAccount(){
  api("/api/auth/config").then(c=>{ S.authCfg = c; }).catch(()=>{});
  if(!S.ctoken) return updateAccountBtn();
  try{ S.account = (await capi("/api/client/me")).client; useAccountLoc(); }
  catch(e){ if(/Session/.test(e.message)){ S.ctoken = null; store.del("clientToken"); } }
  updateAccountBtn(); if(["home","checkout","account"].includes(S.screen)) render(true);
}
async function loadMyOrders(){ try{ S.myOrders = (await capi("/api/client/orders")).orders; }catch{ S.myOrders = []; } if(S.screen==="account") render(true); }
const STATUS = { sent:"En attente", accepted:"Acceptée", enroute:"En route", arrived:"Arrivé", done:"Terminée", refused:"Refusée", cancelled:"Annulée", noshow:"Client absent" };
function viewAccount(){
  const back = S.accountBack || "home";
  if(S.account){
    const a = S.account, list = S.myOrders;
    return appbar("Mon compte", back) + `<div class="body" style="max-width:560px;width:100%;margin:0 auto">
      <div class="card"><div class="pro-head">${avatar({name:a.name, color:"#2F5BD3"})}<div><b>${esc(a.name)}</b><div class="sm muted mono">+${esc(a.phone)}</div></div></div></div>
      <div class="card"><h4>Mon adresse</h4><div class="sm">${S.loc.avenue ? `<b>${esc(address(S.loc))}</b>${S.loc.repere?`<br><span class="muted">Repère : ${esc(S.loc.repere)}</span>`:""}` : "Aucune adresse enregistrée."}</div>
        <button class="btn ghost small" data-act="loc">Modifier l'adresse</button></div>
      <div class="card"><h4>Mes commandes</h4>${list==null ? `<p class="sm muted" style="margin:0">Chargement…</p>`
        : list.length ? `<div class="olist">${list.map(o=>`<a class="orow" href="#suivi-${o.id}.${o.token}"><span><b>${esc(o.label)}</b><span class="sm muted">${dayTxt(o.created)} · ${esc(o.pro?.name||"")} · ${fmt(o.price+o.fee)}</span></span><span class="pill s-${o.status}">${STATUS[o.status]||o.status}</span></a>`).join("")}</div>`
        : `<p class="sm muted" style="margin:0">Vous n'avez pas encore commandé.</p>`}</div>
      <button class="btn ghost" data-act="logout">Se déconnecter</button>
      <p class="sm muted" style="text-align:center;margin:0">Vous êtes coiffeur ? <a href="pro.html">Espace coiffeur</a></p>
    </div>`;
  }
  const t = S.auth.tab, ph = esc(S.auth.phone || S.client.phone || "");
  const tabs = `<div class="role-switch auth-tabs" role="group" aria-label="Connexion ou inscription"><button type="button" data-act="auth-tab" data-id="login" aria-pressed="${t==="login"}">Se connecter</button><button type="button" data-act="auth-tab" data-id="signup" aria-pressed="${t==="signup"}">Créer un compte</button></div>`;
  let form;
  if(t==="login") form = `<form class="card form" data-form="login">
      <label for="a-phone">Numéro WhatsApp</label><input id="a-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" value="${ph}" placeholder="Ex. : 0859 204 238" required>
      <label for="a-pass">Mot de passe</label><input id="a-pass" name="password" type="password" autocomplete="current-password" required>
      <button class="btn" type="submit">Se connecter</button>
      <button class="linkbtn" type="button" data-act="auth-tab" data-id="reset">Mot de passe oublié ?</button></form>`;
  else if(t==="signup") form = `<form class="card form" data-form="signup">
      <label for="a-name">Votre prénom</label><input id="a-name" name="name" autocomplete="given-name" value="${esc(S.client.name||"")}" placeholder="Ex. : Merveille" required>
      <label for="a-phone">Numéro WhatsApp</label><input id="a-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" value="${ph}" placeholder="Ex. : 0859 204 238" required>
      <label for="a-pass">Mot de passe (6 caractères minimum)</label><input id="a-pass" name="password" type="password" autocomplete="new-password" minlength="6" required>
      <button class="btn" type="submit">Créer mon compte</button>
      <span class="sm muted">${S.authCfg.verify ? "Vous recevez un code de vérification sur WhatsApp. " : ""}Votre compte garde votre adresse et l'historique de vos commandes.</span></form>`;
  else if(t==="code" || t==="reset-code") form = `<form class="card form" data-form="${t}">
      <p class="sm" style="margin:0">Entrez le code à 6 chiffres reçu sur WhatsApp au <b class="mono">${esc(S.auth.phone)}</b>.</p>
      <label for="a-code">Code</label><input id="a-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required>
      ${t==="reset-code" ? `<label for="a-pass">Nouveau mot de passe</label><input id="a-pass" name="password" type="password" autocomplete="new-password" minlength="6" required>` : ""}
      <button class="btn" type="submit">Valider</button>
      <button class="linkbtn" type="button" data-act="auth-tab" data-id="${t==="code"?"signup":"reset"}">Changer de numéro ou renvoyer un code</button></form>`;
  else form = `<form class="card form" data-form="reset">
      <p class="sm" style="margin:0">Indiquez votre numéro : vous recevez un code sur WhatsApp pour choisir un nouveau mot de passe.</p>
      <label for="a-phone">Numéro WhatsApp</label><input id="a-phone" name="phone" type="tel" inputmode="tel" value="${ph}" required>
      <button class="btn" type="submit">Recevoir un code</button>
      <button class="linkbtn" type="button" data-act="auth-tab" data-id="login">Retour à la connexion</button></form>`;
  return appbar(t.startsWith("reset") ? "Mot de passe oublié" : "Mon compte", back) + `<div class="body" style="max-width:480px;width:100%;margin:0 auto">
    ${["login","signup"].includes(t) ? tabs : ""}${form}
    </div>`;
}
function afterAuth(msg){
  toast(msg); S.auth = {tab:"login"};
  if(S.accountBack==="checkout") S.screen = "checkout"; else { S.myOrders = null; loadMyOrders(); }
  render();
}
$screen.addEventListener("submit", async e=>{
  const f = e.target.closest("form[data-form]"); if(!f) return; e.preventDefault();
  const v = Object.fromEntries(new FormData(f)), kind = f.dataset.form, btn = f.querySelector("button[type=submit]"); btn.disabled = true;
  try{
    if(kind==="login"){ setSession(await api("/api/client/login", {method:"POST", body:v})); afterAuth("Bonjour "+S.account.name.split(" ")[0]+" !"); }
    else if(kind==="signup"){ const r = await api("/api/client/signup", {method:"POST", body:v}); S.client = { name:v.name, phone:v.phone };
      if(r.needCode){ S.auth = {tab:"code", phone:v.phone}; return render(); } setSession(r); afterAuth("Compte créé. Bienvenue "+v.name.split(" ")[0]+" !"); }
    else if(kind==="code"){ setSession(await api("/api/client/verify", {method:"POST", body:{phone:S.auth.phone, code:v.code}})); afterAuth("Compte créé. Bienvenue !"); }
    else if(kind==="reset"){ await api("/api/auth/reset", {method:"POST", body:{role:"client", phone:v.phone}}); S.auth = {tab:"reset-code", phone:v.phone}; render(); }
    else if(kind==="reset-code"){ setSession(await api("/api/auth/reset/confirm", {method:"POST", body:{role:"client", phone:S.auth.phone, code:v.code, password:v.password}})); afterAuth("Mot de passe changé."); }
  }catch(err){ btn.disabled = false; toast(err.message); }
});
document.getElementById("account-btn")?.addEventListener("click", ()=>{
  if(!S.ctoken){ location.href = "connexion.html#client"; return; }
  if(S.screen!=="account") S.accountBack = ["track","loc"].includes(S.screen) ? "home" : S.screen;
  S.screen = "account"; if(S.account){ S.myOrders = null; loadMyOrders(); } if(location.hash) history.replaceState(null,"",location.pathname); render();
});

/* ---------------- commander : compte obligatoire ---------------- */
function askAccount(){
  store.set("pendingOrder", { serviceId:S.serviceId, modelId:S.modelId, proId:S.proId, slot:S.slot, when:S.when, at:Date.now() });
  location.href = "connexion.html#commande";
}
/* Retour après inscription ou connexion : on reprend la commande là où elle était */
async function resumeOrder(){
  const po = store.get("pendingOrder", null); store.del("pendingOrder");
  if(!po || Date.now()-po.at > 2*3600e3 || !svc(po.serviceId)){ S.screen="home"; return render(); }
  Object.assign(S, { serviceId:po.serviceId, modelId:po.modelId, slot:po.slot||"now", when:po.when||S.when });
  S.screen = "list"; await loadPros();
  if(S.pros?.some(p=>p.id===po.proId)){ S.proId = po.proId; S.screen = "checkout"; render(); toast("Bienvenue ! Votre commande vous attend : vérifiez et confirmez."); }
  else toast("Ce coiffeur n'est plus disponible : choisissez-en un autre.");
}

/* ---------------- rendu ---------------- */
function render(keep){
  const y = window.scrollY;
  $screen.innerHTML = ({home:viewHome, model:viewModel, list:viewList, checkout:viewCheckout, loc:viewLoc, track:viewTrack, account:viewAccount, proProfile:viewProProfile})[S.screen]();
  if(keep) window.scrollTo(0,y); else if(render.last!==S.screen) window.scrollTo(0,0);
  render.last = S.screen;
  if(S.screen==="track" && S.order && !["refused","cancelled","noshow"].includes(S.order.status)){
    UI.layoutMap(UI.routeFor(S.order.pro.id, S.order.loc, S.order.pro.base), S.order.status==="sent");
    UI.placeDot(progress(), S.order.status==="enroute" ? S.pos : null);
  }
}
async function loadPrices(){ try{ S.prices = (await api("/api/prices")).from; store.set("prices", S.prices); }catch(e){ toast(navigator.onLine===false ? "Pas de connexion : prix de votre dernière visite." : e.message); } if(S.screen==="home"||S.screen==="model") render(true); }
async function loadPros(){
  S.pros = null; render();
  const q = new URLSearchParams({ service:S.serviceId, commune:S.loc.commune });
  if(S.loc.lat!=null){ q.set("lat",S.loc.lat); q.set("lon",S.loc.lon); }
  try{ S.pros = (await api("/api/pros?"+q)).pros; }catch(e){ S.pros = []; toast(e.message); }
  if(S.screen==="list") render();
}

/* ---------------- suivi en direct ---------------- */
let es = null;
function follow(id, token){
  if(es) es.close();
  S.token = token; S.pos = null;
  store.set("order", { id, token });
  es = new EventSource(`/api/orders/${encodeURIComponent(id)}/stream?token=${encodeURIComponent(token)}`);
  es.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if(m.type==="order"){ const before = S.order?.status; S.order = m.order; if(m.order.pro?.pos) S.pos = m.order.pro.pos;
      if(before && before!==m.order.status) toast(({accepted:"Votre coiffeur a accepté la demande.", refused:"Le coiffeur a refusé la demande.", enroute:"Votre coiffeur est en route.", arrived:"Votre coiffeur est arrivé.", done:"Prestation terminée. Merci !"})[m.order.status] || "Commande mise à jour.");
      if(S.screen==="track"||S.screen==="home") render(true); }
    if(m.type==="pos"){ S.pos = m; UI.placeDot(0, m); const em=document.getElementById("eta-min"); if(em){ em.textContent = m.etaLeft+" min"; document.getElementById("eta-big").textContent = hhmm(Date.now()+m.etaLeft*60000); } }
  };
  es.onerror = () => { if(S.order && ["done","refused","cancelled","noshow"].includes(S.order.status)) es.close(); };
}
setInterval(()=>{
  if(S.screen!=="track" || !S.order || S.order.status!=="enroute") return;
  if(!S.pos) UI.placeDot(progress());
  const em=document.getElementById("eta-min"); if(em && !S.pos){ const l=etaLeft(); em.textContent=l+" min"; document.getElementById("eta-big").textContent=hhmm(Date.now()+l*60000); }
}, 5000);
window.addEventListener("resize", ()=>{ if(S.screen==="track") render(true); });

/* ---------------- actions ---------------- */
$screen.addEventListener("click", async e=>{
  const t = e.target.closest("[data-act]"); if(!t || t.disabled) return;
  const a = t.dataset.act, id = t.dataset.id;
  switch(a){
    case "cat": S.cat=id; return render(true);
    case "pro-profile": S.profileId=id; S.zoom=null; S.screen="proProfile"; return render();
    case "zoom": e.stopPropagation(); S.zoom=+id; return render(true);
    case "unzoom": if(e.target.closest(".lb-bar")) return; S.zoom=null; return render(true);
    case "auth-tab": S.auth = { tab:id, phone:S.auth.phone }; return render();
    case "goto-account": return askAccount();
    case "logout": try{ await capi("/api/client/logout", {method:"POST"}); }catch{} S.ctoken=null; S.account=null; store.del("clientToken"); updateAccountBtn(); toast("Vous êtes déconnecté."); S.screen="home"; return render();
    case "model": S.modelId=id; S.serviceId=mdl(id).svc; S.screen="model"; return render();
    case "pick": S.serviceId=id; S.screen="list"; if(location.hash) history.replaceState(null,"",location.pathname); return loadPros();
    case "choose":
      S.proId=id; S.slot="now";
      if(!S.ctoken) return askAccount();   // pas encore de compte : inscription d'abord, la commande est gardée
      S.screen="checkout"; return render();
    case "back": S.screen=t.dataset.to; if(S.screen==="home" && location.hash) history.replaceState(null,"",location.pathname); return render();
    case "slot": S.slot=id; return render(true);
    case "track": location.hash = `suivi-${S.order.id}.${S.token}`; return;
    case "loc": S.locBack=S.screen; S.gpsState=null; S.screen="loc"; return render();
    case "loc-save": {
      const v = k => document.getElementById("loc-"+k).value.trim();
      const commune = v("commune");
      if(commune!==S.loc.commune && S.gpsState!=="ok"){ S.loc.lat=null; S.loc.lon=null; }
      Object.assign(S.loc, { commune, quartier:v("quartier"), avenue:v("avenue"), repere:v("repere") });
      if(!S.loc.avenue) return toast("Indiquez au moins l'avenue pour que le coiffeur vous trouve.");
      store.set("loc", S.loc); if(S.ctoken) capi("/api/client/me", {method:"PATCH", body:{loc:S.loc}}).catch(()=>{}); S.screen = S.locBack; toast("Adresse enregistrée : "+S.loc.commune);
      if(S.screen==="checkout"||S.screen==="list"){ S.screen="list"; return loadPros(); }
      return render(); }
    case "gps":
      if(!navigator.geolocation){ S.gpsState="err"; return render(true); }
      S.gpsState="wait"; render(true);
      navigator.geolocation.getCurrentPosition(pos=>{
        const {latitude:lat, longitude:lon} = pos.coords;
        Object.assign(S.loc, { lat, lon, commune: LK.nearestCommune(lat,lon) }); S.gpsState="ok"; render(true);
        const sel=document.getElementById("loc-commune"); if(sel) sel.value=S.loc.commune;
      }, ()=>{ S.gpsState="err"; render(true); }, { enableHighAccuracy:true, timeout:10000, maximumAge:60000 });
      return;
    case "order": {
      if(!S.ctoken) return askAccount();
      if(!S.account) return toast("Chargement de votre compte, réessayez dans un instant.");
      const name = S.account.name, phone = S.account.phone;
      S.client = { name, phone }; store.set("client", S.client);
      if(!S.loc.avenue){ S.locBack="checkout"; S.gpsState=null; S.screen="loc"; render(); return toast("Indiquez d'abord l'adresse où le coiffeur doit venir."); }
      if(S.slot==="plan"){ const w=document.getElementById("when-in").value; if(w) S.when=w; }
      S.busy = true; render(true);
      try{
        const r = await capi("/api/orders", { method:"POST", body:{
          serviceId:S.serviceId, modelId:S.modelId, proId:S.proId, client:{name, phone}, loc:S.loc,
          when: S.slot==="plan" ? new Date(S.when).toISOString() : null } });
        S.order = r.order; S.busy=false; location.hash = `suivi-${r.order.id}.${r.token}`;
      }catch(err){ S.busy=false; if(/compte ou connectez-vous|Session expirée/.test(err.message)){ S.ctoken=null; store.del("clientToken"); return askAccount(); } render(true); toast(err.message); }
      return; }
    case "cancel":
      try{ S.order = (await api(`/api/orders/${S.order.id}/cancel?token=${encodeURIComponent(S.token)}`, {method:"POST"})).order; render(true); }catch(err){ toast(err.message); }
      return;
    case "reset": store.del("order"); S.order=null; if(es) es.close(); S.screen="home"; history.replaceState(null,"",location.pathname); return render();
  }
});

/* Lien de suivi : #suivi-<id>.<jeton> (envoyé aussi par WhatsApp) */
function route(){
  if(location.hash==="#reprendre"){ history.replaceState(null,"",location.pathname); return resumeOrder(); }
  if(location.hash==="#compte"){ S.screen="account"; S.accountBack="home"; history.replaceState(null,"",location.pathname); render(); if(S.ctoken){ S.myOrders=null; loadMyOrders(); } return; }
  const md = location.hash.match(/^#modele-([\w-]+)$/);
  if(md && mdl(md[1])){ S.modelId=md[1]; S.serviceId=mdl(md[1]).svc; S.cat=mdl(md[1]).cat; S.screen="model"; history.replaceState(null,"",location.pathname); return render(); }
  const cat = location.hash.match(/^#categorie-(\w+)$/);
  if(cat){ S.cat = cat[1]==="evenement" ? "Événement" : cat[1]==="homme" ? "Homme" : "Femme"; S.screen="home"; history.replaceState(null,"",location.pathname); return render(); }
  const m = location.hash.match(/^#suivi-([\w-]+)\.([\w-]+)$/);
  if(m){ S.screen="track"; if(!S.order || S.order.id!==m[1]) S.order=null; render(); follow(m[1], m[2]); }
}
window.addEventListener("hashchange", route);
const saved = store.get("order", null);
if(location.hash) route();
else { render(); if(saved) follow(saved.id, saved.token); }
loadPrices();
loadAccount();
})();
