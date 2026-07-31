"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useIngredients } from "@/hooks/use-ingredients"
import { useOutlet } from "@/hooks/use-outlets"
import { useSupplier } from "@/hooks/use-suppliers"
import { useWarehouse } from "@/hooks/use-warehouses"
import {
  useAddPurchaseOrderItem,
  useApprovePurchaseOrder,
  useCancelPurchaseOrder,
  usePurchaseOrder,
  usePurchaseOrderItems,
  useRejectPurchaseOrder,
  useRemovePurchaseOrderItem,
  useSubmitPurchaseOrder,
} from "@/hooks/use-purchase-orders"
import { addPurchaseOrderItemSchema, type AddPurchaseOrderItemInput } from "@/lib/validators/purchase-orders"

const STATUS_VARIANT: Record<string, "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  pending_approval: "secondary",
  approved: "secondary",
  partially_received: "secondary",
  received: "secondary",
  completed: "secondary",
  cancelled: "destructive",
}

export function PurchaseOrderDetail({ purchaseOrderId }: { purchaseOrderId: number }) {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canManage = isSuperadmin || permissions.includes("purchase-orders.manage")

  const { data: po, isLoading } = usePurchaseOrder(purchaseOrderId)
  const { data: items } = usePurchaseOrderItems(purchaseOrderId)
  const { data: supplier } = useSupplier(po?.supplierId ?? 0)
  const { data: outlet } = useOutlet(po?.outletId ?? 0)
  const { data: warehouse } = useWarehouse(po?.warehouseId ?? 0)

  const submitPo = useSubmitPurchaseOrder(purchaseOrderId)
  const approvePo = useApprovePurchaseOrder(purchaseOrderId)
  const rejectPo = useRejectPurchaseOrder(purchaseOrderId)
  const cancelPo = useCancelPurchaseOrder(purchaseOrderId)

  async function runAction(action: () => Promise<unknown>, successMessage: string, failureMessage: string) {
    try {
      await action()
      toast.success(successMessage)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : failureMessage)
    }
  }

  if (isLoading || !po) {
    return <Skeleton className="h-96 w-full max-w-3xl" />
  }

  const canCancel = canManage && !["completed", "cancelled"].includes(po.status)

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{po.poNo}</h1>
          <div className="flex items-center gap-1.5">
            <p className="text-sm text-muted-foreground">
              {supplier?.supplier.companyName ?? `Supplier #${po.supplierId}`} · {outlet?.name ?? `Outlet #${po.outletId}`} ·{" "}
              {warehouse?.name ?? `Warehouse #${po.warehouseId}`}
            </p>
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[po.status] ?? "outline"} className="text-sm">
          {po.status.replaceAll("_", " ")}
        </Badge>
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-2">
          {po.status === "draft" && (
            <Button
              onClick={() => runAction(() => submitPo.mutateAsync(), "Submitted for approval", "Failed to submit")}
              disabled={submitPo.isPending}
            >
              Submit for approval
            </Button>
          )}
          {po.status === "pending_approval" && (
            <>
              <Button
                onClick={() => runAction(() => approvePo.mutateAsync(), "Purchase order approved", "Failed to approve")}
                disabled={approvePo.isPending}
              >
                Approve
              </Button>
              <Button
                variant="destructive"
                onClick={() => runAction(() => rejectPo.mutateAsync(), "Purchase order rejected", "Failed to reject")}
                disabled={rejectPo.isPending}
              >
                Reject
              </Button>
            </>
          )}
          {canCancel && po.status !== "pending_approval" && (
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="destructive">Cancel order</Button>} />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel purchase order {po.poNo}?</AlertDialogTitle>
                  <AlertDialogDescription>This cannot be undone from the UI.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Back</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => runAction(() => cancelPo.mutateAsync(), "Purchase order cancelled", "Failed to cancel")}
                  >
                    Cancel order
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Subtotal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{po.subtotal.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Discount</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{po.discountAmount.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tax</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{po.taxAmount.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Grand total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{po.grandTotal.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {po.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{po.notes}</p>
          </CardContent>
        </Card>
      )}

      <PurchaseOrderItemsSection
        purchaseOrderId={purchaseOrderId}
        status={po.status}
        canManage={canManage}
        items={items ?? []}
      />
    </div>
  )
}

function PurchaseOrderItemsSection({
  purchaseOrderId,
  status,
  canManage,
  items,
}: {
  purchaseOrderId: number
  status: string
  canManage: boolean
  items: { id: number; ingredientId: number; quantity: number; unit: string | null; unitCost: number; discount: number; tax: number; total: number; receivedQuantity: number; remainingQuantity: number }[]
}) {
  const { data: ingredients } = useIngredients({ limit: 200 })
  const addItem = useAddPurchaseOrderItem(purchaseOrderId)
  const removeItem = useRemovePurchaseOrderItem(purchaseOrderId)
  const [showForm, setShowForm] = useState(false)

  const ingredientName = (id: number) => ingredients?.data.find((i) => i.id === id)?.name ?? `#${id}`
  const canEditItems = canManage && status === "draft"

  const form = useForm<AddPurchaseOrderItemInput>({
    resolver: zodResolver(addPurchaseOrderItemSchema),
    defaultValues: { ingredientId: 0, quantity: 0, unit: "", unitCost: 0, discount: 0, tax: 0 },
  })

  async function onSubmit(values: AddPurchaseOrderItemInput) {
    try {
      await addItem.mutateAsync(values)
      toast.success("Item added")
      form.reset({ ingredientId: 0, quantity: 0, unit: "", unitCost: 0, discount: 0, tax: 0 })
      setShowForm(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add item")
    }
  }

  async function handleRemove(itemId: number) {
    try {
      await removeItem.mutateAsync(itemId)
      toast.success("Item removed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove item")
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Items</CardTitle>
        {canEditItems && (
          <Button variant="outline" size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Close" : "Add item"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ingredient</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit cost</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Remaining</TableHead>
                {canEditItems && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{ingredientName(item.ingredientId)}</TableCell>
                  <TableCell>
                    {item.quantity} {item.unit ?? ""}
                  </TableCell>
                  <TableCell>{item.unitCost.toFixed(2)}</TableCell>
                  <TableCell>{item.total.toFixed(2)}</TableCell>
                  <TableCell>{item.receivedQuantity}</TableCell>
                  <TableCell>{item.remainingQuantity}</TableCell>
                  {canEditItems && (
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleRemove(item.id)}>
                        Remove
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {showForm && canEditItems && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3 rounded-lg border p-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="ingredientId"
                render={({ field }) => (
                  <FormItem className="col-span-2 sm:col-span-1">
                    <FormLabel>Ingredient</FormLabel>
                    <Select value={field.value ? String(field.value) : ""} onValueChange={(v) => field.onChange(Number(v))}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an ingredient" />
                      </SelectTrigger>
                      <SelectContent>
                        {ingredients?.data.map((ingredient) => (
                          <SelectItem key={ingredient.id} value={String(ingredient.id)}>
                            {ingredient.name}
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
                      step="0.01"
                      value={field.value ?? 0}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <FormControl placeholder="kg, pcs..." {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unitCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit cost</FormLabel>
                    <FormControl
                      type="number"
                      step="0.01"
                      value={field.value ?? 0}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="discount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount</FormLabel>
                    <FormControl
                      type="number"
                      step="0.01"
                      value={field.value ?? 0}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax</FormLabel>
                    <FormControl
                      type="number"
                      step="0.01"
                      value={field.value ?? 0}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={addItem.isPending} className="col-span-2 w-fit sm:col-span-3">
                {addItem.isPending ? "Adding..." : "Add item"}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  )
}
