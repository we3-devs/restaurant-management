"use client"

import Link from "next/link"
import { ChevronRightIcon, Download, Printer } from "lucide-react"

import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { DetailPageSkeleton, NotFoundCard } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useOrder, useOrderItems } from "@/hooks/use-orders"
import { useOutlet } from "@/hooks/use-outlets"
import { useCustomer } from "@/hooks/use-customers"
import { useFoods } from "@/hooks/use-foods"
import { useFoodVariants } from "@/hooks/use-food-variants"

function Breadcrumb({ orderNumber }: { orderNumber: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      <Link href="/dashboard" className="hover:text-foreground">
        Home
      </Link>
      <ChevronRightIcon className="size-3.5" />
      <Link href="/invoices" className="hover:text-foreground">
        Invoices
      </Link>
      <ChevronRightIcon className="size-3.5" />
      <span className="text-primary">{orderNumber}</span>
    </div>
  )
}

export function InvoiceDetail({ orderId }: { orderId: number }) {
  const { data: order, isLoading } = useOrder(orderId)
  const showSkeleton = useDelayedLoading(isLoading)
  const { data: items } = useOrderItems(orderId)
  const { data: outlet } = useOutlet(order?.outletId ?? 0)
  const { data: customer } = useCustomer(order?.customerId ?? 0)
  const { data: foods } = useFoods({ limit: 500 })
  const { data: variants } = useFoodVariants({ limit: 500 })

  const getFoodName = (foodId: number) => foods?.data?.find((f) => f.id === foodId)?.name ?? `Item #${foodId}`
  const getVariantName = (foodVariantId: number | null) =>
    foodVariantId ? (variants?.data?.find((v) => v.id === foodVariantId)?.name ?? null) : null

  if (showSkeleton) return <DetailPageSkeleton fields={5} />
  if (!isLoading && !order) return <NotFoundCard resource="Invoice" />
  if (!order) return null

  if (!order.invoiceNumber) {
    return (
      <div className="space-y-4">
        <Breadcrumb orderNumber={order.orderNumber} />
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No invoice has been generated for this order yet.</p>
          <Link href={`/orders/${orderId}`} className="mt-4 inline-block text-sm text-primary hover:underline">
            View order details
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <Breadcrumb orderNumber={order.orderNumber} />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 size-4" />
            Print
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 size-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Professional Invoice Format */}
      <div className="mx-auto max-w-4xl space-y-0 bg-white p-12 text-black">
        {/* Header */}
        <div className="mb-8 space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">INVOICE</h1>
          <p className="text-sm text-gray-600">{outlet?.name ?? "Restaurant"}</p>
        </div>

        {/* Invoice Details Row */}
        <div className="mb-8 grid grid-cols-2 gap-8 border-b border-gray-300 pb-8">
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase text-gray-700">Bill To</h3>
            <div className="space-y-1 text-sm">
              <p className="font-medium text-gray-900">{customer?.name || "Walk-in Customer"}</p>
              {customer?.email && <p className="text-gray-600">{customer.email}</p>}
              {customer?.phone && <p className="text-gray-600">{customer.phone}</p>}
              {customer?.address && <p className="text-gray-600">{customer.address}</p>}
              <p className="text-gray-500 text-xs mt-2">Order #{order.orderNumber}</p>
            </div>
          </div>

          <div className="text-right">
            <div className="space-y-1 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase text-gray-700">Invoice Number</p>
                <p className="text-lg font-bold">{order.invoiceNumber}</p>
              </div>
              <div className="pt-2">
                <p className="text-xs font-semibold uppercase text-gray-700">Invoice Date</p>
                <p className="text-sm">
                  {order.invoiceGeneratedAt
                    ? new Date(order.invoiceGeneratedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "N/A"}
                </p>
              </div>
              <div className="pt-2">
                <p className="text-xs font-semibold uppercase text-gray-700">Order Date</p>
                <p className="text-sm">
                  {new Date(order.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-900">
                <th className="py-3 text-left font-semibold uppercase text-gray-900">Description</th>
                <th className="py-3 text-center font-semibold uppercase text-gray-900">Qty</th>
                <th className="py-3 text-right font-semibold uppercase text-gray-900">Unit Price</th>
                <th className="py-3 text-right font-semibold uppercase text-gray-900">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items?.data && items.data.length > 0 ? (
                items.data.map((item, index) => (
                  <tr key={item.id} className={index !== (items.data?.length ?? 0) - 1 ? "border-b border-gray-200" : ""}>
                    <td className="py-3 text-left">
                      <p className="font-medium text-gray-900">
                        {getFoodName(item.foodId)}
                        {getVariantName(item.foodVariantId) ? ` — ${getVariantName(item.foodVariantId)}` : ""}
                      </p>
                      {item.addons && item.addons.length > 0 && (
                        <ul className="mt-1 text-xs text-gray-600">
                          {item.addons.map((addon) => (
                            <li key={addon.id} className="ml-4">
                              + Addon #{addon.addonId} (x{addon.quantity})
                            </li>
                          ))}
                        </ul>
                      )}
                      {item.note && <p className="mt-1 text-xs italic text-gray-500">Note: {item.note}</p>}
                    </td>
                    <td className="py-3 text-center text-gray-700">{item.quantity}</td>
                    <td className="py-3 text-right text-gray-700">NPR {item.unitPrice.toFixed(2)}</td>
                    <td className="py-3 text-right font-medium text-gray-900">NPR {item.totalAmount.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-3 text-center text-gray-500">
                    No items
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Section */}
        <div className="mb-8 flex justify-end">
          <div className="w-80 space-y-2 border-t border-gray-300 pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium text-gray-900">NPR {order.subtotal.toFixed(2)}</span>
            </div>

            {order.discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Discount:</span>
                <span className="font-medium text-red-600">-NPR {order.discountAmount.toFixed(2)}</span>
              </div>
            )}

            {order.serviceChargeAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Service Charge:</span>
                <span className="font-medium text-gray-900">NPR {order.serviceChargeAmount.toFixed(2)}</span>
              </div>
            )}

            {order.taxAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax (VAT):</span>
                <span className="font-medium text-gray-900">NPR {order.taxAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="border-t border-gray-300 pt-2">
              <div className="flex justify-between">
                <span className="font-bold text-gray-900">TOTAL:</span>
                <span className="text-xl font-bold text-gray-900">NPR {order.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Info */}
        <div className="mb-8 space-y-2 border-t border-gray-300 pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Amount Paid:</span>
            <span className="font-medium text-green-600">NPR {order.paidAmount.toFixed(2)}</span>
          </div>
          {order.refundedAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Refunded:</span>
              <span className="font-medium text-red-600">NPR {order.refundedAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-300 pt-2 text-sm font-bold">
            <span className="text-gray-900">Amount Due:</span>
            <span className={order.dueAmount > 0 ? "text-red-600" : "text-green-600"}>
              NPR {order.dueAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Status */}
        <div className="mb-8 space-y-2 border-t border-gray-300 pt-4">
          <div className="flex gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-700">Order Status</p>
              <div className="mt-1">
                <StatusBadge status={order.status} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-gray-700">Payment Status</p>
              <div className="mt-1">
                <StatusBadge status={order.paymentStatus} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-300 pt-6 text-center">
          <p className="text-xs text-gray-600">
            Thank you for your business! This is an official invoice. Please keep this for your records.
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Generated on {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>
    </div>
  )
}
