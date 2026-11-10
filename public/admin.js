/* La.Koiff : espace administrateur (vérifier les coiffeurs, activer les formules, enregistrer les paiements) */
(function(){
const { fmt, esc, toast, store, dayTxt } = UI;
const $s = document.getElementById("screen"), $out = document.getElementById("logout");
const S = { token: store.get("adminToken", null), data: null, filter: "todo" };
async function api(path, opts = {}){
  try{ return await UI.api(path, { ...opts, headers: { Authorization: "Bearer " + S.token } }); }
  catch(e){ if(/expirée/.test(e.message)){ store.del("adminToken"); S.token = null; render(); } throw e; }
}
function viewLogin(){
  return `<div class="body" style="max-width:420px;width:100%;margin:0 auto">
    <h2 class="hello">Espace administrateur</h2>
    <form class="card form" id="login"><label for="a-pw">Mot de passe administrateur</label>
      <input id="a-pw" type="password" autocomplete="current-password" required>
      <button class="btn" type="submit">Se connecter</button></form>
    <p class="sm muted">Le mot de passe se règle dans le réglage <b>ADMIN_PASSWORD</b> du site (variables d'environnement chez Hostinger).</p></div>`;
}
function proCard(p){
  const pl = LK.PLANS[p.plan], W = LK.WORKS;
  const planTxt = !pl ? "Aucune formule" : pl.rate != null ? `${pl.name} · dû ${fmt(p.commissionDue)}` : pl.guaranteed ? `${pl.name} · ${p.credits} clients garantis restants` : (p.planUntil > Date.now() ? `${pl.name} jusqu'au ${dayTxt(p.planUntil)}` : `${pl.name} terminé`);
  const c = (ok, txt) => `<span class="${ok?"chk-ok":"chk-no"}">${ok?"✓":"✗"} ${txt}</span>`;
  const services = Object.keys(p.services).map(k=>LK.SERVICES.find(s=>s.id===k)?.name).filter(Boolean).join(", ") || "aucun service";
  return `<div class="apro ${p.verified?"":"todo"}">
    <div class="apro-head">${UI.avatar(p, 56)}<div><b style="font-size:17px">${esc(p.name)}</b> ${p.visible?`<span class="badge">Visible</span>`:`<span class="pill s-off">Non visible</span>`}
      <div class="sm muted">0${esc(p.phone.slice(3))} · ${esc(p.base)} · ${esc(p.kind||"")} · ${p.done} prestation(s) sur La.Koiff</div>
      <div class="sm muted">${esc(planTxt)}${p.wantedPlan && p.wantedPlan!==p.plan ? ` · <b style="color:var(--warn)">souhaite ${esc(LK.PLANS[p.wantedPlan]?.name||"")}</b>` : ""}</div></div>
      <a class="btn small wa" style="text-decoration:none;width:auto" href="https://wa.me/${esc(p.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a></div>
    <div class="checks">${c(p.verified,"Vérifié")}${c(!!p.photo,"Photo de profil")}${c(p.worksCount>=W.min,`${p.worksCount} réalisation(s)`)}${c(p.active,"Formule active")}${c(p.available,"Disponible")}</div>
    <div class="sm muted">${esc(services)}</div>
    ${p.works?.length ? `<div class="thumbs">${p.works.map(w=>`<a href="${esc(w.url)}" target="_blank" rel="noopener"><img src="${esc(w.url)}" alt="Réalisation" loading="lazy"></a>`).join("")}</div>` : ""}
    <div class="actions">
      ${p.verified ? `<button class="btn ghost small" data-act="unverify" data-id="${p.id}">Retirer la vérification</button>` : `<button class="btn small" data-act="verify" data-id="${p.id}">Valider ce coiffeur</button>`}
      <button class="btn ghost small" data-act="plan" data-plan="simple" data-id="${p.id}">Activer Simple (10 000 FC)</button>
      <button class="btn ghost small" data-act="plan" data-plan="pro" data-id="${p.id}">Activer Pro (1 mois)</button>
      ${p.plan!=="commission"?`<button class="btn ghost small" data-act="plan" data-plan="commission" data-id="${p.id}">Passer à la commission</button>`:""}
    </div>
    ${S.newPw?.id===p.id ? `<div class="notice">Nouveau mot de passe : <b class="mono" style="user-select:all">${esc(S.newPw.pw)}</b>. Envoyez-le au coiffeur sur WhatsApp, puis il pourra le changer avec « Mot de passe oublié ».</div>` : ""}
    <div class="actions"><input id="ref-${p.id}" placeholder="Réf. paiement" aria-label="Référence du paiement">
      ${p.plan==="commission"?`<input id="amt-${p.id}" type="number" inputmode="numeric" placeholder="Montant FC" aria-label="Montant reçu"><button class="btn ghost small" data-act="pay" data-id="${p.id}">Enregistrer le paiement</button>`:""}
      <button class="btn ghost small" data-act="pw" data-id="${p.id}">Nouveau mot de passe</button></div>
  </div>`;
}
function viewDash(){
  const d = S.data; if(!d) return `<div class="body"><div class="empty">Chargement…</div></div>`;
  const st = d.stats;
  const list = d.pros.filter(p => S.filter==="all" ? true : S.filter==="todo" ? (!p.verified || (p.wantedPlan && p.wantedPlan!==p.plan) || (p.plan==="commission" && p.commissionDue>0)) : !p.visible);
  return `<div class="body">
    <div class="stats">
      <div class="stat-box"><span>Coiffeurs</span><b>${st.pros}</b></div>
      <div class="stat-box"><span>À vérifier</span><b style="color:${st.pending?"var(--warn)":"inherit"}">${st.pending}</b></div>
      <div class="stat-box"><span>Clients</span><b>${st.clients}</b></div>
      <div class="stat-box"><span>Commandes 24 h</span><b>${st.ordersToday}</b></div>
      <div class="stat-box"><span>Prestations faites</span><b>${st.ordersDone}</b></div>
      <div class="stat-box"><span>Commissions dues</span><b style="font-size:20px">${fmt(st.commissionsDue)}</b></div>
    </div>
    <div class="filter" role="group" aria-label="Filtre">${[["todo","À traiter"],["hidden","Non visibles"],["all","Tous"]].map(([k,l])=>`<button class="chip" data-act="filter" data-id="${k}" aria-pressed="${S.filter===k}">${l}</button>`).join("")}
      <button class="chip" data-act="refresh">Actualiser</button></div>
    <div class="pro-list">${list.length ? list.map(proCard).join("") : `<div class="empty">Rien à traiter pour le moment.</div>`}</div>
  </div>`;
}
function render(){ $s.innerHTML = S.token ? viewDash() : viewLogin(); $out.hidden = !S.token; }
async function load(){ try{ S.data = await api("/api/admin/overview"); }catch(e){ toast(e.message); } render(); }
$s.addEventListener("submit", async e=>{
  if(e.target.id!=="login") return; e.preventDefault();
  try{ const r = await UI.api("/api/admin/login", { method:"POST", body:{ password: document.getElementById("a-pw").value } }); S.token = r.token; store.set("adminToken", r.token); load(); }
  catch(err){ toast(err.message); }
});
$s.addEventListener("click", async e=>{
  const t = e.target.closest("[data-act]"); if(!t || t.disabled) return;
  const a = t.dataset.act, id = t.dataset.id;
  if(a==="filter"){ S.filter = id; return render(); }
  if(a==="refresh") return load();
  try{
    t.disabled = true;
    const ref = document.getElementById("ref-"+id)?.value || "";
    if(a==="verify"||a==="unverify"){ await api(`/api/admin/pros/${id}/verify`, { method:"POST", body:{ verified: a==="verify" } }); toast(a==="verify" ? "Coiffeur validé. Il est prévenu sur WhatsApp." : "Vérification retirée."); }
    if(a==="plan"){ await api(`/api/admin/pros/${id}/plan`, { method:"POST", body:{ plan: t.dataset.plan, months: 1, ref } }); toast("Formule activée. Le coiffeur est prévenu."); }
    if(a==="pay"){ const amount = +document.getElementById("amt-"+id).value; await api(`/api/admin/pros/${id}/commission-payment`, { method:"POST", body:{ amount, ref } }); toast("Paiement enregistré."); }
    if(a==="pw"){ const pw = Math.random().toString(36).slice(2,8) + Math.floor(Math.random()*90+10);
      await api(`/api/admin/pros/${id}/password`, { method:"POST", body:{ password: pw } });
      S.newPw = { id, pw }; toast("Mot de passe changé."); }
    await load();
  }catch(err){ t.disabled = false; toast(err.message); }
});
$out.addEventListener("click", ()=>{ store.del("adminToken"); S.token = null; S.data = null; render(); });
if(S.token) load(); else render();
})();
