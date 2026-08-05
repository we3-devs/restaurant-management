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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Skeleton } from "@/components/ui/skeleton"
import { useDeleteOutlet, useOutlet, useUpdateOutlet } from "@/hooks/use-outlets"
import { updateOutletSchema, type UpdateOutletInput } from "@/lib/validators/outlets"

export function OutletDetail({ outletId }: { outletId: number }) {
  const router = useRouter()
  const { data: outlet, isLoading } = useOutlet(outletId)
  const updateOutlet = useUpdateOutlet(outletId)
  const deleteOutlet = useDeleteOutlet()

  const form = useForm<UpdateOutletInput>({
    resolver: zodResolver(updateOutletSchema),
    defaultValues: { name: "" },
  })

  useEffect(() => {
    if (outlet) {
      form.reset({ name: outlet.name })
    }
  }, [outlet, form])

  async function onSubmit(values: UpdateOutletInput) {
    try {
      await updateOutlet.mutateAsync(values)
      toast.success("Outlet updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update outlet")
    }
  }

  async function handleDelete() {
    try {
      await deleteOutlet.mutateAsync(outletId)
      toast.success("Outlet deleted")
      router.push("/outlets")
    } catch (error) {
      // 409 (departments/warehouses/orders/etc. still reference it) surfaces the backend's message here.
      toast.error(error instanceof Error ? error.message : "Failed to delete outlet")
    }
  }

  if (isLoading || !outlet) {
    return <Skeleton className="h-64 w-full max-w-2xl" />
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{outlet.name}</h1>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive">Delete</Button>} />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete outlet &quot;{outlet.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes any departments and warehouses under this outlet too. If orders,
                reservations, or other records still reference it, the delete will be rejected instead.
              </AlertDialogDescription>
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
              <Button type="submit" disabled={updateOutlet.isPending}>
                {updateOutlet.isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
