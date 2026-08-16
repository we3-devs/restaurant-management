"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { useQuery, useQueries } from "@tanstack/react-query";
import { ShoppingCart, Minus, Plus, Send, X, Check } from "lucide-react";
import { useGuestSession } from "@/hooks/use-guest-session";

// These mirror the Public* projections from /foods/public,
// /food-categories/public and /food-variants/public — all deliberately
// narrower than the authenticated entities.
interface Food {
  id: number;
  foodCategoryId: number | null;
  name: string;
  shortDescription?: string | null;
  basePrice: number;
  hasVariants: boolean;
  hasAddons: boolean;
}

interface Category {
  id: number;
  parentId: number | null;
  name: string;
}

interface Variant {
  id: number;
  foodId: number;
  name: string;
  price: number;
  isDefault: boolean;
}

interface CartItem {
  key: string;
  food: Food;
  variant: Variant | null;
  unitPrice: number;
  quantity: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

const money = (n: number) => `Rs. ${n.toLocaleString("en-IN")}`;
const cartKey = (foodId: number, variantId?: number | null) =>
  `${foodId}:${variantId ?? 0}`;

async function getJson(path: string) {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`Request failed: ${path}`);
  const json = await res.json();
  return json.data ?? json;
}

const UNCATEGORISED = -1;

export default function MenuContent() {
  const { tableCode } = useGuestSession();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [variantFor, setVariantFor] = useState<Food | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});
  const headerRef = useRef<HTMLElement | null>(null);
  const [activeSection, setActiveSection] = useState<number | null>(null);
  const [tailSpace, setTailSpace] = useState(112);

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

  const priceOf = useCallback(
    (food: Food) => {
      const variants = variantsByFood[food.id];
      if (!variants?.length) return food.basePrice;
      return Math.min(...variants.map((v) => v.price));
    },
    [variantsByFood]
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
    (food: Food, variant: Variant | null) => {
      const key = cartKey(food.id, variant?.id);
      const unitPrice = variant ? variant.price : food.basePrice;
      setCart((prev) => {
        const existing = prev.find((i) => i.key === key);
        if (existing) {
          return prev.map((i) =>
            i.key === key ? { ...i, quantity: i.quantity + 1 } : i
          );
        }
        return [...prev, { key, food, variant, unitPrice, quantity: 1 }];
      });
      toast.success(variant ? `${food.name} · ${variant.name}` : food.name);
    },
    []
  );

  const handleAdd = useCallback(
    (food: Food) => {
      const variants = variantsByFood[food.id];
      if (food.hasVariants && variants?.length) {
        setVariantFor(food);
        return;
      }
      addItem(food, null);
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

  // The last section can only reach the top of the viewport if there is a
  // viewport's worth of scrollable room beneath its heading. Real menus rarely
  // have that (the final category is often one item), so the shortfall is
  // measured and added as trailing space. It doubles as clearance for the
  // fixed cart bar, hence the 112px floor.
  useEffect(() => {
    const last = sections[sections.length - 1];
    const el = last ? sectionRefs.current[last.id] : null;
    if (!el) return;

    const recalc = () => {
      const headerH = headerRef.current?.offsetHeight ?? 0;
      const shortfall = window.innerHeight - headerH - el.offsetHeight - 8;
      setTailSpace(Math.max(112, Math.ceil(shortfall)));
    };

    recalc();
    // The section keeps growing after first paint — variant prices arrive on
    // their own requests — so observe it rather than measuring only once.
    const observer = new ResizeObserver(recalc);
    observer.observe(el);
    window.addEventListener("resize", recalc);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, [sections]);

  const scrollTo = (id: number) => {
    const el = sectionRefs.current[id];
    if (!el) return;
    setActiveSection(id);
    // Offset by the live sticky-header height rather than a fixed scroll-margin,
    // since the header grows a second row once the category nav is present.
    const headerH = headerRef.current?.offsetHeight ?? 0;
    const top = window.scrollY + el.getBoundingClientRect().top - headerH - 8;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error("Add items first");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/orders/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableCode,
          items: cart.map((i) => ({
            foodId: i.food.id,
            ...(i.variant ? { foodVariantId: i.variant.id } : {}),
            quantity: i.quantity,
          })),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to place order");
      }

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
        ref={headerRef}
        className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-sm"
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3.5">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">Menu</h1>
            <p className="text-xs text-slate-500">Table {tableCode}</p>
          </div>
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

        {sections.length > 1 && (
          <nav className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                aria-current={activeSection === s.id}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
                  activeSection === s.id
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                {s.name}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        {foodsLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : sections.length === 0 ? (
          <p className="py-20 text-center text-sm text-slate-500">
            Nothing on the menu right now.
          </p>
        ) : (
          <div className="space-y-8">
            {sections.map((section) => (
              <section
                key={section.id}
                ref={(el) => {
                  sectionRefs.current[section.id] = el;
                }}
              >
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  {section.name}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {section.foods.map((food) => {
                    const variants = variantsByFood[food.id];
                    const showsRange = food.hasVariants && (variants?.length ?? 0) > 1;
                    return (
                      <article
                        key={food.id}
                        className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                      >
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
                              {variants.length} options
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
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <div aria-hidden style={{ height: tailSpace }} />
      </main>

      {/* Persistent bar — the primary way back to the cart on a phone. */}
      {itemCount > 0 && !cartOpen && !variantFor && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
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

      {/* Variant picker */}
      {variantFor && (
        <>
          <div
            onClick={() => setVariantFor(null)}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]"
          />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:inset-x-auto sm:left-1/2 sm:bottom-auto sm:top-1/2 sm:w-full sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3.5">
              <div className="min-w-0">
                <h2 className="font-semibold text-slate-900">{variantFor.name}</h2>
                <p className="text-xs text-slate-500">Choose an option</p>
              </div>
              <button
                onClick={() => setVariantFor(null)}
                aria-label="Close"
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto p-4">
              {(variantsByFood[variantFor.id] ?? []).map((variant) => (
                <li key={variant.id}>
                  <button
                    onClick={() => {
                      addItem(variantFor, variant);
                      setVariantFor(null);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-brand-600 hover:bg-brand-50 active:scale-[0.99]"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      {variant.name}
                      {variant.isDefault && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-normal text-slate-500">
                          popular
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-slate-900">
                      {money(variant.price)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

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
                      {item.variant && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                          <Check size={12} /> {item.variant.name}
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
    </div>
  );
}
