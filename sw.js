/* Offline support: cache the app shell on install, serve from cache first, refresh in the background. */
const CACHE = "aural-v7";
const FILES = ["./", "./style.css", "./icon.svg", "./manifest.webmanifest", "./groups/", "./learning/",
  ...["theory", "synth", "ex_pitch", "ex_rhythm", "notation", "ex_extra", "exercises", "crib", "learning", "lessons", "progress", "plus", "app"].map((n) => `./js/${n}.js?v=7`)];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: false }).then((hit) => {
    const net = fetch(e.request).then((r) => { if (r.ok) caches.open(CACHE).then((c) => c.put(e.request, r.clone())); return r; }).catch(() => hit);
    return hit || net;
  }));
});
