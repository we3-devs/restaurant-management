"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CheckCircle2Icon, DropletIcon, HandIcon, Loader2Icon, ReceiptIcon, UtensilsIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient } from "@/lib/api/client"
import type { CurrentCustomer } from "@/lib/auth/customer-dal"
import { usePublicFoodCategories, usePublicFoods } from "@/hooks/use-guest-menu"
import type { ServiceRequestType } from "@/hooks/use-service-requests"
import { GuestAuthGate } from "./guest-auth-gate"
import { GuestMenu } from "./guest-menu"
import { GuestOrderTracker } from "./guest-order-tracker"

interface GuestTable {
  id: number
  outletId: number
  name: string
  code: string | null
}

const REQUEST_OPTIONS: { type: ServiceRequestType; label: string; icon: typeof DropletIcon }[] = [
  { type: "water", label: "Need water", icon: DropletIcon },
  { type: "bill", label: "Need the bill", icon: ReceiptIcon },
  { type: "assistance", label: "Need assistance", icon: HandIcon },
]

export function GuestPageContent({ initialCustomer }: { initialCustomer: CurrentCustomer | null }) {
  return (
    <Suspense fallback={<GuestShell><Skeleton className="h-40 w-full max-w-md" /></GuestShell>}>
      <GuestPageInner initialCustomer={initialCustomer} />
    </Suspense>
  )
}

function GuestPageInner({ initialCustomer }: { initialCustomer: CurrentCustomer | null }) {
  const searchParams = useSearchParams()
  const tableCode = useMemo(() => (searchParams.get("table") ?? "").trim().toUpperCase(), [searchParams])

  const [table, setTable] = useState<GuestTable | null>(null)
  const [lookupFailed, setLookupFailed] = useState(false)
  const [requestedType, setRequestedType] = useState<ServiceRequestType | null>(null)
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<ServiceRequestType | null>(null)

  // Loading is derived: no table resolved yet and the lookup hasn't failed.
  const loadingTable = tableCode !== "" && !table && !lookupFailed
  const isVerifiedCustomer = initialCustomer?.type === "customer" && initialCustomer.sub !== null

  // Warms the menu cache as soon as /guest opens (even before the guest
  // finishes OTP verification) rather than waiting for the "Order yourself"
  // modal to mount — by the time it opens, GuestMenu's identical queries
  // just read from cache instead of showing "Loading menu...". A long
  // staleTime on these queries (see use-guest-menu.ts) keeps this cached
  // data alive for the rest of the visit instead of re-fetching it.
  usePublicFoodCategories()
  usePublicFoods({ limit: 60 })

  useEffect(() => {
    if (!tableCode) return
    let cancelled = false
    apiClient<GuestTable>(`/dining-tables/lookup?code=${encodeURIComponent(tableCode)}`)
      .then((result) => {
        if (!cancelled) setTable(result)
      })
      .catch((error) => {
        if (!cancelled) {
          setLookupFailed(true)
          toast.error(error instanceof Error ? error.message : "Table not found")
        }
      })
    return () => {
      cancelled = true
    }
  }, [tableCode])

  async function handleRequest() {
    if (!tableCode || !requestedType || sending) return
    setSending(true)
    try {
      await apiClient("/service-requests/guest", {
        method: "POST",
        body: JSON.stringify({ tableCode, type: requestedType, note: note.trim() || undefined }),
      })
      setSent(requestedType)
      setNote("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reach the waiter. Please ask in person.")
    } finally {
      setSending(false)
    }
  }

  if (!tableCode) {
    return (
      <GuestShell>
        <Card className="w-full max-w-md p-8 text-center">
          <p className="text-sm font-medium">No table code found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Scan the QR code on your table card to request service.
          </p>
        </Card>
      </GuestShell>
    )
  }

  if (loadingTable) {
    return (
      <GuestShell>
        <Skeleton className="h-40 w-full max-w-md" />
      </GuestShell>
    )
  }

  if (!table) {
    return (
      <GuestShell>
        <Card className="w-full max-w-md p-8 text-center">
          <p className="text-sm font-medium">We couldn&apos;t find table {tableCode}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Please double-check the code on your table card, or ask a staff member for help.
          </p>
        </Card>
      </GuestShell>
    )
  }

  return (
    <GuestShell>
      {isVerifiedCustomer && (
        <div className="mb-4">
          <GuestOrderTracker tableCode={tableCode} />
        </div>
      )}

      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="text-center">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            You are at table
          </p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight">{table.name}</h1>
        </div>

        {!isVerifiedCustomer ? (
          <div className="mt-6">
            <GuestAuthGate />
          </div>
        ) : sent ? (
          <div className="mt-8 flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2Icon className="size-12 text-emerald-500" />
            <p className="text-lg font-semibold">Request sent!</p>
            <p className="text-sm text-muted-foreground">
              A member of our team is on their way. Thank you for your patience.
            </p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setSent(null)}>
              Request something else
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-6 space-y-2.5">
              {REQUEST_OPTIONS.map((option) => {
                const Icon = option.icon
                const active = requestedType === option.type
                return (
                  <button
                    key={option.type}
                    type="button"
                    onClick={() => setRequestedType(option.type)}
                    className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-all ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <Icon className={`size-5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-sm font-medium">{option.label}</span>
                    <span
                      className={`ml-auto size-4 rounded-full border-2 ${
                        active ? "border-primary bg-primary" : "border-muted-foreground/40"
                      }`}
                      aria-hidden
                    />
                  </button>
                )
              })}
            </div>

            <div className="mt-4">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything specific? (optional)"
                maxLength={500}
              />
            </div>

            <Button
              className="mt-4 w-full"
              size="lg"
              disabled={!requestedType || sending}
              onClick={handleRequest}
            >
              {sending ? (
                <>
                  <Loader2Icon className="animate-spin" />
                  Sending...
                </>
              ) : (
                "Call a member of staff"
              )}
            </Button>
          </>
        )}
      </Card>

      {isVerifiedCustomer && (
        <Dialog>
          <DialogTrigger
            render={<Button className="mt-4 w-full max-w-md" size="lg" />}
          >
            <UtensilsIcon />
            Order yourself
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogTitle>Order food</DialogTitle>
            <GuestMenu tableCode={tableCode} />
          </DialogContent>
        </Dialog>
      )}
    </GuestShell>
  )
}

function GuestShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-6">
      {children}
      <p className="mt-6 text-xs text-muted-foreground">
        Need something else? Just wave or call out — we&apos;re here to help.
      </p>
    </div>
  )
}
