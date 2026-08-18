"use client";

import { useState } from "react";
import { AlertCircle, User, ChevronDown, Ban, Pause } from "lucide-react";
import { useGuestSession } from "@/hooks/use-guest-session";
import { useGuestAuth } from "@/hooks/use-guest-auth";
import { useGuestOrders } from "@/hooks/use-guest-orders";
import { GuestAuthSheet } from "@/components/guest-auth-sheet";
import { CardGridSkeleton } from "@/components/skeleton";
import {
  ITEM_LABEL,
  ITEM_STAGES,
  ITEM_STAGE_INDEX,
  ORDER_LABEL,
  ORDER_STAGES,
  ORDER_STAGE_INDEX,
  dotTone,
  isOpen,
  tone,
} from "@/lib/order-status";

const money = (n: number) => `Rs. ${Number(n || 0).toLocaleString("en-IN")}`;

function StageTrack({
  stages,
  index,
  cancelled,
}: {
  stages: string[];
  index: number;
  cancelled: boolean;
}) {
  if (cancelled) return null;
  return (
    <div>
      <div className="flex gap-1.5">
        {stages.map((stage, i) => (
          <div
            key={stage}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= index ? "bg-brand-600" : "bg-slate-200"
            }`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between">
        {stages.map((stage, i) => (
          <span
            key={stage}
            className={`text-[10px] ${
              i <= index ? "font-medium text-slate-600" : "text-slate-400"
            }`}
          >
            {stage}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function OrderContent() {
  const { tableCode } = useGuestSession();
  const { isAuthenticated } = useGuestAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const { data: orders = [], isLoading } = useGuestOrders(tableCode);

  const toggleItem = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!tableCode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-900">Invalid table code</p>
          <p className="mt-1 text-sm text-slate-500">
            Scan the QR code on your table to start ordering.
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
          <User size={40} className="text-slate-300" />
          <h1 className="mt-4 text-lg font-semibold text-slate-900">
            Log in to track your order
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Orders are tied to your phone number.
          </p>
          <button
            onClick={() => setAuthOpen(true)}
            className="mt-6 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.99]"
          >
            Log in
          </button>
          <a
            href={`/menu?table=${tableCode}`}
            className="mt-3 text-sm text-slate-500 underline underline-offset-4"
          >
            Back to menu
          </a>
        </div>
        {authOpen && (
          <GuestAuthSheet
            onClose={() => setAuthOpen(false)}
            onSuccess={() => setAuthOpen(false)}
          />
        )}
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto max-w-2xl">
          <CardGridSkeleton count={2} className="grid-cols-1" />
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
        <AlertCircle size={40} className="text-slate-300" />
        <h1 className="mt-4 text-lg font-semibold text-slate-900">No orders yet</h1>
        <p className="mt-1 text-sm text-slate-500">Table {tableCode}</p>
        <a
          href={`/menu?table=${tableCode}`}
          className="mt-6 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.99]"
        >
          Browse menu
        </a>
      </div>
    );
  }

  // API hands them back newest-first; tabs read oldest-first, left to right.
  const ordered = [...orders].sort(
    (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)
  );

  // Default to the oldest order still in flight — that's the one a diner is
  // actually waiting on. Falls back to the newest once everything is served.
  // Derived, not stored, so a poll can't yank the tab out from under a tap.
  const fallback = ordered.find((o) => isOpen(o.status)) ?? ordered[ordered.length - 1];
  const current = ordered.find((o) => o.id === pickedId) ?? fallback;

  const stageIndex = ORDER_STAGE_INDEX[current.status] ?? 0;
  const cancelled = current.status === "cancelled";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-4 py-3.5">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            Your orders
          </h1>
          <p className="text-xs text-slate-500">Table {tableCode}</p>
        </div>

        {ordered.length > 1 && (
          <nav className="mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {ordered.map((order) => (
              <button
                key={order.id}
                onClick={() => setPickedId(order.id)}
                aria-current={order.id === current.id}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
                  order.id === current.id
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    order.id === current.id ? "bg-white/70" : dotTone(order.status)
                  }`}
                />
                {order.orderNumber ?? `#${order.id}`}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5 pb-28">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${tone(current.status)}`}
            >
              {cancelled && <Ban size={16} />}
              {ORDER_LABEL[current.status] ?? current.status}
            </div>
            <span className="text-xs text-slate-400">
              {new Date(current.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          <div className="mt-5">
            <StageTrack
              stages={ORDER_STAGES}
              index={stageIndex}
              cancelled={cancelled}
            />
          </div>

          {current.status === "ready" && (
            <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              Your order is ready — it will be with you shortly.
            </p>
          )}
          {cancelled && (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              This order was cancelled. Ask a staff member if that looks wrong.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Items
          </h2>
          <ul className="divide-y divide-slate-100">
            {current.items?.map((item) => {
              const open = expanded.has(item.id);
              const itemCancelled = item.status === "cancelled";
              return (
                <li key={item.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {item.food?.name ?? "Item"}
                        {item.foodVariant && (
                          <span className="text-slate-400">
                            {" "}
                            · {item.foodVariant.name}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span>
                          {item.quantity} × {money(item.unitPrice)}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ${tone(item.status)}`}
                        >
                          {ITEM_LABEL[item.status] ?? item.status}
                        </span>
                        {item.isHeld && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 ring-1 ring-slate-200">
                            <Pause size={9} /> held
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {money(item.totalAmount)}
                      </p>
                      <button
                        onClick={() => toggleItem(item.id)}
                        aria-expanded={open}
                        aria-label={`${open ? "Hide" : "View"} tracking for ${item.food?.name ?? "item"}`}
                        className="flex items-center gap-0.5 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 active:scale-95"
                      >
                        {open ? "Hide" : "View"}
                        <ChevronDown
                          size={12}
                          className={`transition-transform ${open ? "rotate-180" : ""}`}
                        />
                      </button>
                    </div>
                  </div>

                  {open && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-3">
                      <StageTrack
                        stages={ITEM_STAGES}
                        index={ITEM_STAGE_INDEX[item.status] ?? 0}
                        cancelled={itemCancelled}
                      />
                      {itemCancelled && (
                        <p className="text-xs font-medium text-red-700">
                          Cancelled
                          {item.cancelReason ? ` — ${item.cancelReason}` : ""}
                        </p>
                      )}
                      {item.note && (
                        <p className="mt-2 text-xs text-slate-500">
                          Note: {item.note}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
            <span className="text-sm text-slate-500">Total</span>
            <span className="text-lg font-semibold text-slate-900">
              {money(current.grandTotal)}
            </span>
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <a
            href={`/menu?table=${tableCode}`}
            className="flex w-full items-center justify-center rounded-xl border border-slate-200 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]"
          >
            Back to menu
          </a>
        </div>
      </div>
    </div>
  );
}
