"use client";

export const dynamic = "force-dynamic";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Minus, Plus, Send } from "lucide-react";

interface Food {
  id: number;
  name: string;
  description?: string;
  price: number;
  slug: string;
  imageUrl?: string;
}

interface CartItem {
  foodId: number;
  food: Food;
  quantity: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

export default function MenuPage() {
  const searchParams = useSearchParams();
  const tableCode = searchParams.get("table");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!tableCode) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 text-xl">Invalid table code</p>
        </div>
      </div>
    );
  }

  const { data: foods = [], isLoading } = useQuery({
    queryKey: ["foods"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/foods/public`);
      if (!res.ok) throw new Error("Failed to fetch menu");
      return res.json();
    },
  });

  const addToCart = useCallback((food: Food) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.foodId === food.id);
      if (existing) {
        return prev.map((item) =>
          item.foodId === food.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { foodId: food.id, food, quantity: 1 }];
    });
    toast.success(`Added ${food.name}`);
  }, []);

  const updateQuantity = useCallback((foodId: number, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((item) => item.foodId !== foodId));
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.foodId === foodId ? { ...item, quantity: qty } : item
      )
    );
  }, []);

  const total = cart.reduce((sum, item) => sum + item.food.price * item.quantity, 0);

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
          items: cart.map((item) => ({
            foodId: item.foodId,
            quantity: item.quantity,
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading menu...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-white shadow-sm z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Menu</h1>
            <p className="text-sm text-gray-500">Table {tableCode}</p>
          </div>
          <button
            onClick={() => {
              const cartOpen = document.getElementById("cart");
              if (cartOpen) cartOpen.classList.toggle("hidden");
            }}
            className="relative p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ShoppingCart size={24} />
            {cart.length > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Foods Grid */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {foods.map((food: Food) => (
            <div
              key={food.id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition"
            >
              {food.imageUrl && (
                <img
                  src={food.imageUrl}
                  alt={food.name}
                  className="w-full h-40 object-cover"
                />
              )}
              <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  {food.name}
                </h3>
                {food.description && (
                  <p className="text-sm text-gray-600 mt-1">
                    {food.description}
                  </p>
                )}
                <div className="mt-4 flex justify-between items-center">
                  <p className="text-xl font-bold text-gray-900">
                    Rs. {food.price.toLocaleString()}
                  </p>
                  <button
                    onClick={() => addToCart(food)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div
        id="cart"
        className="hidden fixed right-0 top-0 w-80 h-full bg-white shadow-lg z-20 flex flex-col"
      >
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold">Your Order</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No items yet</p>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.foodId} className="border rounded-lg p-3">
                  <p className="font-semibold">{item.food.name}</p>
                  <p className="text-sm text-gray-600">
                    Rs. {(item.food.price * item.quantity).toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => updateQuantity(item.foodId, item.quantity - 1)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="flex-1 text-center font-semibold">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.foodId, item.quantity + 1)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t p-4 space-y-3">
          <div className="flex justify-between text-lg font-bold">
            <span>Total:</span>
            <span>Rs. {total.toLocaleString()}</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={cart.length === 0 || isSubmitting}
            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2 transition"
          >
            <Send size={18} />
            {isSubmitting ? "Placing..." : "Place Order"}
          </button>
        </div>
      </div>
    </div>
  );
}
