let audioCtx: AudioContext | null = null
let newOrderAudio: HTMLAudioElement | null = null

/**
 * New-order alert — a real audio file (served from the app's own /public),
 * distinct from the synthesized chime used for every other notification
 * type so staff can tell a new order apart by ear. Silently no-ops if the
 * asset is missing (e.g. an app that doesn't ship this file) or the browser
 * blocks autoplay before a user gesture.
 */
export function playNewOrderSound(): void {
  if (typeof window === "undefined" || typeof Audio === "undefined") return
  try {
    newOrderAudio ??= new Audio("/kitchensound.mpeg")
    newOrderAudio.volume = 1
    newOrderAudio.currentTime = 0
    void newOrderAudio.play().catch(() => {})
  } catch {
    // Missing asset or blocked autoplay — the toast still shows, so a silent
    // failure here is harmless.
  }
}

/**
 * Two-note chime (C6 -> E6) synthesized with Web Audio instead of shipping an
 * mp3 — keeps this asset-free and lets us skip licensing/sourcing a sound
 * file. Lazily creates one AudioContext and reuses it (browsers cap how many
 * can exist, and audioCtx.resume() handles the case it starts 'suspended'
 * because it was created before any user gesture).
 */
export function playNotificationChime(): void {
  if (typeof window === "undefined") return
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return

  audioCtx ??= new Ctx()
  if (audioCtx.state === "suspended") void audioCtx.resume()
  const ctx = audioCtx

  const notes = [
    { freq: 1046.5, start: 0, duration: 0.12 },
    { freq: 1318.5, start: 0.1, duration: 0.18 },
  ]
  for (const { freq, start, duration } of notes) {
    const startAt = ctx.currentTime + start
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, startAt)
    gain.gain.linearRampToValueAtTime(0.25, startAt + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(startAt)
    osc.stop(startAt + duration)
  }
}
