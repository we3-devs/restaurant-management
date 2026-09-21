import { io, type Socket } from "socket.io-client";
import { authFetch } from "./api";

/**
 * One shared /kds socket per tab, ref-counted across every consumer —
 * mirrors packages/api-client/src/realtime/kds-socket.ts, which staff-web
 * already uses for the same reason. Before this, useGuestOrders opened its
 * own ad hoc socket (and fetched its own ws-ticket) on every mount, so
 * navigating between /menu and /order — a completely normal thing for a
 * diner tracking their order to do — tore the connection down and paid for
 * a fresh ws-ticket round trip plus a fresh handshake each time, instead of
 * reusing one connection for the whole visit.
 */
async function fetchWsTicket(): Promise<string | null> {
  const res = await authFetch("/customer-auth/ws-ticket", { method: "POST" });
  if (!res.ok) return null;
  const body = (await res.json()) as { ticket: string };
  return body.ticket ?? null;
}

function resolveWsUrl(): string {
  const configured = process.env.NEXT_PUBLIC_GUEST_WS_URL;
  if (configured) return configured;
  const fallback =
    process.env.NEXT_PUBLIC_GUEST_API_URL?.replace(/\/api\/customer-backend\/?$/, "") ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return fallback;
}

let sharedSocket: Socket | null = null;
let refCount = 0;

/**
 * `auth` is a function, not a static `{ ticket }` object — same reasoning as
 * the staff kds-socket: the ws-ticket is single-use server-side, so Socket.IO
 * must fetch a fresh one on every connection attempt, including automatic
 * reconnects after a transient drop.
 */
export function acquireGuestSocket(): Socket {
  if (!sharedSocket) {
    sharedSocket = io(`${resolveWsUrl()}/kds`, {
      autoConnect: false,
      transports: ["websocket"],
      auth: (cb) => {
        fetchWsTicket()
          .then((ticket) => cb(ticket ? { ticket } : {}))
          .catch(() => cb({}));
      },
    });
  }
  refCount += 1;
  if (!sharedSocket.connected && !sharedSocket.active) {
    sharedSocket.connect();
  }
  return sharedSocket;
}

/** Pairs with acquireGuestSocket() — call once per consumer on cleanup. */
export function releaseGuestSocket(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
  }
}
