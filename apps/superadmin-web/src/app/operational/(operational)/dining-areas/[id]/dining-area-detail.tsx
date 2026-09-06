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
import { DetailPageSkeleton, NotFoundCard } from "@rms/ui/skeletons"
import { useDelayedLoading } from "@rms/ui/use-delayed-loading"
import { useDeleteDiningArea, useDiningArea, useUpdateDiningArea } from "@rms/api-client/hooks/use-dining-areas"
import { updateDiningAreaSchema, type UpdateDiningAreaInput } from "@rms/validators/dining-areas"

export function DiningAreaDetail({ areaId }: { areaId: number }) {
  const router = useRouter()
  const { data: area, isLoading } = useDiningArea(areaId)
  const showSkeleton = useDelayedLoading(isLoading)
  const updateArea = useUpdateDiningArea(areaId)
  const deleteArea = useDeleteDiningArea()

  const form = useForm<UpdateDiningAreaInput>({
    resolver: zodResolver(updateDiningAreaSchema),
    defaultValues: { name: "", code: "", isActive: true },
  })

  useEffect(() => {
    if (area) {
      form.reset({ name: area.name, code: area.code ?? "", isActive: area.isActive })
    }
  }, [area, form])

  async function onSubmit(values: UpdateDiningAreaInput) {
    try {
      await updateArea.mutateAsync(values)
      toast.success("Dining area updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update dining area")
    }
  }

  async function handleDelete() {
    try {
      await deleteArea.mutateAsync(areaId)
      toast.success("Dining area deleted")
      router.push("/operational/dining-areas")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete dining area")
    }
  }

  if (showSkeleton) return <DetailPageSkeleton fields={4} />
  if (!isLoading && !area) return <NotFoundCard resource="Dining area" />
  if (!area) return null

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{area.name}</h1>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive">Delete</Button>} />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete dining area &quot;{area.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes any tables under this area too (no soft delete). This cannot be undone.
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
              <Button type="submit" disabled={updateArea.isPending}>
                {updateArea.isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
