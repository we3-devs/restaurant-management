"use client"

import { useState } from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAddonGroups } from "@/hooks/use-addon-groups"
import { useAddons } from "@/hooks/use-addons"
import { useCustomer, useCustomerOutlets } from "@/hooks/use-customers"
import { useDiningTables } from "@/hooks/use-dining-tables"
import { useFoodVariants } from "@/hooks/use-food-variants"
import { useFoods } from "@/hooks/use-foods"
import { useIngredients } from "@/hooks/use-ingredients"
import { useLoyaltyAccount } from "@/hooks/use-loyalty"
import { useCreateOrderPayment, useOrderPayments } from "@/hooks/use-order-payments"
import {
  useAddOrderItem,
  useAddOrderItemAddon,
  useAssignOrderTable,
  useOrder,
  useOrderItems,
  useOrderTables,
  useRemoveOrderItem,
  useRemoveOrderItemAddon,
  useUnassignOrderTable,
  useUpdateOrder,
  useUpdateOrderItem,
  useUpdateOrderStatus,
  type OrderItem,
} from "@/hooks/use-orders"
import {
  ORDER_ITEM_STATUSES,
  ORDER_PAYMENT_METHODS,
  ORDER_STATUS_TRANSITIONS,
  createOrderItemSchema,
  createOrderPaymentSchema,
  updateOrderSchema,
  type CreateOrderItemInput,
  type CreateOrderPaymentInput,
  type UpdateOrderInput,
} from "@/lib/validators/orders"

export function OrderDetail({ orderId }: { orderId: number }) {
  const { data: order, isLoading } = useOrder(orderId)
  const updateOrder = useUpdateOrder(orderId)
  const updateStatus = useUpdateOrderStatus(orderId)

  const form = useForm<UpdateOrderInput>({
    resolver: zodResolver(updateOrderSchema),
    values: order
      ? {
          note: order.note ?? "",
          discountType: (order.discountType as UpdateOrderInput["discountType"]) ?? undefined,
          discountValue: order.discountValue,
          taxAmount: order.taxAmount,
          serviceChargeAmount: order.serviceChargeAmount,
        }
      : undefined,
  })

  async function onSubmit(values: UpdateOrderInput) {
    try {
      await updateOrder.mutateAsync(values)
      toast.success("Order updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update order")
    }
  }

  async function handleStatusChange(status: string) {
    try {
      await updateStatus.mutateAsync(status)
      toast.success(`Status changed to ${status}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change status")
    }
  }

  if (isLoading || !order) {
    return <Skeleton className="h-96 w-full max-w-3xl" />
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{order.orderNumber}</h1>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary">{order.orderType}</Badge>
            <StatusBadge status={order.paymentStatus} />
          </div>
        </div>
        <div className="w-48">
          <Select value={order.status} onValueChange={(value) => value && handleStatusChange(value)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                order.status,
                ...(ORDER_STATUS_TRANSITIONS[order.status as keyof typeof ORDER_STATUS_TRANSITIONS] ?? []),
              ].map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Totals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-right">{order.subtotal}</span>
            <span className="text-muted-foreground">Discount</span>
            <span className="text-right">{order.discountAmount}</span>
            <span className="text-muted-foreground">Tax</span>
            <span className="text-right">{order.taxAmount}</span>
            <span className="text-muted-foreground">Service charge</span>
            <span className="text-right">{order.serviceChargeAmount}</span>
            <span className="font-medium">Grand total</span>
            <span className="text-right font-medium">{order.grandTotal}</span>
            <span className="text-muted-foreground">Paid</span>
            <span className="text-right">{order.paidAmount}</span>
            <span className="text-muted-foreground">Due</span>
            <span className="text-right">{order.dueAmount}</span>
            <span className="text-muted-foreground">Refunded</span>
            <span className="text-right">{order.refundedAmount}</span>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="discountType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount type</FormLabel>
                    <Select
                      value={field.value ?? "none"}
                      onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No discount" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No discount</SelectItem>
                        <SelectItem value="flat">flat</SelectItem>
                        <SelectItem value="percentage">percentage</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="discountValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount value</FormLabel>
                    <FormControl
                      type="number"
                      step="0.01"
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="taxAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax amount</FormLabel>
                    <FormControl
                      type="number"
                      step="0.01"
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="serviceChargeAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service charge amount</FormLabel>
                    <FormControl
                      type="number"
                      step="0.01"
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={updateOrder.isPending}>
                {updateOrder.isPending ? "Saving..." : "Save totals"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {order.customerId && <CustomerSection customerId={order.customerId} outletId={order.outletId} />}

      <OrderItemsSection orderId={orderId} />
      <OrderTablesSection orderId={orderId} outletId={order.outletId} />
      <OrderPaymentsSection orderId={orderId} />
    </div>
  )
}

function CustomerSection({ customerId, outletId }: { customerId: number; outletId: number }) {
  const { data: customer } = useCustomer(customerId)
  const { data: loyalty } = useLoyaltyAccount(customerId)
  const { data: outlets } = useCustomerOutlets(customerId)
  const visitCount = outlets?.find((visit) => visit.outletId === outletId)?.visitCount ?? 0

  if (!customer) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <span className="text-muted-foreground">Name</span>
          <span className="text-right">{customer.name}</span>
          <span className="text-muted-foreground">Phone</span>
          <span className="text-right">{customer.phone ?? "—"}</span>
          <span className="text-muted-foreground">Loyalty points</span>
          <span className="text-right">{loyalty?.currentPoints ?? 0}</span>
          <span className="text-muted-foreground">Visits at this outlet</span>
          <span className="text-right">{visitCount}</span>
        </div>
        <Link href={`/customers/${customerId}`} className="inline-block text-sm text-primary hover:underline">
          View customer profile
        </Link>
      </CardContent>
    </Card>
  )
}

function OrderItemsSection({ orderId }: { orderId: number }) {
  const { data: items } = useOrderItems(orderId)
  const { data: foods } = useFoods({ limit: 100 })
  const addItem = useAddOrderItem(orderId)

  const form = useForm<CreateOrderItemInput>({
    resolver: zodResolver(createOrderItemSchema),
    defaultValues: { foodId: 0, foodVariantId: undefined, quantity: 1 },
  })
  const selectedFoodId = form.watch("foodId")
  const { data: variants } = useFoodVariants({ foodId: selectedFoodId || undefined, limit: 100 })

  async function onSubmit(values: CreateOrderItemInput) {
    try {
      await addItem.mutateAsync(values)
      toast.success("Item added")
      form.reset({ foodId: 0, foodVariantId: undefined, quantity: 1 })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add item")
    }
  }

  const foodName = (foodId: number) => foods?.data.find((f) => f.id === foodId)?.name ?? `#${foodId}`

  return (
    <Card>
      <CardHeader>
        <CardTitle>Items</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {(items?.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No items yet.</p>}
          {(items?.data ?? []).map((item) => (
            <OrderItemRow key={item.id} orderId={orderId} item={item} foodName={foodName(item.foodId)} />
          ))}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="foodId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Food</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(value) => {
                      field.onChange(Number(value))
                      form.setValue("foodVariantId", undefined)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a food" />
                    </SelectTrigger>
                    <SelectContent>
                      {foods?.data.map((food) => (
                        <SelectItem key={food.id} value={String(food.id)}>
                          {food.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="foodVariantId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Variant (optional)</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : "none"}
                    onValueChange={(value) => field.onChange(value === "none" ? undefined : Number(value))}
                    disabled={!selectedFoodId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="No variant" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No variant</SelectItem>
                      {variants?.data.map((variant) => (
                        <SelectItem key={variant.id} value={String(variant.id)}>
                          {variant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl
                    type="number"
                    step="1"
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="col-span-2">
              <Button type="submit" disabled={addItem.isPending}>
                {addItem.isPending ? "Adding..." : "Add item"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

function OrderItemRow({ orderId, item, foodName }: { orderId: number; item: OrderItem; foodName: string }) {
  const { data: addons } = useAddons({ limit: 100 })
  const { data: ingredients } = useIngredients({ limit: 100 })
  const updateItem = useUpdateOrderItem(orderId, item.id)
  const removeItem = useRemoveOrderItem(orderId)
  const addAddon = useAddOrderItemAddon(orderId, item.id)
  const removeAddon = useRemoveOrderItemAddon(orderId, item.id)
  const [selectedAddonId, setSelectedAddonId] = useState<string>("")

  const addonName = (addonId: number) => addons?.data.find((a) => a.id === addonId)?.name ?? `#${addonId}`

  async function handleQuantityChange(value: string) {
    const quantity = Number(value)
    if (!quantity || quantity <= 0) return
    try {
      await updateItem.mutateAsync({ quantity })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update quantity")
    }
  }

  async function handleStatusChange(status: string) {
    try {
      await updateItem.mutateAsync({ status })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status")
    }
  }

  async function handleRemove() {
    try {
      await removeItem.mutateAsync(item.id)
      toast.success("Item removed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove item")
    }
  }

  async function handleAddAddon() {
    if (!selectedAddonId) return
    try {
      await addAddon.mutateAsync({ addonId: Number(selectedAddonId), quantity: 1 })
      setSelectedAddonId("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add addon")
    }
  }

  async function handleRemoveAddon(addonId: number) {
    try {
      await removeAddon.mutateAsync(addonId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove addon")
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-input p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{foodName}</p>
          <p className="text-xs text-muted-foreground">
            {item.unitPrice} each &middot; total {item.totalAmount}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRemove}>
          Remove
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="1"
          defaultValue={item.quantity}
          onBlur={(e) => handleQuantityChange(e.target.value)}
          className="h-8 w-20 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
        />
        <Select value={item.status} onValueChange={(value) => value && handleStatusChange(value)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDER_ITEM_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {item.addons.map((link) => (
          <div key={link.id} className="flex items-center gap-1">
            <Badge variant="secondary">{addonName(link.addonId)}</Badge>
            <Button variant="ghost" size="sm" onClick={() => handleRemoveAddon(link.addonId)}>
              &times;
            </Button>
          </div>
        ))}
        <Select value={selectedAddonId} onValueChange={(value) => setSelectedAddonId(value ?? "")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Add addon" />
          </SelectTrigger>
          <SelectContent>
            {addons?.data.map((addon) => (
              <SelectItem key={addon.id} value={String(addon.id)}>
                {addon.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={handleAddAddon} disabled={!selectedAddonId}>
          Add
        </Button>
      </div>

      {item.reservations.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-input pt-2">
          <span className="text-xs text-muted-foreground">Reserved ingredients:</span>
          {item.reservations.map((reservation) => (
            <Badge key={reservation.id} variant="outline" className="text-xs">
              {ingredients?.data.find((i) => i.id === reservation.ingredientId)?.name ??
                `#${reservation.ingredientId}`}{" "}
              {reservation.status === "consumed" ? reservation.consumedQuantity : reservation.reservedQuantity} (
              {reservation.status})
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function OrderTablesSection({ orderId, outletId }: { orderId: number; outletId: number }) {
  const { data: assignments } = useOrderTables(orderId)
  const { data: tables } = useDiningTables({ outletId, limit: 100 })
  const assignTable = useAssignOrderTable(orderId)
  const unassignTable = useUnassignOrderTable(orderId)
  const [selectedTableId, setSelectedTableId] = useState<string>("")

  const tableName = (diningTableId: number) => tables?.data.find((t) => t.id === diningTableId)?.name ?? `#${diningTableId}`

  async function handleAssign() {
    if (!selectedTableId) return
    try {
      await assignTable.mutateAsync({ diningTableId: Number(selectedTableId) })
      toast.success("Table assigned")
      setSelectedTableId("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign table")
    }
  }

  async function handleUnassign(diningTableId: number) {
    try {
      await unassignTable.mutateAsync(diningTableId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unassign table")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tables</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(assignments ?? []).length === 0 && <p className="text-sm text-muted-foreground">No tables assigned.</p>}
          {(assignments ?? []).map((assignment) => (
            <div key={assignment.id} className="flex items-center gap-1.5">
              <Badge variant="secondary">{tableName(assignment.diningTableId)}</Badge>
              <Button variant="ghost" size="sm" onClick={() => handleUnassign(assignment.diningTableId)}>
                Remove
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium">Assign a table</label>
            <Select value={selectedTableId} onValueChange={(value) => setSelectedTableId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a table" />
              </SelectTrigger>
              <SelectContent>
                {tables?.data.map((tableItem) => (
                  <SelectItem key={tableItem.id} value={String(tableItem.id)}>
                    {tableItem.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAssign} disabled={!selectedTableId || assignTable.isPending}>
            Assign
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function OrderPaymentsSection({ orderId }: { orderId: number }) {
  const { data: payments } = useOrderPayments(orderId)
  const createPayment = useCreateOrderPayment(orderId)

  const form = useForm<CreateOrderPaymentInput>({
    resolver: zodResolver(createOrderPaymentSchema),
    defaultValues: { type: "payment", method: "cash", amount: 0 },
  })

  async function onSubmit(values: CreateOrderPaymentInput) {
    try {
      await createPayment.mutateAsync(values)
      toast.success(`${values.type === "refund" ? "Refund" : "Payment"} recorded`)
      form.reset({ type: "payment", method: "cash", amount: 0 })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record payment")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {(payments?.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
          {(payments?.data ?? []).map((payment) => (
            <div key={payment.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1.5">
                <Badge variant={payment.type === "refund" ? "destructive" : "secondary"}>{payment.type}</Badge>
                <span>{payment.method}</span>
              </div>
              <span>{payment.amount}</span>
            </div>
          ))}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="payment">payment</SelectItem>
                      <SelectItem value="refund">refund</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Method</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl
                    type="number"
                    step="0.01"
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="col-span-2">
              <Button type="submit" disabled={createPayment.isPending}>
                {createPayment.isPending ? "Recording..." : "Record payment"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
