"use client";

import { ChevronRight } from "lucide-react";
import { useGuestOrders } from "@/hooks/use-guest-orders";
import {
  ORDER_LABEL,
  ORDER_STAGES,
  ORDER_STAGE_INDEX,
  dotTone,
  isOpen,
} from "@/lib/order-status";

/**
 * Compact live tracker for the menu screen — a diner who has already ordered
 * shouldn't have to leave the menu to find out where their food is. Same query
 * and same status vocabulary as the full tracker on /order.
 */
export function OrderTrackerBar({ tableCode }: { tableCode: string }) {
  const { data: orders = [] } = useGuestOrders(tableCode);

  if (orders.length === 0) return null;

  // Oldest still-in-flight order, matching how /order picks its default tab;
  // once everything is served it falls back to the most recent.
  const ordered = [...orders].sort(
    (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)
  );
  const current = ordered.find((o) => isOpen(o.status)) ?? ordered[ordered.length - 1];

  const stageIndex = ORDER_STAGE_INDEX[current.status] ?? 0;
  const cancelled = current.status === "cancelled";
  const openCount = ordered.filter((o) => isOpen(o.status)).length;

  return (
    <a
      href={`/order?table=${tableCode}`}
      className="block border-t border-slate-200 bg-white px-4 py-2.5 transition hover:bg-slate-50"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotTone(current.status)}`} />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="truncate text-xs font-semibold text-slate-900">
              {ORDER_LABEL[current.status] ?? current.status}
            </p>
            <span className="shrink-0 text-[11px] text-slate-400">
              {current.orderNumber ?? `#${current.id}`}
              {openCount > 1 && ` +${openCount - 1}`}
            </span>
          </div>

          {!cancelled && (
            <div className="mt-1.5 flex gap-1">
              {ORDER_STAGES.map((stage, i) => (
                <div
                  key={stage}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= stageIndex ? "bg-brand-600" : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-brand-600">
          Track
          <ChevronRight size={13} />
        </span>
      </div>
    </a>
  );
}
