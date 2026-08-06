"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useLocalCart } from "./use-local-cart"

type LocalCartValue = ReturnType<typeof useLocalCart>

const LocalCartContext = createContext<LocalCartValue | null>(null)

/** One shared cart instance for the whole POS screen — FoodGrid adds to it, CartPanel/FloatingCart read and edit it. */
export function LocalCartProvider({ orderId, children }: { orderId: number; children: ReactNode }) {
  const cart = useLocalCart(orderId)
  return <LocalCartContext.Provider value={cart}>{children}</LocalCartContext.Provider>
}

export function useLocalCartContext() {
  const ctx = useContext(LocalCartContext)
  if (!ctx) throw new Error("useLocalCartContext must be used within a LocalCartProvider")
  return ctx
}
