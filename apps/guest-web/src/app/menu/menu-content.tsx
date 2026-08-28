"use client";

import { useState, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { useQuery, useQueries } from "@tanstack/react-query";
import {
  ShoppingCart,
  Minus,
  Plus,
  Send,
  X,
  Check,
  User,
  Users,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { useGuestSession } from "@/hooks/use-guest-session";
import { useGuestAuth } from "@/hooks/use-guest-auth";
import { useGuestOrders } from "@/hooks/use-guest-orders";
import { useBranding } from "@/hooks/use-branding";
import { GuestAuthSheet } from "@/components/guest-auth-sheet";
import { OrderTrackerBar } from "@/components/order-tracker-bar";
import { CardGridSkeleton } from "@/components/skeleton";
import { authFetch, getJson, readError } from "@/lib/api";

// These mirror the Public* projections from /foods/public,
// /food-categories/public and /food-variants/public — all deliberately
// narrower than the authenticated entities.
interface Food {
  id: number;
  foodCategoryId: number | null;
  name: string;
  shortDescription?: string | null;
  imageUrl: string | null;
  basePrice: number;
  hasVariants: boolean;
  hasAddons: boolean;
}

interface Category {
  id: number;
  parentId: number | null;
  name: string;
}

/** A sellable food item: this food paired with values from the global lists. */
interface Variant {
  id: number;
  foodId: number;
  variantId: number | null;
  subVariantId: number | null;
  name: string;
  price: number;
  isDefault: boolean;
}

/** One value from the shared variant / sub-variant lists. */
interface ListValue {
  id: number;
  name: string;
  sortOrder: number;
}

interface CartItem {
  key: string;
  food: Food;
  variant: Variant | null;
  /** "Veg · Full" for a nested pick, "Full" for a flat one. */
  variantLabel: string | null;
  unitPrice: number;
  quantity: number;
}

const money = (n: number) => `Rs. ${n.toLocaleString("en-IN")}`;
const cartKey = (foodId: number, variantId?: number | null) =>
  `${foodId}:${variantId ?? 0}`;

const UNCATEGORISED = -1;

export default function MenuContent() {
  const { tableCode } = useGuestSession();
  const { isAuthenticated, name: customerName } = useGuestAuth();
  const branding = useBranding();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [variantFor, setVariantFor] = useState<Food | null>(null);
  // Step 2 of the picker: which top-level group (Veg / Chicken) is open.
  const [variantGroup, setVariantGroup] = useState<Variant | null>(null);
  // Tracks why the gate opened: signing in from the header shouldn't silently
  // send an order just because the cart happens to be full.
  const [authIntent, setAuthIntent] = useState<"checkout" | "login" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Two-level menu: a category list, then that category's foods.
  const [openSection, setOpenSection] = useState<number | null>(null);

  const { data: foods = [], isLoading: foodsLoading } = useQuery<Food[]>({
    queryKey: ["foods"],
    queryFn: () => getJson("/foods/public?limit=200"),
    enabled: !!tableCode,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["food-categories"],
    queryFn: () => getJson("/food-categories/public?limit=200"),
    enabled: !!tableCode,
  });

  // The two shared option lists. Names live here; which combinations actually
  // exist (and what they cost) lives on each food's items.
  const { data: variantNames = [] } = useQuery<ListValue[]>({
    queryKey: ["variant-list", "variants"],
    queryFn: () => getJson("/variants/public"),
    staleTime: 5 * 60 * 1000,
    enabled: !!tableCode,
  });
  const { data: subVariantNames = [] } = useQuery<ListValue[]>({
    queryKey: ["variant-list", "sub-variants"],
    queryFn: () => getJson("/sub-variants/public"),
    staleTime: 5 * 60 * 1000,
    enabled: !!tableCode,
  });

  const nameOf = useCallback(
    (rows: ListValue[], id: number | null) =>
      id === null ? null : (rows.find((row) => row.id === id)?.name ?? null),
    []
  );

  // /food-variants/public takes one foodId at a time, so variant-bearing foods
  // are fetched in parallel. Prefetching (rather than loading on tap) is what
  // lets the cards show a truthful "from" price — a food's basePrice is not
  // reliably its cheapest variant.
  const variantFoods = useMemo(
    () => foods.filter((f) => f.hasVariants),
    [foods]
  );

  const variantResults = useQueries({
    queries: variantFoods.map((food) => ({
      queryKey: ["variants", food.id],
      queryFn: () => getJson(`/food-variants/public?foodId=${food.id}&limit=50`),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const variantsByFood = useMemo(() => {
    const map: Record<number, Variant[]> = {};
    variantFoods.forEach((food, i) => {
      const data = variantResults[i]?.data as Variant[] | undefined;
      if (data?.length) map[food.id] = data;
    });
    return map;
  }, [variantFoods, variantResults]);

  // Every food item is orderable now — there are no non-sellable grouping rows.
  const leavesOf = useCallback(
    (foodId: number) => variantsByFood[foodId] ?? [],
    [variantsByFood]
  );

  const priceOf = useCallback(
    (food: Food) => {
      const leaves = leavesOf(food.id);
      if (!leaves.length) return food.basePrice;
      return Math.min(...leaves.map((leaf) => leaf.price));
    },
    [leavesOf]
  );

  const categoryName = useCallback(
    (id: number) => {
      if (id === UNCATEGORISED) return "Other";
      const cat = categories.find((c) => c.id === id);
      if (!cat) return "Other";
      const parent = cat.parentId
        ? categories.find((c) => c.id === cat.parentId)
        : null;
      return parent ? `${parent.name} · ${cat.name}` : cat.name;
    },
    [categories]
  );

  // Sections follow the API's category ordering; anything uncategorised or
  // pointing at an inactive category falls to the end.
  const sections = useMemo(() => {
    const grouped = new Map<number, Food[]>();
    for (const food of foods) {
      const id =
        food.foodCategoryId != null &&
        categories.some((c) => c.id === food.foodCategoryId)
          ? food.foodCategoryId
          : UNCATEGORISED;
      const list = grouped.get(id);
      if (list) list.push(food);
      else grouped.set(id, [food]);
    }

    const ordered: { id: number; name: string; foods: Food[] }[] = [];
    for (const cat of categories) {
      const list = grouped.get(cat.id);
      if (list) ordered.push({ id: cat.id, name: categoryName(cat.id), foods: list });
    }
    const rest = grouped.get(UNCATEGORISED);
    if (rest) ordered.push({ id: UNCATEGORISED, name: "Other", foods: rest });
    return ordered;
  }, [foods, categories, categoryName]);

  const addItem = useCallback(
    (food: Food, variant: Variant | null, variantLabel: string | null) => {
      const key = cartKey(food.id, variant?.id);
      const unitPrice = variant ? variant.price : food.basePrice;
      setCart((prev) => {
        const existing = prev.find((i) => i.key === key);
        if (existing) {
          return prev.map((i) =>
            i.key === key ? { ...i, quantity: i.quantity + 1 } : i
          );
        }
        return [
          ...prev,
          { key, food, variant, variantLabel, unitPrice, quantity: 1 },
        ];
      });
      toast.success(variantLabel ? `${food.name} · ${variantLabel}` : food.name);
    },
    []
  );

  const handleAdd = useCallback(
    (food: Food) => {
      const variants = variantsByFood[food.id];
      if (food.hasVariants && variants?.length) {
        setVariantFor(food);
        setVariantGroup(null);
        return;
      }
      addItem(food, null, null);
    },
    [variantsByFood, addItem]
  );

  const updateQuantity = useCallback((key: string, qty: number) => {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((i) => i.key !== key)
        : prev.map((i) => (i.key === key ? { ...i, quantity: qty } : i))
    );
  }, []);

  const total = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  // Same query key as /order, so the tracker bar rides the existing cache
  // instead of opening a second five-second poll against the backend.
  const { data: guestOrders = [] } = useGuestOrders(tableCode);
  const showTracker = guestOrders.length > 0;
  const showCartBar = itemCount > 0 && !cartOpen && !variantFor;
  const showBottomBar = showTracker || showCartBar;

  const activeSectionData =
    openSection === null
      ? null
      : (sections.find((s) => s.id === openSection) ?? null);

  const openCategory = (id: number) => {
    setOpenSection(id);
    window.scrollTo({ top: 0 });
  };

  const placeOrder = async () => {
    setIsSubmitting(true);
    try {
      const res = await authFetch("/orders/guest", {
        method: "POST",
        body: JSON.stringify({
          tableCode,
          items: cart.map((i) => ({
            foodId: i.food.id,
            ...(i.variant ? { foodVariantId: i.variant.id } : {}),
            quantity: i.quantity,
          })),
        }),
      });

      if (!res.ok) throw new Error(await readError(res, "Failed to place order"));

      toast.success("Order placed!");
      setCart([]);
      setTimeout(() => {
        window.location.href = `/order?table=${tableCode}`;
      }, 500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Order failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (cart.length === 0) {
      toast.error("Add items first");
      return;
    }
    // Browsing stays open to everyone; identity is only required at the point
    // it actually matters, which is also where the backend demands it.
    if (!isAuthenticated) {
      setAuthIntent("checkout");
      return;
    }
    void placeOrder();
  };

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

  return (
    <div className="min-h-screen bg-slate-50">
      <header
        className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-sm"
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {branding.logoUrl && (
              <img
                src={branding.logoUrl}
                alt=""
                className="size-9 shrink-0 rounded-lg object-contain"
              />
            )}
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900">
                {branding.restaurantName ?? "Menu"}
              </h1>
              <p className="truncate text-xs text-slate-500">
                Table {tableCode}
                {customerName && ` · ${customerName}`}
              </p>
            </div>
          </div>
          <a
            href={`/table?table=${encodeURIComponent(tableCode)}`}
            aria-label="Table party"
            className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 active:scale-95"
          >
            <Users size={14} />
            Party
          </a>
          {!isAuthenticated && (
            <button
              onClick={() => setAuthIntent("login")}
              className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 active:scale-95"
            >
              <User size={14} />
              Log in
            </button>
          )}
          <button
            onClick={() => setCartOpen(true)}
            aria-label={`Open cart, ${itemCount} items`}
            className="relative shrink-0 rounded-full p-2.5 text-slate-700 transition hover:bg-slate-100 active:scale-95"
          >
            <ShoppingCart size={22} />
            {itemCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-semibold text-white">
                {itemCount}
              </span>
            )}
          </button>
        </div>

        {activeSectionData && (
          <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 pb-3">
            <button
              onClick={() => setOpenSection(null)}
              className="-ml-1 flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 active:scale-95"
            >
              <ArrowLeft size={16} />
              All categories
            </button>
            <ChevronRight size={14} className="text-slate-300" />
            <span className="truncate text-sm font-semibold text-slate-900">
              {activeSectionData.name}
            </span>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5 pb-40">
        {foodsLoading ? (
          <CardGridSkeleton count={4} className="grid-cols-1 sm:grid-cols-2" />
        ) : sections.length === 0 ? (
          <p className="py-20 text-center text-sm text-slate-500">
            Nothing on the menu right now.
          </p>
        ) : !activeSectionData ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {sections.map((section) => {
              const thumb = section.foods.find((f) => f.imageUrl)?.imageUrl;
              return (
                <button
                  key={section.id}
                  onClick={() => openCategory(section.id)}
                  className="flex items-center gap-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-brand-600 hover:shadow-sm active:scale-[0.99]"
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      loading="lazy"
                      className="size-16 shrink-0 rounded-lg bg-slate-100 object-cover"
                    />
                  ) : (
                    <div className="size-16 shrink-0 rounded-lg bg-slate-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="font-medium leading-snug text-slate-900">
                      {section.name}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {section.foods.length}{" "}
                      {section.foods.length === 1 ? "item" : "items"}
                    </p>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-slate-300" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {activeSectionData.foods.map((food) => {
              // Count orderable leaves, not tree rows — three sizes under
              // one group is "3 options", not 4.
              const leaves = leavesOf(food.id);
              const showsRange = food.hasVariants && leaves.length > 1;
              return (
                <article
                  key={food.id}
                  className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-sm"
                >
                  {food.imageUrl && (
                    <img
                      src={food.imageUrl}
                      alt=""
                      loading="lazy"
                      className="h-36 w-full bg-slate-100 object-cover"
                    />
                  )}
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <h3 className="font-medium leading-snug text-slate-900">
                        {food.name}
                      </h3>
                      {food.shortDescription && (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                          {food.shortDescription}
                        </p>
                      )}
                      {showsRange && (
                        <p className="mt-1.5 text-xs text-slate-400">
                          {leaves.length} options
                        </p>
                      )}
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <p className="text-base font-semibold text-slate-900">
                        {showsRange && (
                          <span className="mr-1 text-xs font-normal text-slate-400">
                            from
                          </span>
                        )}
                        {money(priceOf(food))}
                      </p>
                      <button
                        onClick={() => handleAdd(food)}
                        className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-700 active:scale-95"
                      >
                        {showsRange ? "Choose" : "Add"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Live tracker sits above the cart CTA — a diner mid-second-round needs
          both at once, so they stack rather than compete for the same slot. */}
      {showBottomBar && (
        <div
          className="fixed inset-x-0 bottom-0 z-20 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm"
        >
          {showTracker && tableCode && <OrderTrackerBar tableCode={tableCode} />}

          {showCartBar && (
            <div className="border-t border-slate-200">
              <div className="mx-auto max-w-3xl px-4 py-3">
                <button
                  onClick={() => setCartOpen(true)}
                  className="flex w-full items-center justify-between rounded-xl bg-brand-600 px-4 py-3.5 text-white transition hover:bg-brand-700 active:scale-[0.99]"
                >
                  <span className="text-sm font-medium">
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </span>
                  <span className="text-sm font-semibold">
                    View order · {money(total)}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Item picker. Step one lists the variants this food actually sells
          (chicken, veg); step two lists the sizes available *for that variant*,
          which is what stops a guest picking a pairing that has no price. When a
          food has no variants at all it goes straight to the size list. */}
      {variantFor &&
        (() => {
          const all = variantsByFood[variantFor.id] ?? [];

          // Distinct variants across this food's items, in list order.
          const variantIds = [...new Set(all.map((item) => item.variantId))];
          const hasVariantStep =
            variantIds.length > 1 || variantIds[0] !== null;

          const itemsForVariant = (variantId: number | null) =>
            all.filter((item) => item.variantId === variantId);

          // Once a variant is chosen — or if there is no variant step — the
          // remaining choice is the size.
          const chosenVariantId = variantGroup
            ? variantGroup.variantId
            : hasVariantStep
              ? undefined
              : null;

          const sizeOptions =
            chosenVariantId === undefined ? [] : itemsForVariant(chosenVariantId);

          const closePicker = () => {
            setVariantFor(null);
            setVariantGroup(null);
          };

          const variantLabelOf = (item: Variant) => {
            const v = nameOf(variantNames, item.variantId);
            const s = nameOf(subVariantNames, item.subVariantId);
            return [v, s].filter(Boolean).join(" · ") || item.name;
          };

          return (
            <>
              <div
                onClick={closePicker}
                className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]"
              />
              <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3.5">
                  <div className="flex min-w-0 items-center gap-2">
                    {variantGroup && (
                      <button
                        onClick={() => setVariantGroup(null)}
                        aria-label="Back"
                        className="-ml-1 rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100"
                      >
                        <ArrowLeft size={18} />
                      </button>
                    )}
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-slate-900">
                        {variantFor.name}
                      </h2>
                      <p className="truncate text-xs text-slate-500">
                        {variantGroup
                          ? `${nameOf(variantNames, variantGroup.variantId) ?? variantGroup.name} — choose a size`
                          : chosenVariantId === undefined
                            ? "Choose an option"
                            : "Choose a size"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={closePicker}
                    aria-label="Close"
                    className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
                  >
                    <X size={20} />
                  </button>
                </div>

                <ul className="max-h-[50vh] space-y-2 overflow-y-auto p-4">
                  {chosenVariantId === undefined
                    ? // Step one: the variants this food sells.
                      variantIds.map((variantId) => {
                        const items = itemsForVariant(variantId);
                        const from = Math.min(...items.map((i) => i.price));
                        const single = items.length === 1;
                        return (
                          <li key={String(variantId)}>
                            <button
                              onClick={() => {
                                // Nothing left to choose — order it directly.
                                if (single) {
                                  addItem(
                                    variantFor,
                                    items[0],
                                    variantLabelOf(items[0])
                                  );
                                  closePicker();
                                  return;
                                }
                                setVariantGroup(items[0]);
                              }}
                              className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-brand-600 hover:bg-brand-50 active:scale-[0.99]"
                            >
                              <span className="text-sm font-medium text-slate-900">
                                {nameOf(variantNames, variantId) ?? "Standard"}
                              </span>
                              <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-slate-900">
                                {!single && (
                                  <span className="text-xs font-normal text-slate-400">
                                    from
                                  </span>
                                )}
                                {money(from)}
                                {!single && (
                                  <ChevronRight
                                    size={15}
                                    className="text-slate-400"
                                  />
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })
                    : // Step two: sizes available for the chosen variant.
                      sizeOptions.map((item) => (
                        <li key={item.id}>
                          <button
                            onClick={() => {
                              addItem(variantFor, item, variantLabelOf(item));
                              closePicker();
                            }}
                            className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-brand-600 hover:bg-brand-50 active:scale-[0.99]"
                          >
                            <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                              {nameOf(subVariantNames, item.subVariantId) ??
                                item.name}
                              {item.isDefault && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-normal text-slate-500">
                                  popular
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 text-sm font-semibold text-slate-900">
                              {money(item.price)}
                            </span>
                          </button>
                        </li>
                      ))}
                </ul>
              </div>
            </>
          );
        })()}

      {cartOpen && (
        <div
          onClick={() => setCartOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-[2px]"
        />
      )}

      <aside
        aria-hidden={!cartOpen}
        className={`fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
          cartOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5">
          <h2 className="font-semibold text-slate-900">Your order</h2>
          <button
            onClick={() => setCartOpen(false)}
            aria-label="Close cart"
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <ShoppingCart size={32} className="text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">No items yet</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {cart.map((item) => (
                <li key={item.key} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {item.food.name}
                      </p>
                      {item.variantLabel && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                          <Check size={12} /> {item.variantLabel}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-slate-900">
                      {money(item.unitPrice * item.quantity)}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.key, item.quantity - 1)}
                      aria-label={`Decrease ${item.food.name}`}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50 active:scale-95"
                    >
                      <Minus size={15} />
                    </button>
                    <span className="w-10 text-center text-sm font-semibold tabular-nums text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.key, item.quantity + 1)}
                      aria-label={`Increase ${item.food.name}`}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50 active:scale-95"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-200 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-slate-500">Total</span>
            <span className="text-lg font-semibold text-slate-900">{money(total)}</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={cart.length === 0 || isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Send size={16} />
            {isSubmitting ? "Placing…" : "Place order"}
          </button>
        </div>
      </aside>

      {authIntent && (
        <GuestAuthSheet
          onClose={() => setAuthIntent(null)}
          onSuccess={() => {
            const intent = authIntent;
            setAuthIntent(null);
            // They were mid-checkout when the gate appeared, so finish the job
            // rather than making them find the button again.
            if (intent === "checkout") void placeOrder();
          }}
        />
      )}
    </div>
  );
}
