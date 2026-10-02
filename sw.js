// Offline-Speicher für den Stundenzettel.
// Bei jeder neuen Version der App VERSION hochzählen, dann lädt das iPhone alles neu.
const VERSION = "stundenzettel-v1";
const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./ZettelSans-Regular.ttf",
  "./ZettelSans-Bold.ttf",
];
const CDN_FILES = ["https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"];
const CACHEABLE_HOSTS = ["cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(APP_FILES);
    await Promise.all(CDN_FILES.map(async url => {
      try {
        const res = await fetch(url, { mode: "cors" });
        if (res.ok) await cache.put(url, res);
      } catch (err) { /* wird beim ersten Gebrauch nachgeladen */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== VERSION) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Die Seite selbst: erst aus dem Netz (für Updates), ohne Netz aus dem Speicher.
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) {
          const cache = await caches.open(VERSION);
          await cache.put("./index.html", res.clone());
        }
        return res;
      } catch (err) {
        return (await caches.match("./index.html")) || (await caches.match("./")) || Response.error();
      }
    })());
    return;
  }

  // Schriften, Icons, PDF-Bibliothek: erst aus dem Speicher, sonst aus dem Netz.
  if (url.origin !== self.location.origin && !CACHEABLE_HOSTS.includes(url.hostname)) return;
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res.ok || res.type === "opaque") {
        const cache = await caches.open(VERSION);
        await cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      return Response.error();
    }
  })());
});
