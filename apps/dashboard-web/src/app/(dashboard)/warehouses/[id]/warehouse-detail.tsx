"use client"

import { useEffect } from "react"
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
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useDeleteWarehouse, useUpdateWarehouse, useWarehouse } from "@/hooks/use-warehouses"
import { updateWarehouseSchema, type UpdateWarehouseInput } from "@/lib/validators/warehouses"

export function WarehouseDetail({ warehouseId }: { warehouseId: number }) {
  const router = useRouter()
  const { data: warehouse, isLoading } = useWarehouse(warehouseId)
  const updateWarehouse = useUpdateWarehouse(warehouseId)
  const deleteWarehouse = useDeleteWarehouse()

  const form = useForm<UpdateWarehouseInput>({
    resolver: zodResolver(updateWarehouseSchema),
    defaultValues: { name: "", code: "", address: "", isDefault: false, isActive: true },
  })

  useEffect(() => {
    if (warehouse) {
      form.reset({
        name: warehouse.name,
        code: warehouse.code,
        address: warehouse.address ?? "",
        isDefault: warehouse.isDefault,
        isActive: warehouse.isActive,
      })
    }
  }, [warehouse, form])

  async function onSubmit(values: UpdateWarehouseInput) {
    try {
      await updateWarehouse.mutateAsync(values)
      toast.success("Warehouse updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update warehouse")
    }
  }

  async function handleDelete() {
    try {
      await deleteWarehouse.mutateAsync(warehouseId)
      toast.success("Warehouse deleted")
      router.push("/warehouses")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete warehouse")
    }
  }

  if (isLoading || !warehouse) {
    return <Skeleton className="h-96 w-full max-w-2xl" />
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{warehouse.name}</h1>
          <p className="text-sm text-muted-foreground">outlet #{warehouse.outletId}</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive">Delete</Button>} />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete warehouse &quot;{warehouse.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>This soft-deletes the warehouse. This cannot be undone from the UI.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="isDefault"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <Label htmlFor="isDefault">Default warehouse for this outlet</Label>
                  </div>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="isActive"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                )}
              />
              <Button type="submit" disabled={updateWarehouse.isPending}>
                {updateWarehouse.isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
