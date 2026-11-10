/* La.Koiff : fonctions d'affichage communes (client et coiffeur) */
(function(){
const CUR = "FC";
const fmt = n => Math.round(n).toLocaleString("fr-FR",{maximumFractionDigits:0}).replace(/ | /g," ") + " " + CUR;
const usd = n => { const v = n/LK.USD_RATE; return "≈ " + (v<10 ? (Math.round(v*10)/10).toString().replace(".",",") : Math.round(v)) + " $"; };
const fmtDur = m => m<60 ? m+" min" : Math.floor(m/60)+" h"+(m%60? " "+String(m%60).padStart(2,"0"):"");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const hhmm = d => new Date(d).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
const dayTxt = d => new Date(d).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
const initials = n => n.split(" ").map(x=>x[0]).join("").slice(0,2);
const svc = id => LK.SERVICES.find(s=>s.id===id);
const mdl = id => LK.MODELS.find(m=>m.id===id);
const km = k => String(k).replace(".",",")+" km";

const ICON = {
  pin:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  back:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  check:'<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
  shield:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6l8-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
  scissors:'<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12"/></svg>',
  phone:'<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1L6.6 10.8z"/></svg>'
};
const chev = `<span class="chev">${ICON.back}</span>`;
const pic = m => m.photo ? `<img src="${m.photo}" alt="${esc(m.name)}">` : window.art(m);
const appbar = (title, back) => `<div class="appbar">${back?`<button class="iconbtn" data-act="back" data-to="${back}" aria-label="Retour">${ICON.back}</button>`:""}<h2>${esc(title)}</h2></div>`;
const avatar = (p, size) => p.photo
  ? `<img class="avatar avatar-img" src="${esc(p.photo)}" alt="Photo de ${esc(p.name)}" loading="lazy"${size?` style="width:${size}px;height:${size}px"`:""}>`
  : `<span class="avatar" style="background:${esc(p.color)}${size?`;width:${size}px;height:${size}px;font-size:${Math.round(size/2.8)}px`:""}">${esc(initials(p.name))}</span>`;
/* Réduit une photo choisie sur le téléphone (carré centré, 512 px, JPEG) avant l'envoi */
function resizePhoto(file, size = 512, square = true){
  return new Promise((ok, ko)=>{
    if(!/^image\//.test(file.type)) return ko(new Error("Choisissez une image (photo JPG ou PNG)."));
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      if(square){ const s = Math.min(img.width, img.height); c.width = c.height = size;
        c.getContext("2d").drawImage(img, (img.width-s)/2, (img.height-s)/2, s, s, 0, 0, size, size); }
      else { const k = Math.min(1, size/Math.max(img.width, img.height)); c.width = Math.round(img.width*k); c.height = Math.round(img.height*k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); }
      URL.revokeObjectURL(url); ok(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); ko(new Error("Cette photo n'a pas pu être lue. Essayez une autre photo.")); };
    img.src = url;
  });
}

let toastTimer;
function toast(msg){
  let t = document.getElementById("toast");
  if(!t){ t = document.createElement("div"); t.id="toast"; t.className="toast"; t.setAttribute("role","status"); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(()=>{ t.hidden = true; }, 3200);
}
async function api(path, opts = {}){
  const res = await fetch(path, { ...opts, headers: { "Content-Type":"application/json", ...(opts.headers||{}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || "Le serveur ne répond pas. Vérifiez votre connexion.");
  return data;
}
const store = {
  get(k, d){ try{ const v = localStorage.getItem("lk."+k); return v==null ? d : JSON.parse(v); }catch{ return d; } },
  set(k, v){ try{ localStorage.setItem("lk."+k, JSON.stringify(v)); }catch{} },
  del(k){ try{ localStorage.removeItem("lk."+k); }catch{} }
};

/* ---------- carte de Kinshasa (image OpenStreetMap + trajet) ---------- */
function toPx(lat,lon){ const M=LK.MAP, n=2**M.z, r=lat*Math.PI/180;
  return [((lon+180)/360*n-M.x0)*256, ((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n-M.y0)*256]; }
function routeFor(proId, loc, base){
  const r = LK.ROUTES[proId+"|"+loc.commune]; let pts=[];
  if(r){ const f=r[2]; for(let i=0;i<f.length;i+=2) pts.push([f[i],f[i+1]]); }
  else { const a=LK.PRO_HOMES[proId]||LK.COMMUNES[base]||LK.COMMUNES[loc.commune], b=LK.COMMUNES[loc.commune]; pts=[toPx(a[0],a[1]), toPx(b[0],b[1])]; }
  if(loc.lat!=null && loc.lon!=null) pts.push(toPx(loc.lat, loc.lon));
  return pts;
}
const mapHtml = () => `<div class="map real" id="map" role="img" aria-label="Carte de Kinshasa avec le trajet du coiffeur">
  <div class="world" id="world"><img src="kinshasa.webp" alt="" draggable="false"></div><svg class="ov" id="ov"></svg>
  <span class="attr">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">contributeurs OpenStreetMap</a></span></div>`;
let VIEW=null, CUM=null, PTS=null;
function layoutMap(pts, dashed){
  const box = document.getElementById("map"); if(!box){ VIEW=null; return; }
  PTS = pts; const cw=box.clientWidth, ch=box.clientHeight, pad=34, M=LK.MAP;
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity; pts.forEach(([x,y])=>{x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);});
  const cover=Math.max(cw/M.w, ch/M.h);
  const sc=Math.max(cover, Math.min(1.6, Math.max(.22, Math.min((cw-2*pad)/Math.max(1,x1-x0),(ch-2*pad)/Math.max(1,y1-y0)))));
  const cl=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
  const tx=cl(cw/2-sc*(x0+x1)/2, cw-M.w*sc, 0), ty=cl(ch/2-sc*(y0+y1)/2, ch-M.h*sc, 0);
  VIEW={sc,tx,ty}; document.getElementById("world").style.transform=`translate(${tx}px,${ty}px) scale(${sc})`;
  const P=([x,y])=>[x*sc+tx,y*sc+ty];
  const d=pts.map((q,i)=>{const [a,b]=P(q); return (i?"L":"M")+a.toFixed(1)+" "+b.toFixed(1);}).join(" ");
  const [ex,ey]=P(pts[pts.length-1]);
  let acc=0; CUM=[0]; for(let i=1;i<pts.length;i++){ acc+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]); CUM.push(acc); }
  document.getElementById("ov").innerHTML = `
    <path d="${d}" fill="none" style="stroke:var(--surface)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
    <path d="${d}" fill="none" style="stroke:var(--primary)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" ${dashed?'stroke-dasharray="2 9"':""}/>
    <g transform="translate(${ex.toFixed(1)} ${ey.toFixed(1)})"><circle r="15" style="fill:var(--comb)" opacity=".3"/><circle r="8" style="fill:var(--comb);stroke:var(--surface)" stroke-width="3"/></g>
    <g transform="translate(${(ex+(ex>cw-60?-50:12)).toFixed(1)} ${(ey-12).toFixed(1)})"><rect x="0" y="-11" width="38" height="17" rx="8" style="fill:var(--surface)"/><text x="19" y="1" text-anchor="middle" font-size="11" font-weight="700" style="fill:var(--ink)" font-family="Figtree, sans-serif">Client</text></g>
    <g id="pro-dot"><circle r="12" style="fill:var(--ink);stroke:var(--bg)" stroke-width="3"/><g transform="translate(-7 -7) scale(.58)" style="color:var(--bg)">${ICON.scissors}</g></g>`;
}
/* Place le coiffeur sur le trajet (t entre 0 et 1) ou à une position GPS réelle */
function placeDot(t, gps){
  const dot=document.getElementById("pro-dot"); if(!dot||!VIEW) return;
  let x,y;
  if(gps){ [x,y]=toPx(gps.lat,gps.lon); }
  else { const L=CUM[CUM.length-1]*t; let i=1; while(i<CUM.length-1 && CUM[i]<L) i++;
    const seg=(CUM[i]-CUM[i-1])||1, f=Math.min(1,Math.max(0,(L-CUM[i-1])/seg));
    x=PTS[i-1][0]+(PTS[i][0]-PTS[i-1][0])*f; y=PTS[i-1][1]+(PTS[i][1]-PTS[i-1][1])*f; }
  dot.setAttribute("transform",`translate(${(x*VIEW.sc+VIEW.tx).toFixed(1)} ${(y*VIEW.sc+VIEW.ty).toFixed(1)})`);
}

window.UI = { resizePhoto, CUR, fmt, usd, fmtDur, esc, hhmm, dayTxt, initials, svc, mdl, km, ICON, chev, pic, appbar, avatar, toast, api, store, toPx, routeFor, mapHtml, layoutMap, placeDot };
})();

/* ---------- appli installable (écran d'accueil) ---------- */
(function(){
  if("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", ()=> navigator.serviceWorker.register("sw.js").catch(()=>{}));
  }
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const btn = () => document.getElementById("install-btn");
  let deferred = null;
  if(standalone) return;
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; const b = btn(); if(b) b.hidden = false; });
  window.addEventListener("appinstalled", () => { const b = btn(); if(b) b.hidden = true; UI.toast("La.Koiff est installée sur votre écran d'accueil."); });
  document.addEventListener("DOMContentLoaded", () => {
    const b = btn(); if(!b) return;
    if(isIOS) b.hidden = false;   // Safari ne propose pas de bouton : on explique la marche à suivre
    b.addEventListener("click", async () => {
      if(deferred){ deferred.prompt(); const r = await deferred.userChoice.catch(()=>null); deferred = null; if(r?.outcome === "accepted") b.hidden = true; return; }
      showIOSHelp();
    });
  });
  function showIOSHelp(){
    if(document.getElementById("ios-help")) return;
    const d = document.createElement("div");
    d.id = "ios-help"; d.className = "sheet-wrap"; d.setAttribute("role","dialog"); d.setAttribute("aria-label","Installer La.Koiff");
    d.innerHTML = `<div class="sheet"><h3>Installer La.Koiff sur votre iPhone</h3>
      <ol><li>Touchez le bouton <b>Partager</b> <span aria-hidden="true">⬆︎</span> en bas de Safari.</li>
      <li>Choisissez <b>Sur l'écran d'accueil</b>.</li><li>Touchez <b>Ajouter</b>.</li></ol>
      <p class="sm muted">L'icône La.Koiff apparaît alors avec vos autres applis. Sur Android, le bouton « Installer l'appli » le fait directement.</p>
      <button class="btn" id="ios-help-ok">J'ai compris</button></div>`;
    document.body.appendChild(d);
    const close = () => d.remove();
    d.addEventListener("click", e => { if(e.target === d || e.target.id === "ios-help-ok") close(); });
  }
})();
