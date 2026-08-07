"use client"

import { useCallback, useEffect, useState } from "react"

export interface LocalCartAddon {
  addonId: number
  addonName: string
  quantity: number
  unitPrice: number
}

export interface LocalCartItem {
  localId: string
  foodId: number
  foodName: string
  foodVariantId: number | null
  variantName: string | null
  quantity: number
  unitPrice: number
  note: string
  addons: LocalCartAddon[]
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
    (item: Omit<LocalCartItem, "localId" | "quantity" | "note" | "addons">) => {
      setItems((prev) => [
        ...prev,
        { ...item, localId: crypto.randomUUID(), quantity: 1, note: "", addons: [] },
      ])
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

  const addAddon = useCallback((localId: string, addon: LocalCartAddon) => {
    setItems((prev) =>
      prev.map((item) =>
        item.localId === localId && !item.addons.some((a) => a.addonId === addon.addonId)
          ? { ...item, addons: [...item.addons, addon] }
          : item,
      ),
    )
  }, [])

  const removeAddon = useCallback((localId: string, addonId: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.localId === localId
          ? { ...item, addons: item.addons.filter((a) => a.addonId !== addonId) }
          : item,
      ),
    )
  }, [])

  const clear = useCallback(() => setItems([]), [])

  return { items, addItem, updateQuantity, updateNote, removeItem, addAddon, removeAddon, clear }
}
