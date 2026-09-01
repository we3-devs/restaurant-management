/*
 * Dashboard service worker.
 *
 * This file must be served by the dashboard origin itself. The operational
 * app has its own worker, but service-worker registrations cannot cross
 * origins (or be shared between the two deployed applications).
 */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
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
      icon: "/icons/logo.png",
      data: payload.data ?? null,
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url ?? "/notifications"

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
