/* La.Koiff : service hors connexion. Les pages et images restent en mémoire sur le téléphone :
   l'appli s'ouvre vite même avec une connexion faible. Les commandes passent toujours par Internet. */
const VERSION = "lk-v7";
const CORE = ["./", "index.html", "app.html", "pro.html", "landing.css", "landing.js", "connexion.html", "connexion.css", "connexion.js", "style.css", "data.js", "art.js", "ui.js", "app.js", "pro.js",
  "kinshasa.webp", "manifest.webmanifest", "pro.webmanifest", "offline.html",
  "icons/icon-192.png", "icons/pro-icon-192.png", "icons/favicon.png",
  "photos/box.webp", "photos/knotless.webp", "photos/fulani.webp", "photos/boho.webp", "photos/nattes.webp"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  // Données en direct : jamais en cache
  if (url.origin === location.origin && (url.pathname.startsWith("/api/") || url.pathname.startsWith("/webhook"))) return;
  // Pages : réseau d'abord, version en mémoire si pas de connexion
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("offline.html"))));
    return;
  }
  // Fichiers du site et polices : mémoire d'abord, mise à jour en arrière-plan
  if (url.origin === location.origin || url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")) {
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(req, { ignoreSearch: true });
      const net = fetch(req).then(res => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
