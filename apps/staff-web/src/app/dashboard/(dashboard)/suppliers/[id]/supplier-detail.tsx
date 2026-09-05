"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DetailPageSkeleton, NotFoundCard } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useCreateSupplierCategory, useSupplierCategories, useDeleteSupplier, useSupplier, useUpdateSupplier } from "@/hooks/use-suppliers"
import { SUPPLIER_STATUSES, updateSupplierSchema, type UpdateSupplierInput } from "@/lib/validators/suppliers"
import { usePageTitle } from "@rms/ui/use-page-title"

function formatPurchaseOrderDate(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString()
}

export function SupplierDetail({ supplierId }: { supplierId: number }) {
  const router = useRouter()
  const { permissions, isSuperadmin } = useCurrentUser()
  const canManage = isSuperadmin || permissions.includes("suppliers.manage")

  const { data: history, isLoading } = useSupplier(supplierId)
  const showSkeleton = useDelayedLoading(isLoading)
  const { data: categories } = useSupplierCategories()
  const updateSupplier = useUpdateSupplier(supplierId)
  const deleteSupplier = useDeleteSupplier()
  const createCategory = useCreateSupplierCategory()
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryDescription, setNewCategoryDescription] = useState("")

  const supplier = history?.supplier

  const form = useForm<UpdateSupplierInput>({
    resolver: zodResolver(updateSupplierSchema),
    defaultValues: { companyName: "" },
  })

  useEffect(() => {
    if (supplier) {
      form.reset({
        companyName: supplier.companyName,
        contactPerson: supplier.contactPerson ?? "",
        phone: supplier.phone ?? "",
        altPhone: supplier.altPhone ?? "",
        email: supplier.email ?? "",
        address: supplier.address ?? "",
        city: supplier.city ?? "",
        state: supplier.state ?? "",
        postalCode: supplier.postalCode ?? "",
        country: supplier.country ?? "",
        panVat: supplier.panVat ?? "",
        registrationNo: supplier.registrationNo ?? "",
        website: supplier.website ?? "",
        notes: supplier.notes ?? "",
        categoryId: supplier.categoryId ?? undefined,
        defaultPaymentTerms: supplier.defaultPaymentTerms ?? "",
        creditLimit: supplier.creditLimit,
        rating: supplier.rating,
        status: supplier.status,
      })
    }
  }, [supplier, form])

  async function onSubmit(values: UpdateSupplierInput) {
    try {
      await updateSupplier.mutateAsync({ ...values, email: values.email || undefined })
      toast.success("Supplier updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update supplier")
    }
  }

  async function handleDelete() {
    try {
      await deleteSupplier.mutateAsync(supplierId)
      toast.success("Supplier deleted")
      router.push("/dashboard/suppliers")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete supplier")
    }
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return
    try {
      const category = await createCategory.mutateAsync({ name: newCategoryName, description: newCategoryDescription })
      form.setValue("categoryId", category.id, { shouldDirty: true, shouldValidate: true })
      setNewCategoryName("")
      setNewCategoryDescription("")
      setCategoryDialogOpen(false)
      toast.success("Supplier category created")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create supplier category")
    }
  }

  usePageTitle("Supplier Details")

  if (showSkeleton) return <DetailPageSkeleton fields={6} />
  if (!isLoading && !supplier) return <NotFoundCard resource="Supplier" />
  if (!supplier) return null

  const overLimit = supplier.creditLimit > 0 && supplier.outstandingBalance > supplier.creditLimit

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{supplier.companyName}</h1>
          <div className="flex items-center gap-1.5">
            <p className="text-sm text-muted-foreground">{supplier.supplierNo}</p>
            <StatusBadge status={supplier.status} />
          </div>
        </div>
        {canManage && (
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive">Delete</Button>} />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete supplier &quot;{supplier.companyName}&quot;?</AlertDialogTitle>
                <AlertDialogDescription>This cannot be undone from the UI.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={overLimit ? "text-xl font-semibold text-destructive" : "text-xl font-semibold"}>
              {Number(supplier.outstandingBalance).toFixed(2)}
            </p>
            {overLimit && <p className="text-xs text-destructive">Over credit limit ({Number(supplier.creditLimit).toFixed(2)})</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total purchased</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{Number(supplier.totalPurchased).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last purchase</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{supplier.lastPurchaseDate ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Purchase orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{history.purchaseOrderCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Goods received</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{history.goodsReceivedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Purchase returns</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{history.purchaseReturnCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{history.paymentCount}</p>
          </CardContent>
        </Card>
      </div>

      {history.recentPurchaseOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent purchase orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.recentPurchaseOrders.map((po) => (
              <div key={po.poNo} className="flex items-center justify-between text-sm">
                <span className="font-medium">{po.poNo}</span>
                <StatusBadge status={po.status} />
                <span className="text-muted-foreground">{Number(po.grandTotal).toFixed(2)}</span>
                <span className="text-muted-foreground">{formatPurchaseOrderDate(po.createdAt)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Company name</FormLabel>
                    <FormControl {...field} disabled={!canManage} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : "none"}
                      onValueChange={(value) => {
                        if (value === "create") {
                          setCategoryDialogOpen(true)
                          return
                        }
                        field.onChange(value === "none" ? undefined : Number(value))
                      }}
                      disabled={!canManage}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No category</SelectItem>
                        {canManage && <SelectItem value="create">+ Add new category</SelectItem>}
                        {categories?.map((category) => (
                          <SelectItem key={category.id} value={String(category.id)}>
                            {category.name}
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
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={!canManage}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPLIER_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
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
                name="contactPerson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact person</FormLabel>
                    <FormControl {...field} disabled={!canManage} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl {...field} disabled={!canManage} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="altPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alt. phone</FormLabel>
                    <FormControl {...field} disabled={!canManage} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl type="email" {...field} disabled={!canManage} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Address</FormLabel>
                    <FormControl {...field} disabled={!canManage} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="panVat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PAN / VAT</FormLabel>
                    <FormControl {...field} disabled={!canManage} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="registrationNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registration No.</FormLabel>
                    <FormControl {...field} disabled={!canManage} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="defaultPaymentTerms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment terms</FormLabel>
                    <FormControl placeholder="e.g. Net 30" {...field} disabled={!canManage} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="creditLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credit limit</FormLabel>
                    <FormControl
                      type="number"
                      step="0.01"
                      value={field.value ?? 0}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      disabled={!canManage}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rating (0-5)</FormLabel>
                    <FormControl
                      type="number"
                      step="1"
                      min={0}
                      max={5}
                      value={field.value ?? 0}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      disabled={!canManage}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Notes</FormLabel>
                    <FormControl {...field} disabled={!canManage} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              {canManage && (
                <Button type="submit" disabled={updateSupplier.isPending} className="col-span-2 w-fit">
                  {updateSupplier.isPending ? "Saving..." : "Save changes"}
                </Button>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add supplier category</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Category name" />
            <Input value={newCategoryDescription} onChange={(event) => setNewCategoryDescription(event.target.value)} placeholder="Description (optional)" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => void addCategory()} disabled={!newCategoryName.trim() || createCategory.isPending}>{createCategory.isPending ? "Adding..." : "Add category"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
