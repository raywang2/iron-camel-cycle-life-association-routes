const CACHE_NAME = "iron-camel-routes-v1";
const CORE_ASSETS = [
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./data/routes.json",
  "./gpx/day-01.gpx",
  "./gpx/day-02.gpx",
  "./gpx/day-03.gpx",
  "./gpx/day-04.gpx",
  "./gpx/day-05.gpx",
  "./gpx/day-07.gpx",
  "./gpx/day-08.gpx",
  "./gpx/day-09.gpx",
  "./gpx/day-11.gpx",
  "./gpx/day-12.gpx",
  "./gpx/day-13.gpx",
  "./gpx/day-14.gpx",
];

function scopedUrl(path) {
  return new URL(path, self.registration.scope).toString();
}

async function cacheCoreAssets(cache) {
  const results = await Promise.allSettled(
    CORE_ASSETS.map((assetPath) => cache.add(scopedUrl(assetPath))),
  );

  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") {
      console.warn("Unable to precache asset", CORE_ASSETS[index], result.reason);
    }
  }
}

async function cacheShellAssets(cache) {
  const shellUrl = scopedUrl("./");
  const response = await fetch(shellUrl, { cache: "reload" });
  if (!response.ok) {
    throw new Error(`Unable to cache app shell: HTTP ${response.status}`);
  }

  await cache.put(shellUrl, response.clone());
  const html = await response.text();
  const assetUrls = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((assetPath) => assetPath && !assetPath.startsWith("http") && !assetPath.startsWith("data:"))
    .map((assetPath) => new URL(assetPath, shellUrl))
    .filter((url) => url.origin === self.location.origin)
    .map((url) => url.toString());

  const results = await Promise.allSettled(
    [...new Set(assetUrls)].map(async (assetUrl) => {
      const assetResponse = await fetch(assetUrl, { cache: "reload" });
      if (assetResponse.ok) {
        await cache.put(assetUrl, assetResponse);
      }
    }),
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("Unable to cache app shell asset", result.reason);
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.all([cacheCoreAssets(cache), cacheShellAssets(cache)]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstContent(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw new Error(`Offline content is not cached: ${request.url}`);
  }
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(scopedUrl("./"), response.clone());
    }
    return response;
  } catch {
    const cachedShell = await caches.match(scopedUrl("./"));
    if (cachedShell) {
      return cachedShell;
    }
    throw new Error("Offline shell is not cached");
  }
}

function isFreshContentRequest(requestUrl) {
  return (
    requestUrl.pathname.endsWith("/data/routes.json") ||
    (requestUrl.pathname.includes("/gpx/") && requestUrl.pathname.endsWith(".gpx"))
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  if (request.method !== "GET" || requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isFreshContentRequest(requestUrl)) {
    event.respondWith(networkFirstContent(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
