/* All executable code and artwork are bundled. No cross-origin requests. */
const CACHE = "crownfall-v1";
const BASE = new URL("./", self.location.href).pathname;
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const response = await fetch(BASE, { cache: "reload" });
      if (!response.ok) throw new Error("Unable to cache the game shell");
      const html = await response.clone().text();
      await cache.put(BASE, response);
      const assets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
        .map((match) => new URL(match[1], self.location.origin + BASE))
        .filter(
          (url) => url.origin === self.location.origin && url.pathname !== BASE,
        );
      await cache.addAll(assets.map((url) => url.href));
      await cache.addAll(
        ["art/villager-blue.png", "art/villager-red.png"].map(
          (path) => new URL(path, self.location.origin + BASE).href,
        ),
      );
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith("crownfall-") && name !== CACHE)
          await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(event.request, { ignoreVary: true });
      if (hit) return hit;
      try {
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      } catch (error) {
        if (event.request.mode === "navigate") {
          const shell = await cache.match(BASE);
          if (shell) return shell;
        }
        throw error;
      }
    })(),
  );
});
