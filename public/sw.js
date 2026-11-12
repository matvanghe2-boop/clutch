/**
 * Service worker de Clutch.
 *
 * Les pages passent d'abord par le réseau : en ligne, on voit toujours les
 * données et la version du jour. Le cache ne sert qu'hors connexion (métro,
 * avion), avec la dernière version vue de chaque page. C'est voulu : SBD et
 * Fonte servaient d'abord le cache, et la première ouverture après un
 * déploiement montrait l'ancienne version.
 *
 * Les fichiers de /_next/static ont un nom qui change à chaque build : on peut
 * les servir du cache sans risque. Les logos d'équipes viennent de Liquipedia
 * et changent rarement : servis du cache, rafraîchis en arrière-plan.
 *
 * Liquipedia refuse ses images à une requête qui porte un Referer d'un autre site :
 * elle répond par une image « hotlinking is not allowed ». Le service worker les
 * redemande donc toujours sans Referer, quoi qu'ait fait la page. La version v3
 * vide les caches où cette image de refus a pu entrer (novembre 2026).
 *
 * Les scripts du réseau Orbit (header et écran de chargement) sont mis en
 * cache dès l'installation : hors connexion, sans eux, l'écran de chargement
 * resterait une page vide pendant 8 s avant de s'effacer.
 */
const VERSION = "v4";
const PAGES = `clutch-pages-${VERSION}`;
const ASSETS = `clutch-assets-${VERSION}`;
const LOGOS = `clutch-logos-${VERSION}`;
const ORBIT = `clutch-orbit-${VERSION}`;
const ORBIT_FILES = ["/orbit-header.js", "/orbit-splash.js"];
const NETWORK_TIMEOUT_MS = 4000;
const MAX_LOGOS = 300;

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([caches.open(PAGES).then((c) => c.add("/")), caches.open(ORBIT).then((c) => c.addAll(ORBIT_FILES))]).then(() =>
      self.skipWaiting(),
    ),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([PAGES, ASSETS, LOGOS, ORBIT]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  } else if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, ASSETS));
  } else if (url.origin === self.location.origin && ORBIT_FILES.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, ORBIT));
  } else if (url.hostname === "liquipedia.net" && url.pathname.startsWith("/commons/images/")) {
    event.respondWith(staleWhileRevalidate(withoutReferrer(request), LOGOS));
  }
});

/**
 * Les notifications (Web Push) : la synchro les envoie (src/lib/push), le service worker les
 * affiche même appli fermée. Une notification de même étiquette remplace la précédente : les
 * scores d'un même match ne s'empilent pas.
 */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Clutch", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Clutch", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/" },
    }),
  );
});

/** Au toucher : la page du match, dans l'appli déjà ouverte s'il y en a une. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.navigate(url).then((w) => (w || open).focus());
      return self.clients.openWindow(url);
    }),
  );
});

/**
 * Réseau d'abord. Au-delà de 4 s sans réponse, la dernière version en cache
 * dépanne ; s'il n'y en a pas, on attend quand même le réseau plutôt que
 * d'annoncer à tort qu'on est hors connexion.
 */
async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  network.catch(() => {});
  try {
    return await withTimeout(network, NETWORK_TIMEOUT_MS);
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      return await network;
    } catch {
      return (
        (await cache.match("/")) ??
        new Response("Hors connexion, et cette page n'a pas encore été ouverte.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
      );
    }
  }
}

async function cacheFirst(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      // Les logos sont chargés sans CORS : réponse opaque (status 0), cachable telle quelle.
      if (response.ok || response.type === "opaque") {
        await cache.put(request, response.clone());
        trim(cache, MAX_LOGOS);
      }
      return response;
    })
    .catch(() => hit);
  return hit ?? refresh;
}

/** La même image, demandée sans Referer et sans cookie : la seule forme que Liquipedia accepte. */
function withoutReferrer(request) {
  return new Request(request.url, { mode: "no-cors", credentials: "omit", referrerPolicy: "no-referrer" });
}

async function trim(cache, max) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
