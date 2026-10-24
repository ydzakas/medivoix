const VERSION = "medivoix-shell-2";
const RACINE = new URL("./", self.location).pathname;
const vers = (chemin) => `${RACINE}${chemin.replace(/^\//, "")}`;
const SHELL = [
  RACINE,
  vers("index.html"),
  vers("mon-carnet.html"),
  vers("css/app.css"),
  vers("manifest.webmanifest"),
  vers("icons/icon-192.png"),
  vers("icons/icon-512.png"),
  vers("fonts/inter-400.woff2"),
  vers("fonts/inter-600.woff2"),
  vers("fonts/inter-700.woff2"),
  vers("vendor/supabase.js"),
  vers("vendor/qrcode.js"),
  vers("vendor/jsQR.js"),
  vers("js/config.js"),
  vers("js/format.js"),
  vers("js/ui.js"),
  vers("js/router.js"),
  vers("js/journal.js"),
  vers("js/dossier.js"),
  vers("js/auth.js"),
  vers("js/store.js"),
  vers("js/speech.js"),
  vers("js/mic.js"),
  vers("js/api.js"),
  vers("js/qr.js"),
  vers("js/rendu.js"),
  vers("js/fiche.js"),
  vers("js/main.js"),
  vers("js/pages.js"),
  vers("js/carnet.js"),
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cles) => Promise.all(cles.filter((cle) => cle !== VERSION).map((cle) => caches.delete(cle)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/api/")) return;
  const chemin = url.pathname.endsWith("/") ? url.pathname : url.pathname;
  if (!SHELL.includes(chemin)) return;
  event.respondWith(
    fetch(event.request)
      .then((reponse) => {
        if (reponse && reponse.ok) {
          const copie = reponse.clone();
          caches.open(VERSION).then((cache) => cache.put(event.request, copie));
        }
        return reponse;
      })
      .catch(() => caches.match(event.request)),
  );
});
