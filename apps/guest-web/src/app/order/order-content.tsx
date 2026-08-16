"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useGuestSession } from "@/hooks/use-guest-session";

interface OrderItem {
  id: number;
  foodId: number;
  food: {
    name: string;
    price: number;
  };
  quantity: number;
}

interface Order {
  id: number;
  status: string;
  total: number;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export default function OrderContent() {
  const { tableCode, isLocked } = useGuestSession();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", tableCode],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/orders/guest/mine?tableCode=${tableCode}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.data) ? data.data : [data.data];
    },
    refetchInterval: 3000,
    enabled: !!tableCode,
  });

  if (!tableCode) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 text-xl">Invalid table code</p>
        </div>
      </div>
    );
  }

  const currentOrder = orders[0];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      accepted: "bg-blue-100 text-blue-800",
      preparing: "bg-orange-100 text-orange-800",
      ready: "bg-green-100 text-green-800",
      completed: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, React.ReactNode> = {
      pending: <Clock className="w-5 h-5" />,
      accepted: <CheckCircle className="w-5 h-5" />,
      preparing: <Clock className="w-5 h-5" />,
      ready: <CheckCircle className="w-5 h-5" />,
      completed: <CheckCircle className="w-5 h-5" />,
    };
    return icons[status];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading order...</p>
      </div>
    );
  }

  if (!currentOrder) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">No Active Orders</h1>
          <p className="text-gray-600">Table {tableCode}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">Order #{currentOrder.id}</h1>
          <p className="text-sm text-gray-600">Table {tableCode}</p>
        </div>
      </div>

      {/* Status */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-4">
            {getStatusIcon(currentOrder.status)}
            <div>
              <p className="text-sm text-gray-600">Order Status</p>
              <p className={`text-2xl font-bold inline-block px-4 py-2 rounded-lg ${getStatusColor(currentOrder.status)}`}>
                {currentOrder.status.toUpperCase()}
              </p>
            </div>
          </div>

          {currentOrder.status === "ready" && (
            <div className="mt-4 p-4 bg-green-100 border-l-4 border-green-600 rounded">
              <p className="text-green-800 font-semibold">✓ Your order is ready!</p>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Items</h2>
          <div className="space-y-3">
            {currentOrder.items.map((item: OrderItem) => (
              <div key={item.id} className="flex justify-between items-center border-b pb-3">
                <div>
                  <p className="font-semibold">{item.food.name}</p>
                  <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                </div>
                <p className="font-semibold">Rs. {(item.food.price * item.quantity).toLocaleString()}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t-2 flex justify-between items-center text-lg font-bold">
            <span>Total:</span>
            <span>Rs. {currentOrder.total.toLocaleString()}</span>
          </div>
        </div>

        {/* Back Button */}
        <button
          onClick={() => (window.location.href = `/menu?table=${tableCode}`)}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Back to Menu
        </button>
      </div>
    </div>
  );
}
