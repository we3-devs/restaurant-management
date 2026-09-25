"use client";

import { useState, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import {
  Minus,
  Plus,
  X,
  User,
  ArrowLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { useTableSession } from "@/hooks/use-table-session";
import { useGuestSession } from "@/hooks/use-guest-session";
import { useGuestAuth } from "@/hooks/use-guest-auth";
import { useCart } from "@/hooks/use-cart";
import { useBranding } from "@/hooks/use-branding";
import { GuestAuthSheet } from "@/components/guest-auth-sheet";
import { GuestNavBar } from "@/components/guest-nav-bar";
import { CartSheet } from "@/components/cart-sheet";
import { OrderTrackerBar } from "@/components/order-tracker-bar";
import { CardGridSkeleton } from "@/components/skeleton";
import { getJson } from "@/lib/api";
import type { Food } from "@rms/api-client/hooks/use-foods";
import type { FoodCategory as Category } from "@rms/api-client/hooks/use-food-categories";
import type { FoodVariant as Variant } from "@rms/api-client/hooks/use-food-variants";
import type { VariantListValue as ListValue } from "@rms/api-client/hooks/use-variant-lists";

// Same Food/FoodCategory/FoodVariant shapes POS reads from MenuService's
// getBootstrap() — guest ordering used to read a separate, hand-trimmed
// /foods/public/menu projection that never picked up FoodVariant-level
// stock/inventoryAvailable, so the two menus silently drifted apart. Both
// surfaces now read the exact same food items from the same place.

const money = (n: number) => `Rs. ${n.toLocaleString("en-IN")}`;

const UNCATEGORISED = -1;

export default function MenuContent() {
  const { tableCode, isReady } = useGuestSession();
  const { qrOrderingMode, diningTableName } = useTableSession(tableCode);
  const { isAuthenticated } = useGuestAuth();
  const { cart, addItem: addToCart, updateQuantity, itemCount } = useCart(tableCode);
  const branding = useBranding();
  const [variantFor, setVariantFor] = useState<Food | null>(null);
  // Step 2 of the picker: which top-level group (Veg / Chicken) is open.
  const [variantGroup, setVariantGroup] = useState<Variant | null>(null);
  // Tracks why the gate opened: signing in from the header shouldn't silently
  // send an order just because the cart happens to be full.
  const [authIntent, setAuthIntent] = useState<"login" | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  // Two-level menu: a category list, then that category's foods.
  const [openSection, setOpenSection] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: menu, isLoading: foodsLoading } = useQuery<{ foods: Food[]; categories: Category[]; foodVariants: Variant[]; variants: ListValue[]; subVariants: ListValue[] }>({
    queryKey: ["menu", "guest-bootstrap", tableCode],
    queryFn: () => getJson(`/menu/guest-bootstrap?tableCode=${encodeURIComponent(tableCode!)}`),
    enabled: !!tableCode,
  });
  const foods = menu?.foods ?? [];
  const categories = menu?.categories ?? [];
  const variantNames = menu?.variants ?? [];
  const subVariantNames = menu?.subVariants ?? [];

  const nameOf = useCallback(
    (rows: ListValue[], id: number | null) =>
      id === null ? null : (rows.find((row) => row.id === id)?.name ?? null),
    []
  );

  // Variant-bearing foods are already included in the combined public-menu
  // response, so cards can show their cheapest sellable price immediately.
  const variantFoods = useMemo(
    () => foods.filter((f) => f.hasVariants),
    [foods]
  );

  const variantsByFood = useMemo(() => {
    const map: Record<number, Variant[]> = {};
    for (const variant of menu?.foodVariants ?? []) {
      (map[variant.foodId] ??= []).push(variant);
    }
    for (const food of variantFoods) {
      if (!map[food.id]) map[food.id] = [];
    }
    return map;
  }, [menu?.foodVariants, variantFoods]);

  // Every food item is orderable now — there are no non-sellable grouping rows.
  const leavesOf = useCallback(
    (foodId: number) => variantsByFood[foodId] ?? [],
    [variantsByFood]
  );

  const priceOf = useCallback(
    (food: Food) => {
      const leaves = leavesOf(food.id);
      return leaves.length ? Math.min(...leaves.map((leaf) => leaf.price)) : 0;
    },
    [leavesOf]
  );

  // Same rule as POS's food-grid: a food reads as out of stock only once
  // every one of its food items is — a Large drink running out shouldn't
  // block ordering the Small.
  const isFoodAvailable = useCallback(
    (foodId: number) => {
      const leaves = leavesOf(foodId);
      return leaves.length === 0 || leaves.some((leaf) => leaf.inventoryAvailable !== false);
    },
    [leavesOf]
  );

  const categoryName = useCallback(
    (id: number) => {
      if (id === UNCATEGORISED) return "Other";
      const cat = categories.find((c) => c.id === id);
      if (!cat) return "Other";
      return cat.name;
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

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    return foods.filter((food) => {
      const category = categories.find((item) => item.id === food.foodCategoryId);
      const parent = category?.parentId
        ? categories.find((item) => item.id === category.parentId)
        : null;
      const variants = variantsByFood[food.id] ?? [];
      const prices = variants.map((variant) => variant.price);
      const searchableText = [
        food.name,
        category?.name,
        parent?.name,
        ...variants.map((variant) => variant.name),
        ...variants.map((variant) => nameOf(variantNames, variant.variantId)),
        ...variants.map((variant) => nameOf(subVariantNames, variant.subVariantId)),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return query
        .split(/\s+/)
        .filter(Boolean)
        .every((term) => searchableText.includes(term) || prices.some((price) => String(price).includes(term)));
    });
  }, [searchQuery, foods, categories, variantsByFood, variantNames, subVariantNames, nameOf]);

  const searchSection = searchQuery.trim()
    ? { id: UNCATEGORISED, name: "Search results", foods: searchResults }
    : null;

  const handleAdd = useCallback(
    (food: Food) => {
      if (!isFoodAvailable(food.id)) {
        toast.error(`${food.name} is out of stock`);
        return;
      }
      const variants = variantsByFood[food.id];
      if (food.hasVariants && variants?.length) {
        setVariantFor(food);
        setVariantGroup(null);
        return;
      }
      addToCart(food, null, null);
    },
    [variantsByFood, addToCart, isFoodAvailable]
  );

  // Menu cards own quantity changes. For foods with variants, decrement the
  // most recently added option; adding still opens the option picker so the
  // guest never changes a size/protein combination by accident.
  const itemsForFood = useCallback(
    (foodId: number) => cart.filter((item) => item.food.id === foodId),
    [cart]
  );

  const quantityForFood = useCallback(
    (foodId: number) =>
      itemsForFood(foodId).reduce((sum, item) => sum + item.quantity, 0),
    [itemsForFood]
  );

  const decrementFood = useCallback(
    (food: Food) => {
      const matchingItems = itemsForFood(food.id);
      const lastItem = matchingItems[matchingItems.length - 1];
      if (lastItem) updateQuantity(lastItem.key, lastItem.quantity - 1);
    },
    [itemsForFood, updateQuantity]
  );

  const repeatFood = useCallback(
    (food: Food) => {
      const matchingItems = itemsForFood(food.id);
      const lastItem = matchingItems[matchingItems.length - 1];
      if (lastItem) {
        addToCart(food, lastItem.variant, lastItem.variantLabel);
      } else {
        handleAdd(food);
      }
    },
    [itemsForFood, addToCart, handleAdd]
  );

  const activeSectionData =
    openSection === null
      ? null
      : (sections.find((s) => s.id === openSection) ?? null);
  const visibleSection = searchSection ?? activeSectionData;

  const openCategory = (id: number) => {
    setOpenSection(id);
    window.scrollTo({ top: 0 });
  };

  if (!isReady) {
    return <div className="min-h-screen bg-slate-50" />;
  }

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
                {branding.restaurantName}
              </h1>
              <p className="truncate text-xs text-slate-500">
                {diningTableName}
              </p>
            </div>
          </div>
          {isAuthenticated && qrOrderingMode !== null && qrOrderingMode !== "quick_order" && (
            <a
              href="/profile"
              className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 active:scale-95"
            >
              <User size={14} />
              Profile
            </a>
          )}
          {/* qrOrderingMode starts null until the anonymous table scan
              resolves — requiring it to be resolved (not just !== "quick_order")
              stops this from flashing on every table, including quick-order
              ones, for the brief window before the scan response lands. */}
          {!isAuthenticated && qrOrderingMode !== null && qrOrderingMode !== "quick_order" && (
            <button
              onClick={() => setAuthIntent("login")}
              className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 active:scale-95"
            >
              <User size={14} />
              Log in
            </button>
          )}
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
        <div className="mx-auto flex max-w-3xl px-4 py-2">
          <label className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100">
            <Search size={18} className="shrink-0 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search food, category, etc."
              aria-label="Search menu"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear menu search"
                className="text-xs font-medium text-slate-400 hover:text-slate-700"
              >
                Clear
              </button>
            )}
          </label>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5 pb-40">
        {foodsLoading ? (
          <CardGridSkeleton count={4} className="grid-cols-1 sm:grid-cols-2" />
        ) : sections.length === 0 ? (
          <p className="py-20 text-center text-sm text-slate-500">
            Nothing on the menu right now.
          </p>
        ) : !visibleSection ? (
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
          visibleSection.foods.length === 0 ? (
            <p className="py-20 text-center text-sm text-slate-500">
              No menu items match “{searchQuery}”.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleSection.foods.map((food) => {
              // Count orderable leaves, not tree rows — three sizes under
              // one group is "3 options", not 4.
              const leaves = leavesOf(food.id);
              const showsRange = food.hasVariants && leaves.length > 1;
              const quantity = quantityForFood(food.id);
              const isSelected = quantity > 0;
              const outOfStock = !isFoodAvailable(food.id);
              return (
                <article
                  key={food.id}
                  className={`flex flex-col overflow-hidden rounded-xl border bg-white transition hover:shadow-sm ${
                    isSelected
                      ? "border-brand-600 bg-brand-50/40 ring-1 ring-brand-600/20"
                      : "border-slate-200 hover:border-slate-300"
                  } ${outOfStock ? "opacity-60" : ""}`}
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
                      {outOfStock && (
                        <p className="mt-1.5 text-xs font-semibold text-red-600">
                          Out of stock
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
                      {isSelected ? (
                        <div className="flex items-center gap-1 rounded-lg border border-brand-200 bg-white p-1 shadow-sm">
                          <button
                            onClick={() => decrementFood(food)}
                            aria-label={`Decrease ${food.name}`}
                            className="rounded-md p-1.5 text-brand-700 transition hover:bg-brand-50 active:scale-95"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="min-w-7 text-center text-sm font-bold tabular-nums text-brand-700">
                            {quantity}
                          </span>
                          <button
                            onClick={() => repeatFood(food)}
                            aria-label={`Increase ${food.name}`}
                            disabled={outOfStock}
                            className="rounded-md bg-brand-600 p-1.5 text-white transition hover:bg-brand-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAdd(food)}
                          disabled={outOfStock}
                          className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {outOfStock ? "Out of stock" : showsRange ? "Choose" : "Add"}
                        </button>
                      )}
                    </div>
                    {food.hasVariants && isSelected && (
                      <button
                        type="button"
                        onClick={() => handleAdd(food)}
                        disabled={outOfStock}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-white py-2 text-xs font-semibold text-brand-700 transition hover:border-brand-600 hover:bg-brand-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Plus size={14} />
                        Add another variant
                      </button>
                    )}
                  </div>
                </article>
              );
              })}
            </div>
          )
        )}
      </main>

      {/* Sits just above the bottom nav bar — a diner mid-second-round needs
          both the live status and a quick way to review what they've just
          added at once. The "View order" bar opens the on-page cart drawer
          (not the standalone /cart page the nav bar's own Cart tab goes to),
          so picking items and reviewing/placing the order both stay on the
          food grid. */}
      {tableCode && (
        <div className="fixed inset-x-0 bottom-14 z-20 bg-white/95 backdrop-blur-sm">
          <OrderTrackerBar tableCode={tableCode} />
          {itemCount > 0 && !cartOpen && !variantFor && (
            <div className="border-t border-slate-200">
              <div className="mx-auto max-w-3xl px-4 py-3">
                <button
                  onClick={() => setCartOpen(true)}
                  className="flex w-full items-center justify-between rounded-xl bg-brand-600 px-4 py-3.5 text-white transition hover:bg-brand-700 active:scale-[0.99]"
                >
                  <span className="text-sm font-medium">
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </span>
                  <span className="text-sm font-semibold">View order</span>
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
                                  addToCart(
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
                      sizeOptions.map((item) => {
                        const outOfStock = item.inventoryAvailable === false;
                        return (
                          <li key={item.id}>
                            <button
                              onClick={() => {
                                if (outOfStock) return;
                                addToCart(variantFor, item, variantLabelOf(item));
                                closePicker();
                              }}
                              disabled={outOfStock}
                              className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-brand-600 hover:bg-brand-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent"
                            >
                              <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                                {nameOf(subVariantNames, item.subVariantId) ??
                                  item.name}
                                {item.isDefault && !outOfStock && (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-normal text-slate-500">
                                    popular
                                  </span>
                                )}
                                {outOfStock && (
                                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-normal text-red-600">
                                    out of stock
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0 text-sm font-semibold text-slate-900">
                                {money(item.price)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                </ul>
              </div>
            </>
          );
        })()}

      {authIntent === "login" && (
        <GuestAuthSheet onClose={() => setAuthIntent(null)} onSuccess={() => setAuthIntent(null)} />
      )}

      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} />
      <GuestNavBar />
    </div>
  );
}
