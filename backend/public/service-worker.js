const CACHE_NAME = "rodado-control-v31";
const APP_SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/modernization.css",
  "/appearance.js",
  "/frontend-ui.js",
  "/app.js",
  "/vendor/write-excel-file-4.1.1/write-excel-file.min.js",
  "/dashboard-enhancements.js",
  "/manifest.json",
  "/logo.png",
  "/app-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/login-logo.png",
  "/splash-vertical.png",
  "/splash-logo-transparent.png",
  "/assets/icons/tabler/arrow-left.svg",
  "/assets/icons/tabler/bell.svg",
  "/assets/icons/tabler/bike.svg",
  "/assets/icons/tabler/bus.svg",
  "/assets/icons/tabler/car.svg",
  "/assets/icons/tabler/chart-line.svg",
  "/assets/icons/tabler/chevron-right.svg",
  "/assets/icons/tabler/dots-vertical.svg",
  "/assets/icons/tabler/edit.svg",
  "/assets/icons/tabler/eye.svg",
  "/assets/icons/tabler/file-description.svg",
  "/assets/icons/tabler/gauge.svg",
  "/assets/icons/tabler/home.svg",
  "/assets/icons/tabler/logout.svg",
  "/assets/icons/tabler/map-pin.svg",
  "/assets/icons/tabler/menu-2.svg",
  "/assets/icons/tabler/motorbike.svg",
  "/assets/icons/tabler/plus.svg",
  "/assets/icons/tabler/refresh.svg",
  "/assets/icons/tabler/settings.svg",
  "/assets/icons/tabler/steering-wheel.svg",
  "/assets/icons/tabler/tool.svg",
  "/assets/icons/tabler/trash.svg",
  "/assets/icons/tabler/truck.svg",
  "/assets/icons/tabler/user.svg",
  "/assets/icons/tabler/x.svg",
];

const STATIC_PATHS = new Set(APP_SHELL);

function isAllowedStaticRequest(request) {
  const url = new URL(request.url);
  const shellNavigation = request.mode === "navigate" && ["/", "/index.html"].includes(url.pathname);
  if (request.method !== "GET" || url.origin !== self.location.origin || (url.search && !shellNavigation) ||
      !STATIC_PATHS.has(url.pathname) || request.headers.has("Authorization") ||
      request.headers.has("Range")) return false;
  const destination = request.destination;
  if (url.pathname === "/" || url.pathname === "/index.html") {
    return request.mode === "navigate" || destination === "document";
  }
  return ["", "style", "script", "image", "manifest"].includes(destination);
}

function isAllowedStaticResponse(pathname, response) {
  if (!response || response.status !== 200 || response.type !== "basic" || response.redirected) return false;
  const mime = (response.headers.get("Content-Type") || "").split(";")[0].trim();
  if (pathname === "/" || pathname.endsWith(".html")) return mime === "text/html";
  if (pathname.endsWith(".js")) return ["application/javascript", "text/javascript"].includes(mime);
  if (pathname.endsWith(".css")) return mime === "text/css";
  if (pathname.endsWith(".json")) return ["application/json", "application/manifest+json"].includes(mime);
  return pathname.endsWith(".svg") ? mime === "image/svg+xml" : mime === "image/png";
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async (path) => {
      const response = await fetch(path, { credentials: "omit", cache: "reload" });
      if (!isAllowedStaticResponse(path, response)) throw new Error(`Invalid shell response: ${path}`);
      await cache.put(path, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (new URL(event.request.url).origin !== self.location.origin) return;
  if (!isAllowedStaticRequest(event.request)) {
    // Unknown routes, private images and APIs are always network-only.
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const url = new URL(event.request.url);
    const cacheKey = url.pathname;
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    try {
      const response = await fetch(event.request, { credentials: "omit" });
      if (isAllowedStaticResponse(url.pathname, response)) await cache.put(cacheKey, response.clone());
      return response;
    } catch (error) {
      if (event.request.mode === "navigate") {
        const shell = await cache.match("/index.html");
        if (shell) return shell;
      }
      throw error;
    }
  })());
});


self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (_error) {
    payload = {
      title: "Rodado Control",
      body: event.data ? event.data.text() : "Tienes una nueva notificacion.",
    };
  }

  const title = payload.title || "Rodado Control";
  const options = {
    body: payload.body || "Tienes una nueva notificacion.",
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
    tag: payload.tag || "rodado-control",
    renotify: Boolean(payload.renotify),
    data: {
      url: payload.data?.url || payload.url || "/",
      type: payload.data?.type || "general",
      vehicleId: payload.data?.vehicleId || null,
      maintenanceId: payload.data?.maintenanceId || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          return client.navigate(targetUrl).then(() => client.focus());
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return null;
    })
  );
});
