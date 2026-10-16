/* Service worker JEDA (FR-8.1, NFR-4).
 * - Cangkang aplikasi dan aset build disimpan saat dipasang, jadi latihan bisa dibuka tanpa jaringan.
 * - Permintaan GET API tertentu memakai "jaringan dulu, simpanan bila putus".
 * - Penulisan (PUT/POST) tidak ditangani di sini; antreannya ada di aplikasi (src/lib/offline.ts).
 */
const VERSI = "jeda-v1";
const SHELL = `${VERSI}-shell`;
const API = `${VERSI}-api`;
const API_SIMPAN = [/^\/api\/konfigurasi$/, /^\/api\/saya$/, /^\/api\/kasus(\/[^/]+)?$/, /^\/api\/kartu$/, /^\/api\/jejak$/, /^\/api\/sesi\/aktif$/];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      const res = await fetch("/", { cache: "no-store" });
      const html = await res.clone().text();
      await cache.put("/", res);
      const aset = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
      await cache.addAll([...new Set(aset), "/manifest.webmanifest", "/favicon.png", "/icons/icon-192.png"]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (!k.startsWith(VERSI)) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  // Saat keluar akun, data API pribadi di perangkat dihapus.
  if (event.data === "hapus-api") event.waitUntil(caches.delete(API));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.startsWith("/api/")) {
    if (!API_SIMPAN.some((r) => r.test(url.pathname))) return;
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) (await caches.open(API)).put(req, res.clone());
          return res;
        } catch {
          const hit = await caches.match(req);
          if (hit) return hit;
          throw new Error("luring");
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) (await caches.open(SHELL)).put(req, res.clone());
        return res;
      })(),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          (await caches.open(SHELL)).put("/", res.clone());
          return res;
        } catch {
          return (await caches.match("/")) || Response.error();
        }
      })(),
    );
  }
});
