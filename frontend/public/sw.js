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
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      if (clients.length > 0) {
        return clients[0].focus()
      }
      return self.clients.openWindow("/")
    }),
  )
})
