import { io, type Socket } from "socket.io-client"
import { customerApiClient } from "@rms/api-client/customer-client"

const BACKEND_WS_URL = process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? "https://restaurant-management-g6vb.onrender.com"

/**
 * Same /kds gateway and one-time-ticket handshake pattern as kds-socket.ts,
 * but minted by the customer-auth ws-ticket route (see
 * CustomerAuthController#issueWsTicket) — the backend keeps staff and guest
 * tickets in disjoint Redis keyspaces, so a guest socket only ever resolves
 * to `data.customerId` and gets auto-joined to its own `customer:<id>` room,
 * never an outlet room.
 */
async function fetchGuestWsTicket(): Promise<string> {
  const { ticket } = await customerApiClient<{ ticket: string }>("/customer-auth/ws-ticket", {
    method: "POST",
  })
  return ticket
}

let sharedSocket: Socket | null = null
let refCount = 0

/** One shared connection per tab, ref-counted across every guest-tracker consumer — mirrors acquireKdsSocket(). */
export function acquireGuestSocket(): Socket {
  if (!sharedSocket) {
    sharedSocket = io(`${BACKEND_WS_URL}/kds`, {
      autoConnect: false,
      transports: ["websocket"],
      auth: (cb) => {
        fetchGuestWsTicket()
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

/** Pairs with acquireGuestSocket() — call once per consumer on cleanup. */
export function releaseGuestSocket(): void {
  refCount = Math.max(0, refCount - 1)
  if (refCount === 0 && sharedSocket) {
    sharedSocket.disconnect()
    sharedSocket = null
  }
}
