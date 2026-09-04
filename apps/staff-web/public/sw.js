// PWA caching, added alongside the push handlers below (there is only ever
// one service worker for this origin — do not register a second one; see
// push-subscribe.ts / register-sw.tsx, both of which register this same
// file). Versioned so a deploy can invalidate stale shell/image caches — bump
// this AND src/lib/app-version.ts's APP_VERSION together on any deploy that
// changes staff-PWA code, otherwise installed clients keep the old cached JS.
const CACHE_VERSION = "v3"
const SHELL_CACHE = `rms-shell-${CACHE_VERSION}`
const IMAGE_CACHE = `rms-images-${CACHE_VERSION}`
const API_CACHE = `rms-api-${CACHE_VERSION}`
const CURRENT_CACHES = new Set([SHELL_CACHE, IMAGE_CACHE, API_CACHE])

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(["/manifest.json", "/icons/icon.svg", "/icons/icon-maskable.svg"]))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !CURRENT_CACHES.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

/**
 * Network-first with a cache fallback for GET /api/* calls, so a kitchen
 * screen that briefly drops wifi can still show the last-known ticket list
 * instead of a hard error. Only successful, cookie-free GET responses are
 * cached — never a write, and never a response carrying Set-Cookie.
 */
async function handleApiRequest(request) {
  try {
    const response = await fetch(request)
    if (response.ok && !response.headers.has("set-cookie")) {
      const cache = await caches.open(API_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    const cached = await caches.match(request)
    if (cached) return cached
    throw error
  }
}

/** Cache-first for the static app shell (build assets, manifest, icons) — these are content-hashed or rarely change. */
async function handleShellRequest(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(SHELL_CACHE)
    cache.put(request, response.clone())
  }
  return response
}

/** Stale-while-revalidate for images — show the cached one instantly, refresh it in the background. */
async function handleImageRequest(request) {
  const cached = await caches.match(request)
  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        caches.open(IMAGE_CACHE).then((cache) => cache.put(request, response.clone()))
      }
      return response
    })
    .catch(() => undefined)
  return cached ?? (await network) ?? fetch(request)
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return // mutations always go straight to the network (or the offline mutation queue)

  const url = new URL(request.url)

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(handleApiRequest(request))
    return
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.json") {
    event.respondWith(handleShellRequest(request))
    return
  }
  if (request.destination === "image") {
    event.respondWith(handleImageRequest(request))
    return
  }
  if (request.destination === "font") {
    event.respondWith(handleShellRequest(request))
    return
  }
  // Everything else (page navigations, RSC payloads) goes straight to the
  // network — these can be per-user/auth-gated, so we never want to serve a
  // cached copy of someone else's screen.
})

self.addEventListener("push", (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: "Notification", body: event.data.text() }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Notification", {
      body: payload.body ?? "",
      icon: "/next.svg",
      // Carried through to notificationclick below for deep-linking —
      // notifications.service.ts (backend) sends { type, orderId }.
      data: payload.data ?? null,
    }),
  )
})

/** Kitchen-facing alert types land on the mobile kitchen board; the "ready" alert is what waitstaff act on. */
const KITCHEN_STAFF_NOTIFICATION_TYPES = new Set(["order_sent", "kitchen_recalled", "kitchen_cancelled", "kitchen_delayed"])

function staffDeepLinkFor(data) {
  if (!data || typeof data.type !== "string") return "/staff"
  if (KITCHEN_STAFF_NOTIFICATION_TYPES.has(data.type)) return "/staff/kitchen"
  if (data.type === "kitchen_ready") return "/staff/ready"
  // Order's fully delivered — billing is the next waiter action on it.
  if (data.type === "order_served") return "/staff/pos"
  return "/staff"
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = staffDeepLinkFor(event.notification.data)

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const existing = clients.find((client) => client.url.includes(targetUrl))
      if (existing) return existing.focus()
      if (clients.length > 0) {
        clients[0].focus()
        return clients[0].navigate(targetUrl)
      }
      return self.clients.openWindow(targetUrl)
    }),
  )
})
