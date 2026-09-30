// Offline cache. Bump VERSION (and APP_VERSION in index.html) on every change so phones pick up the new copy.
var VERSION = "split-log-v11";
var FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return Promise.all(FILES.map(function (f) {
      return fetch(new Request(f, { cache: "no-store" })).then(function (r) { if (r.ok) return c.put(f, r); });
    }));
  }));
  self.skipWaiting();
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// Network first, skipping the browser's own cache, so updates arrive as soon as they're online.
// Falls back to the saved copy when offline (e.g. gym basement).
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  var fresh = new Request(req.url, { cache: "no-store", credentials: "same-origin" });
  e.respondWith(
    fetch(fresh).then(function (r) {
      if (r.ok) { var copy = r.clone(); caches.open(VERSION).then(function (c) { c.put(req.url, copy); }); }
      return r;
    }).catch(function () {
      return caches.match(req.url, { ignoreSearch: true }).then(function (m) { return m || caches.match("./index.html"); });
    })
  );
});
