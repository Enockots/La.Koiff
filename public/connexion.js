/* La.Koiff : page Connexion / Créer un compte (clients et coiffeurs) */
(function(){
const { esc, api, store } = UI;
const $form = document.getElementById("auth-form");
const S = { role:"client", mode:"login", phone:"", verify:false, reset:false, googleId:null, fbId:null, google:null };

/* Lien direct : connexion.html#client, #coiffeur, #client-inscription, #coiffeur-inscription */
function fromHash(){
  const h = location.hash.slice(1);
  S.role = h.startsWith("coiffeur") ? "pro" : "client";
  S.mode = h.endsWith("inscription") || h==="commande" ? "signup" : "login";
  S.forOrder = h==="commande" || !!store.get("pendingOrder", null);
}
fromHash();
api("/api/auth/config").then(c=>{ S.verify = !!c.verify; S.reset = !!c.reset; S.googleId = c.googleClientId || null; S.fbId = c.facebookAppId || null; render(); }).catch(()=>{});

const input = (id, label, attrs="", hint="") => `<div class="field"><label for="${id}">${label}</label><input id="${id}" ${attrs}>${hint?`<span class="hint">${hint}</span>`:""}</div>`;
const pass = (id, label, auto, hint="") => `<div class="field"><label for="${id}">${label}</label>
  <div class="pw"><input id="${id}" name="${id==="f-pass2"?"password2":"password"}" type="password" autocomplete="${auto}" minlength="6" required><button type="button" class="pw-toggle" data-for="${id}" aria-label="Afficher le mot de passe">Afficher</button></div>${hint?`<span class="hint">${hint}</span>`:""}</div>`;
const phoneField = () => input("f-phone","Numéro WhatsApp",`name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="Ex. : 0859 204 238" value="${esc(S.phone)}" required`);

function render(){
  const pro = S.role==="pro", m = S.mode;
  document.getElementById("role-client").setAttribute("aria-pressed", !pro);
  document.getElementById("role-pro").setAttribute("aria-pressed", pro);
  document.getElementById("tab-login").setAttribute("aria-selected", m==="login");
  document.getElementById("tab-signup").setAttribute("aria-selected", m==="signup");
  document.querySelector(".tabs").hidden = !["login","signup"].includes(m);
  document.querySelector(".seg").hidden = !["login","signup"].includes(m);
  const title = { login:"Connexion", signup: pro ? "Créer un compte coiffeur" : "Créer un compte client", code:"Vérification du numéro", reset:"Mot de passe oublié", "reset-code":"Nouveau mot de passe" }[m];
  const sub = {
    login: pro ? "Accédez à votre espace coiffeur : demandes, trajets et abonnement." : "Retrouvez votre adresse et vos commandes.",
    signup: pro ? "Recevez des clients près de chez vous. Votre profil est vérifié par l'équipe La.Koiff avant d'apparaître aux clients." : "Gardez votre adresse et suivez toutes vos commandes.",
    code: `Entrez le code à 6 chiffres envoyé sur WhatsApp au ${S.phone}.`,
    reset: "Recevez un code sur WhatsApp pour choisir un nouveau mot de passe.",
    "reset-code": `Entrez le code reçu sur WhatsApp au ${S.phone} et votre nouveau mot de passe.`
  }[m];
  document.getElementById("auth-title").textContent = title;
  document.getElementById("auth-sub").textContent = sub;
  let note = document.getElementById("order-note");
  if(!note){ note = document.createElement("div"); note.id = "order-note"; note.className = "order-note"; note.setAttribute("role","status"); document.getElementById("auth-sub").after(note); }
  note.hidden = !(S.forOrder && !pro && ["login","signup"].includes(m));
  note.innerHTML = `<b>Pour commander, créez votre compte</b> ou connectez-vous. C'est rapide, et votre commande vous attend : vous revenez directement au récapitulatif.`;
  let html = "";
  if(m==="login") html = phoneField() + pass("f-pass","Mot de passe","current-password")
    + `<button type="button" class="linkbtn" data-go="reset">Mot de passe oublié ?</button>`;
  else if(m==="signup"){
    html = (pro ? input("f-name","Nom complet ou nom du salon",`name="name" autocomplete="name" placeholder="Ex. : Grâce Kabeya" required`)
                : input("f-name","Votre prénom",`name="name" autocomplete="given-name" placeholder="Ex. : Merveille" required`))
      + phoneField()
      + (S.google ? "" : pass("f-pass","Mot de passe","new-password","6 caractères minimum.") + pass("f-pass2","Confirmez le mot de passe","new-password"));
    if(S.google) html = `<div class="g-linked">${S.google.provider==="facebook"?FB_LOGO:G_LOGO}<span>Compte ${S.google.provider==="facebook"?"Facebook":"Google"} : <b>${esc(S.google.email||"")}</b><br><span class="hint">Ajoutez votre numéro WhatsApp pour terminer.</span></span><button type="button" class="linkbtn inline" data-go="google-cancel">Annuler</button></div>` + html;
    if(pro) html += `<div class="field"><label for="f-commune">Commune où vous travaillez</label><select id="f-commune" name="commune" required><option value="">Choisissez…</option>${Object.keys(LK.COMMUNES).map(c=>`<option>${c}</option>`).join("")}</select></div>
      <div class="field"><label for="f-kind">Vous êtes</label><select id="f-kind" name="kind"><option>Coiffeur indépendant</option><option>Coiffeuse indépendante</option><option>Salon de coiffure</option></select></div>
      <div class="field"><label for="f-plan">Votre formule</label><select id="f-plan" name="plan">
        <option value="commission">${LK.PLANS.commission.name} : ${Math.round(LK.PLANS.commission.rate*100)} % par prestation, rien à payer d'avance</option>
        <option value="simple">${LK.PLANS.simple.name} : ${LK.PLANS.simple.price.toLocaleString("fr-FR").replace(/\u202f|\u00a0/g," ")} FC pour ${LK.PLANS.simple.clients} clients garantis</option>
        <option value="pro">${LK.PLANS.pro.name} : ${LK.PLANS.pro.price} $ par mois, clients illimités</option></select>
        <span class="hint">Vous pourrez changer de formule plus tard dans votre espace.</span></div>
      <fieldset class="field specs"><legend>Les services que vous proposez</legend><div class="chips wrapchips">${LK.SERVICES.map(s=>`<label class="chip chk"><input type="checkbox" name="services" value="${s.id}"><span>${esc(s.name)}</span></label>`).join("")}</div></fieldset>`;
    html += `<label class="check"><input type="checkbox" id="f-ok" name="ok" required> <span>J'accepte que La.Koiff me contacte sur WhatsApp au sujet de ${pro?"mon compte et des demandes de clients":"mes commandes"}.</span></label>`;
  }
  else if(m==="code") html = input("f-code","Code de vérification",`name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 chiffres" required`)
    + `<button type="button" class="linkbtn" data-go="signup">Changer de numéro ou renvoyer un code</button>`;
  else if(m==="reset") html = phoneField() + `<button type="button" class="linkbtn" data-go="login">Retour à la connexion</button>`;
  else if(m==="reset-code") html = input("f-code","Code reçu sur WhatsApp",`name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required`)
    + pass("f-pass","Nouveau mot de passe","new-password","6 caractères minimum.") + `<button type="button" class="linkbtn" data-go="reset">Renvoyer un code</button>`;
  const label = { login:"Se connecter", signup: pro ? "Créer mon compte coiffeur" : "Créer mon compte", code:"Valider", reset:"Recevoir un code", "reset-code":"Changer le mot de passe" }[m];
  $form.innerHTML = html + `<div class="form-error" id="f-error" role="alert" hidden></div><button class="btn" type="submit" id="f-submit">${label}</button>`;
  renderGoogle();
  document.getElementById("auth-foot").innerHTML = m==="login"
    ? `Pas encore de compte ? <button type="button" class="linkbtn inline" data-go="signup">Créer un compte</button>`
    : m==="signup" ? `${S.verify ? "Un code de vérification vous est envoyé sur WhatsApp. " : ""}Déjà un compte ? <button type="button" class="linkbtn inline" data-go="login">Se connecter</button>`
    : "";
}

/* ---------------- Continuer avec Google ---------------- */
const G_LOGO = `<svg class="g-logo" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;
let gisLoading = null;
function loadGis(){
  if(window.google?.accounts?.id) return Promise.resolve();
  return gisLoading ||= new Promise((ok, ko)=>{ const sc = document.createElement("script"); sc.src = "https://accounts.google.com/gsi/client"; sc.async = true; sc.onload = ok; sc.onerror = ko; document.head.appendChild(sc); });
}
async function onGoogle(resp){
  try{
    const r = await api("/api/auth/google", { method:"POST", body:{ role:S.role, credential:resp.credential } });
    if(r.token) return done(r);
    S.google = { pending:r.pending, email:r.email, provider:"google" }; S.mode = "signup"; render();
    const n = document.getElementById("f-name"); if(n && !n.value) n.value = r.name || "";
    document.getElementById("f-phone")?.focus();
  }catch(err){ showError(err.message); }
}
/* ---------------- Continuer avec Facebook ---------------- */
const FB_LOGO = `<svg class="g-logo" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#fff" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/></svg>`;
let fbLoading = null;
function loadFb(){
  if(window.FB) return Promise.resolve();
  return fbLoading ||= new Promise((ok, ko)=>{
    window.fbAsyncInit = () => { FB.init({ appId:S.fbId, cookie:false, xfbml:false, version:"v19.0" }); ok(); };
    const sc = document.createElement("script"); sc.src = "https://connect.facebook.net/fr_FR/sdk.js"; sc.async = true; sc.crossOrigin = "anonymous"; sc.onerror = ko; document.head.appendChild(sc);
  });
}
function facebookLogin(){
  if(!S.fbId || !window.FB) return showError(S.fbId ? "Facebook se charge, réessayez dans un instant." : "La connexion avec Facebook sera disponible une fois le site en ligne et configuré. En attendant, utilisez votre numéro WhatsApp.");
  FB.login(async resp=>{
    if(!resp?.authResponse?.accessToken) return showError("Connexion Facebook annulée.");
    try{
      const r = await api("/api/auth/facebook", { method:"POST", body:{ role:S.role, accessToken:resp.authResponse.accessToken } });
      if(r.token) return done(r);
      S.google = { pending:r.pending, email:r.email, provider:"facebook" }; S.mode = "signup"; render();
      const n = document.getElementById("f-name"); if(n && !n.value) n.value = r.name || "";
      document.getElementById("f-phone")?.focus();
    }catch(err){ showError(err.message); }
  }, { scope:"public_profile,email" });
}

function renderGoogle(){
  const area = document.getElementById("google-area");
  if(!["login","signup"].includes(S.mode) || S.google){ area.innerHTML = ""; return; }
  const label = S.mode==="signup" ? "S'inscrire avec Google" : "Continuer avec Google";
  const fbLabel = S.mode==="signup" ? "S'inscrire avec Facebook" : "Continuer avec Facebook";
  area.innerHTML = `<div class="g-wrap"><div id="g-btn"></div><button type="button" class="g-btn" id="g-fallback">${G_LOGO}<span>${label}</span></button></div>
    <button type="button" class="fb-btn" id="fb-btn">${FB_LOGO}<span>${fbLabel}</span></button>
    <div class="or"><span>ou avec votre numéro</span></div>`;
  if(S.fbId) loadFb().catch(()=>{});
  if(!S.googleId) return;   // Google pas configuré (ou aperçu) : bouton de remplacement
  loadGis().then(()=>{
    google.accounts.id.initialize({ client_id:S.googleId, callback:onGoogle, ux_mode:"popup", context: S.mode==="signup" ? "signup" : "signin" });
    const box = document.getElementById("g-btn"); if(!box) return;
    google.accounts.id.renderButton(box, { theme:"filled_black", size:"large", shape:"pill", text: S.mode==="signup" ? "signup_with" : "continue_with", width: Math.min(400, box.parentElement.clientWidth), locale:"fr", logo_alignment:"center" });
    document.getElementById("g-fallback")?.remove();
  }).catch(()=>{});
}

function showError(msg, fieldId){
  const box = document.getElementById("f-error"); box.textContent = msg; box.hidden = false;
  document.querySelectorAll("[aria-invalid]").forEach(el=>el.removeAttribute("aria-invalid"));
  if(fieldId){ const el = document.getElementById(fieldId); if(el){ el.setAttribute("aria-invalid","true"); el.focus(); } }
}
/* Le serveur n'est pas joignable (par exemple sur un aperçu sans serveur) */
const offline = e => /fetch|Failed|NetworkError|serveur ne répond/i.test(e.message);

function done(r){
  if(S.role==="pro"){ store.set("proToken", r.token); location.href = "pro.html"; }
  else { store.set("clientToken", r.token); location.href = store.get("pendingOrder", null) ? "app.html#reprendre" : "app.html#compte"; }
}

$form.addEventListener("submit", async e=>{
  e.preventDefault();
  const fd = new FormData($form), v = Object.fromEntries(fd), pro = S.role==="pro", base = pro ? "/api/pro" : "/api/client";
  // vérifications avant envoi
  if(["login","signup","reset"].includes(S.mode)){
    if(String(v.phone||"").replace(/\D/g,"").length < 9) return showError("Indiquez votre numéro WhatsApp, par exemple 0859 204 238.", "f-phone");
    S.phone = v.phone.trim();
  }
  if(S.mode==="signup"){
    if(!String(v.name||"").trim()) return showError(pro ? "Indiquez votre nom ou le nom de votre salon." : "Indiquez votre prénom.", "f-name");
    if(!S.google && String(v.password||"").length < 6) return showError("Choisissez un mot de passe d'au moins 6 caractères.", "f-pass");
    if(!S.google && v.password !== v.password2) return showError("Les deux mots de passe ne sont pas identiques.", "f-pass2");
    if(pro && !v.commune) return showError("Choisissez la commune où vous travaillez.", "f-commune");
    if(!v.ok) return showError("Cochez la case pour accepter d'être contacté sur WhatsApp.", "f-ok");
  }
  if(S.mode==="login" && !v.password) return showError("Indiquez votre mot de passe.", "f-pass");
  if(["code","reset-code"].includes(S.mode) && !/^\d{6}$/.test(String(v.code||"").trim())) return showError("Entrez le code à 6 chiffres.", "f-code");
  if(S.mode==="reset-code" && String(v.password||"").length < 6) return showError("Choisissez un mot de passe d'au moins 6 caractères.", "f-pass");

  const btn = document.getElementById("f-submit"), old = btn.textContent; btn.disabled = true; btn.textContent = "Patientez…";
  try{
    if(S.mode==="login") done(await api(base+"/login", { method:"POST", body: pro ? {phone:v.phone, pin:v.password} : {phone:v.phone, password:v.password} }));
    else if(S.mode==="signup"){
      const body = { name:v.name, phone:v.phone, ...(S.google ? { google:S.google.pending } : { password:v.password }), ...(pro ? { commune:v.commune, kind:v.kind, plan:v.plan, services: fd.getAll("services") } : {}) };
      const r = await api(base+"/signup", { method:"POST", body });
      if(r.needCode){ S.mode = "code"; return render(); }
      done(r);
    }
    else if(S.mode==="code") done(await api(base+"/verify", { method:"POST", body:{ phone:S.phone, code:v.code.trim() } }));
    else if(S.mode==="reset"){ await api("/api/auth/reset", { method:"POST", body:{ role:S.role, phone:v.phone } }); S.mode = "reset-code"; render(); }
    else if(S.mode==="reset-code") done(await api("/api/auth/reset/confirm", { method:"POST", body:{ role:S.role, phone:S.phone, code:v.code.trim(), password:v.password } }));
  }catch(err){
    btn.disabled = false; btn.textContent = old;
    showError(offline(err) ? "Connexion impossible pour le moment : le site n'est pas joignable. Vérifiez votre connexion Internet et réessayez." : err.message);
  }
});

document.addEventListener("click", e=>{
  const t = e.target;
  if(t.id==="role-client" || t.id==="role-pro"){ S.role = t.id==="role-pro" ? "pro" : "client"; return render(); }
  if(t.id==="tab-login" || t.id==="tab-signup"){ S.mode = t.id==="tab-signup" ? "signup" : "login"; return render(); }
  const go = t.closest("[data-go]"); if(go){ if(go.dataset.go==="google-cancel"){ S.google = null; S.mode = "login"; return render(); } S.mode = go.dataset.go; return render(); }
  if(t.closest("#fb-btn")) return facebookLogin();
  if(t.closest("#g-fallback")) return showError("La connexion avec Google sera disponible une fois le site en ligne et configuré. En attendant, utilisez votre numéro WhatsApp.");
  const tg = t.closest(".pw-toggle");
  if(tg){ const inp = document.getElementById(tg.dataset.for), show = inp.type==="password"; inp.type = show ? "text" : "password"; tg.textContent = show ? "Masquer" : "Afficher"; tg.setAttribute("aria-label", show ? "Masquer le mot de passe" : "Afficher le mot de passe"); }
});
window.addEventListener("hashchange", ()=>{ fromHash(); render(); });
render();
})();
