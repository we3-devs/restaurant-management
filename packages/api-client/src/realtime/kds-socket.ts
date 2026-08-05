import { io, type Socket } from "socket.io-client"
import { apiClient } from "../client"

const BACKEND_WS_URL = process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? "https://restaurant-management-g6vb.onrender.com"

/**
 * The browser only ever holds an httpOnly auth cookie (see
 * lib/auth/session.ts), never the JWT itself, so the socket handshake can't
 * use a normal Authorization header. Instead it redeems a short-lived
 * one-time ticket minted server-side by POST /auth/ws-ticket (proxied
 * through /api/backend, which already attaches the cookie-derived token).
 */
async function fetchWsTicket(): Promise<string> {
  const { ticket } = await apiClient<{ ticket: string }>("/auth/ws-ticket", { method: "POST" })
  return ticket
}

let sharedSocket: Socket | null = null
let refCount = 0

/**
 * One shared /kds connection per tab, ref-counted across every consumer
 * (notification bell, kitchen realtime, the global invalidation provider —
 * previously each opened its own socket independently).
 *
 * `auth` is a function, not a static `{ ticket }` object — Socket.IO calls
 * it fresh before *every* connection attempt, including automatic
 * reconnects. The ws-ticket is single-use server-side (redeemed and
 * deleted on first handshake, see kitchen-tickets.gateway.ts), so a static
 * captured ticket would make every reconnect after any transient drop
 * retry with an already-dead ticket, get disconnected, and back off
 * (Socket.IO's default reconnectionDelayMax is 5000ms) — that's what
 * produced the reported multi-second notification delays.
 */
export function acquireKdsSocket(): Socket {
  if (!sharedSocket) {
    sharedSocket = io(`${BACKEND_WS_URL}/kds`, {
      autoConnect: false,
      transports: ["websocket"],
      auth: (cb) => {
        fetchWsTicket()
          .then((ticket) => cb({ ticket }))
          .catch(() => cb({}))
      },
    })
  }
  refCount += 1
  if (!sharedSocket.connected && !sharedSocket.active) {
    sharedSocket.connect()
  }
  return sharedSocket
}

/** Pairs with acquireKdsSocket() — call once per consumer on cleanup. */
export function releaseKdsSocket(): void {
  refCount = Math.max(0, refCount - 1)
  if (refCount === 0 && sharedSocket) {
    sharedSocket.disconnect()
    sharedSocket = null
  }
}
