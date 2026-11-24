const CORE_CACHE = "roh-alquran-core-v6";
const MEDIA_CACHE = "roh-alquran-offline-media-v6";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CORE_CACHE && k !== MEDIA_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// استقبال أوامر تحميل كتب أو صوتيات محددة للعمل بدون إنترنت
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "CACHE_URLS" && Array.isArray(data.urls)) {
    event.waitUntil(
      caches.open(MEDIA_CACHE).then(async (cache) => {
        for (const u of data.urls) {
          try {
            const resp = await fetch(u);
            if (resp.ok) await cache.put(u, resp.clone());
          } catch (e) {}
        }
      })
    );
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // الملفات المتجددة (الفهرس والاختبارات والواجهة): الشبكة أولاً للتحديث التلقائي ثم الكاش عند انقطاع النت
  const isDynamicCatalog =
    url.pathname.endsWith("index.html") ||
    url.pathname.endsWith("/") ||
    url.pathname.includes("user_books_catalog.json") ||
    url.pathname.includes("quizzes.json") ||
    url.pathname.includes("audio_catalog.json") ||
    url.pathname.includes("audit_tracker.json");

  if (isDynamicCatalog) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CORE_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // الكتب المفتوحة والقرآن والأغلفة والصوتيات: الكاش أولاً لسرعة فائقة والعمل بدون إنترنت
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (
            res &&
            res.ok &&
            (url.pathname.includes("/data/user_books/") ||
              url.pathname.includes("/data/covers/") ||
              url.pathname.endsWith(".mp3") ||
              url.hostname.includes("quran-json") ||
              url.hostname.includes("fonts.g"))
          ) {
            const clone = res.clone();
            caches.open(MEDIA_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
