"use client"

import { useCallback, useEffect, useState } from "react"

export interface LocalCartItem {
  localId: string
  foodId: number
  foodName: string
  foodVariantId: number | null
  variantName: string | null
  quantity: number
  unitPrice: number
  note: string
}

function storageKey(orderId: number) {
  return `pos-local-cart:${orderId}`
}

function readCart(orderId: number): LocalCartItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.sessionStorage.getItem(storageKey(orderId))
    return raw ? (JSON.parse(raw) as LocalCartItem[]) : []
  } catch {
    return []
  }
}

/**
 * Cart the waiter builds by tapping food — stays entirely client-side (no
 * network) until "Place order" pushes it to the server in one batch request.
 * Persisted to sessionStorage per order so an accidental refresh mid-build
 * doesn't wipe it.
 */
export function useLocalCart(orderId: number) {
  const [items, setItems] = useState<LocalCartItem[]>(() => readCart(orderId))

  useEffect(() => {
    setItems(readCart(orderId))
  }, [orderId])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.sessionStorage.setItem(storageKey(orderId), JSON.stringify(items))
  }, [orderId, items])

  const addItem = useCallback(
    (item: Omit<LocalCartItem, "localId" | "quantity" | "note">) => {
      setItems((prev) => [...prev, { ...item, localId: crypto.randomUUID(), quantity: 1, note: "" }])
    },
    [],
  )

  const updateQuantity = useCallback((localId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((item) => (item.localId === localId ? { ...item, quantity: Math.max(1, quantity) } : item)),
    )
  }, [])

  const updateNote = useCallback((localId: string, note: string) => {
    setItems((prev) => prev.map((item) => (item.localId === localId ? { ...item, note } : item)))
  }, [])

  const removeItem = useCallback((localId: string) => {
    setItems((prev) => prev.filter((item) => item.localId !== localId))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  return { items, addItem, updateQuantity, updateNote, removeItem, clear }
}
