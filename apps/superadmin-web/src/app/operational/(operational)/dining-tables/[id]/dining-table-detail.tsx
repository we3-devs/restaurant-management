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
} from "@rms/ui/alert-dialog"
import { Button } from "@rms/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@rms/ui/card"
import { Checkbox } from "@rms/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@rms/ui/form"
import { Label } from "@rms/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rms/ui/select"
import { DetailPageSkeleton, NotFoundCard } from "@rms/ui/skeletons"
import { useDelayedLoading } from "@rms/ui/use-delayed-loading"
import { useDeleteDiningTable, useDiningTable, useUpdateDiningTable } from "@rms/api-client/hooks/use-dining-tables"
import { useOutlet } from "@rms/api-client/hooks/use-outlets"
import { DINING_TABLE_STATUSES, updateDiningTableSchema, type UpdateDiningTableInput } from "@rms/validators/dining-tables"

export function DiningTableDetail({ tableId }: { tableId: number }) {
  const router = useRouter()
  const { data: table, isLoading } = useDiningTable(tableId)
  const showSkeleton = useDelayedLoading(isLoading)
  const { data: outlet } = useOutlet(table?.outletId ?? 0)
  const updateTable = useUpdateDiningTable(tableId)
  const deleteTable = useDeleteDiningTable()

  const form = useForm<UpdateDiningTableInput>({
    resolver: zodResolver(updateDiningTableSchema),
    defaultValues: { name: "", code: "", capacity: 1, status: "available", isActive: true },
  })

  useEffect(() => {
    if (table) {
      form.reset({
        name: table.name,
        code: table.code ?? "",
        capacity: table.capacity,
        status: table.status as UpdateDiningTableInput["status"],
        isActive: table.isActive,
      })
    }
  }, [table, form])

  async function onSubmit(values: UpdateDiningTableInput) {
    try {
      await updateTable.mutateAsync({ ...values, code: values.code || undefined })
      toast.success("Table updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update table")
    }
  }

  async function handleDelete() {
    try {
      await deleteTable.mutateAsync(tableId)
      toast.success("Table deleted")
      router.push("/operational/dining-tables")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete table")
    }
  }

  if (showSkeleton) return <DetailPageSkeleton fields={5} />
  if (!isLoading && !table) return <NotFoundCard resource="Dining table" />
  if (!table) return null

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{table.name}</h1>
          <p className="text-sm text-muted-foreground">{outlet?.name ?? "Loading…"}</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive">Delete</Button>} />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete table &quot;{table.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>This permanently deletes the table (no soft delete). This cannot be undone.</AlertDialogDescription>
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
                    <FormLabel>Code (optional)</FormLabel>
                    <FormControl placeholder="e.g. A1" {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacity</FormLabel>
                    <FormControl
                      type="number"
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
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
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                      <SelectContent>
                        {DINING_TABLE_STATUSES.map((status) => (
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
              <Button type="submit" disabled={updateTable.isPending}>
                {updateTable.isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
