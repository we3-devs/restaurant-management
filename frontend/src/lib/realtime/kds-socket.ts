import { io, type Socket } from "socket.io-client"
import { apiClient } from "@/lib/api/client"

const BACKEND_WS_URL = process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? "http://127.0.0.1:3001"

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

export async function connectKdsSocket(): Promise<Socket> {
  const ticket = await fetchWsTicket()
  return io(`${BACKEND_WS_URL}/kds`, {
    auth: { ticket },
    transports: ["websocket"],
  })
}
