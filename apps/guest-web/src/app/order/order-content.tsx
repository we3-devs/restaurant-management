"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, CheckCircle, AlertCircle, ChefHat, Bell } from "lucide-react";
import { useGuestSession } from "@/hooks/use-guest-session";

interface OrderItem {
  id: number;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  food: { name: string } | null;
  foodVariant: { name: string } | null;
}

interface Order {
  id: number;
  orderNumber: string;
  status: string;
  grandTotal: number;
  items: OrderItem[];
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

const money = (n: number) => `Rs. ${Number(n || 0).toLocaleString("en-IN")}`;

// The stages a guest actually cares about, in kitchen order.
const STAGES = ["pending", "accepted", "preparing", "ready"] as const;

const STAGE_META: Record<
  string,
  { label: string; icon: React.ReactNode; tone: string }
> = {
  pending: {
    label: "Sent to kitchen",
    icon: <Clock size={18} />,
    tone: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  accepted: {
    label: "Accepted",
    icon: <CheckCircle size={18} />,
    tone: "bg-blue-50 text-blue-700 ring-blue-200",
  },
  preparing: {
    label: "Being prepared",
    icon: <ChefHat size={18} />,
    tone: "bg-orange-50 text-orange-700 ring-orange-200",
  },
  ready: {
    label: "Ready to serve",
    icon: <Bell size={18} />,
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  completed: {
    label: "Completed",
    icon: <CheckCircle size={18} />,
    tone: "bg-slate-100 text-slate-600 ring-slate-200",
  },
  cancelled: {
    label: "Cancelled",
    icon: <AlertCircle size={18} />,
    tone: "bg-red-50 text-red-700 ring-red-200",
  },
};

export default function OrderContent() {
  const { tableCode } = useGuestSession();

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["orders", tableCode],
    queryFn: async () => {
      const res = await fetch(
        `${API_URL}/orders/guest/mine?tableCode=${encodeURIComponent(tableCode!)}`
      );
      if (!res.ok) return [];
      const data = await res.json();
      // This endpoint returns a bare array, not the paginated {data,meta} envelope.
      return Array.isArray(data) ? data : (data.data ?? []);
    },
    refetchInterval: 5000,
    enabled: !!tableCode,
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-3">
          <div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
          <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
        </div>
      </div>
    );
  }

  const currentOrder = orders[0];

  if (!currentOrder) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
        <AlertCircle size={40} className="text-slate-300" />
        <h1 className="mt-4 text-lg font-semibold text-slate-900">
          No active orders
        </h1>
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

  const meta = STAGE_META[currentOrder.status] ?? STAGE_META.pending;
  const stageIndex = STAGES.indexOf(currentOrder.status as (typeof STAGES)[number]);
  const isTerminal =
    currentOrder.status === "completed" || currentOrder.status === "cancelled";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            Order {currentOrder.orderNumber ?? `#${currentOrder.id}`}
          </h1>
          <p className="text-xs text-slate-500">Table {tableCode}</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5 pb-28">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${meta.tone}`}
          >
            {meta.icon}
            {meta.label}
          </div>

          {!isTerminal && (
            <div className="mt-5 flex gap-1.5" aria-hidden>
              {STAGES.map((stage, i) => (
                <div
                  key={stage}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i <= stageIndex ? "bg-brand-600" : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
          )}

          {currentOrder.status === "ready" && (
            <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              Your order is ready — it will be with you shortly.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Items
          </h2>
          <ul className="divide-y divide-slate-100">
            {currentOrder.items?.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {item.food?.name ?? "Item"}
                    {item.foodVariant && (
                      <span className="text-slate-400"> · {item.foodVariant.name}</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {item.quantity} × {money(item.unitPrice)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-slate-900">
                  {money(item.totalAmount)}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
            <span className="text-sm text-slate-500">Total</span>
            <span className="text-lg font-semibold text-slate-900">
              {money(currentOrder.grandTotal)}
            </span>
          </div>
        </section>

        {orders.length > 1 && (
          <p className="text-center text-xs text-slate-400">
            + {orders.length - 1} earlier{" "}
            {orders.length - 1 === 1 ? "order" : "orders"} on this table
          </p>
        )}
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
