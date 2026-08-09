const CACHE_NAME = "rodado-control-v21";
const APP_SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
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

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

const API_PREFIXES = [
  "/auth",
  "/vehicles",
  "/places",
  "/maintenance",
  "/notifications",
  "/dashboard",
  "/users",
  "/admin",
  "/api",
];

function isApiRequest(requestUrl) {
  const pathname = new URL(requestUrl).pathname;
  return API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  if (isApiRequest(event.request.url)) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).catch(() =>
        new Response(JSON.stringify({ error: "Sin conexion" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
            return networkResponse;
          }

          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return networkResponse;
        })
        .catch(() => caches.match("/index.html"));
    })
  );
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
