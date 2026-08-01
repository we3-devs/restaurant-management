function urlBase64ToUint8Array(base64: string): BufferSource {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64Safe)
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0))).buffer
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window
}

export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscriptionJSON> {
  const registration = await navigator.serviceWorker.register("/sw.js")
  await navigator.serviceWorker.ready

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })

  return subscription.toJSON()
}

export async function unsubscribeFromPush(): Promise<string | null> {
  const registration = await navigator.serviceWorker.getRegistration("/sw.js")
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return null
  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  return endpoint
}
