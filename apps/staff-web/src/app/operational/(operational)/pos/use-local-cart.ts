"use client"

import { useCallback, useEffect, useState } from "react"

export type PackagingType = "plating" | "takeaway"

export interface LocalCartItem {
  localId: string
  foodId: number
  foodName: string
  foodVariantId: number | null
  variantName: string | null
  quantity: number
  unitPrice: number
  note: string
  packagingType: PackagingType
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
    (item: Omit<LocalCartItem, "localId" | "quantity" | "note" | "packagingType">) => {
      setItems((prev) => [
        ...prev,
        { ...item, localId: crypto.randomUUID(), quantity: 1, note: "", packagingType: "plating" },
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

  const updatePackagingType = useCallback((localId: string, packagingType: PackagingType) => {
    setItems((prev) => prev.map((item) => (item.localId === localId ? { ...item, packagingType } : item)))
  }, [])

  /**
   * Splits off `splitQuantity` units of a line into a second line with the
   * opposite packaging — how a "half takeaway, half plating" order gets
   * built from a single tap: the waiter adds one food line, then peels part
   * of the quantity into its own takeaway (or plating) line.
   */
  const splitPackaging = useCallback((localId: string, splitQuantity: number) => {
    setItems((prev) => {
      const source = prev.find((item) => item.localId === localId)
      if (!source || splitQuantity <= 0 || splitQuantity >= source.quantity) return prev
      const otherType: PackagingType = source.packagingType === "takeaway" ? "plating" : "takeaway"
      const splitOff: LocalCartItem = {
        ...source,
        localId: crypto.randomUUID(),
        quantity: splitQuantity,
        packagingType: otherType,
      }
      return prev.map((item) =>
        item.localId === localId ? { ...item, quantity: item.quantity - splitQuantity } : item,
      ).concat(splitOff)
    })
  }, [])

  const clear = useCallback(() => setItems([]), [])

  return {
    items,
    addItem,
    updateQuantity,
    updateNote,
    removeItem,
    updatePackagingType,
    splitPackaging,
    clear,
  }
}
