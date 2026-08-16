/**
 * One source of truth for how order/item statuses read in the UI. Shared by
 * the full tracker (/order) and the compact bar on the menu, so the two can't
 * drift into describing the same order differently.
 */

export const ORDER_STAGES = ["Placed", "Accepted", "Preparing", "Ready", "Served"];

// partially_* sit at the same step as the stage they're partway through —
// the per-item track is where that detail actually lives.
export const ORDER_STAGE_INDEX: Record<string, number> = {
  pending: 0,
  accepted: 1,
  preparing: 2,
  partially_ready: 2,
  ready: 3,
  partially_served: 3,
  served: 4,
  completed: 4,
  cancelled: -1,
};

export const ORDER_LABEL: Record<string, string> = {
  pending: "Sent to kitchen",
  accepted: "Accepted",
  preparing: "Being prepared",
  partially_ready: "Partly ready",
  ready: "Ready to serve",
  partially_served: "Partly served",
  served: "Served",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const ITEM_STAGES = ["In cart", "Sent", "Preparing", "Ready", "Served"];

export const ITEM_STAGE_INDEX: Record<string, number> = {
  stock_reserved: 0,
  sent_to_kitchen: 1,
  preparing: 2,
  ready: 3,
  served: 4,
  cancelled: -1,
};

export const ITEM_LABEL: Record<string, string> = {
  stock_reserved: "Waiting to be sent",
  sent_to_kitchen: "Sent to kitchen",
  preparing: "Being prepared",
  ready: "Ready",
  served: "Served",
  cancelled: "Cancelled",
};

export const tone = (status: string) => {
  if (status === "cancelled") return "bg-red-50 text-red-700 ring-red-200";
  if (status === "served" || status === "completed")
    return "bg-slate-100 text-slate-600 ring-slate-200";
  if (status === "ready" || status === "partially_ready")
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "preparing")
    return "bg-orange-50 text-orange-700 ring-orange-200";
  if (status === "partially_served")
    return "bg-teal-50 text-teal-700 ring-teal-200";
  if (status === "accepted") return "bg-blue-50 text-blue-700 ring-blue-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
};

export const dotTone = (status: string) => {
  if (status === "cancelled") return "bg-red-500";
  if (status === "served" || status === "completed") return "bg-slate-400";
  if (status === "ready" || status === "partially_ready") return "bg-emerald-500";
  if (status === "preparing") return "bg-orange-500";
  return "bg-amber-500";
};

/** An order still needs watching until it's served, completed or cancelled. */
export const isOpen = (status: string) =>
  !["served", "completed", "cancelled"].includes(status);
