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
import { DetailPageSkeleton, NotFoundCard } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useAddonGroup, useDeleteAddonGroup, useUpdateAddonGroup } from "@/hooks/use-addon-groups"
import { updateAddonGroupSchema, type UpdateAddonGroupInput } from "@/lib/validators/addon-groups"
import { usePageTitle } from "@rms/ui/use-page-title"

export function AddonGroupDetail({ addonGroupId }: { addonGroupId: number }) {
  const router = useRouter()
  const { data: addonGroup, isLoading } = useAddonGroup(addonGroupId)
  const showSkeleton = useDelayedLoading(isLoading)
  const updateAddonGroup = useUpdateAddonGroup(addonGroupId)
  const deleteAddonGroup = useDeleteAddonGroup()

  const form = useForm<UpdateAddonGroupInput>({
    resolver: zodResolver(updateAddonGroupSchema),
    defaultValues: { name: "", isRequired: false, minSelect: 0, isActive: true },
  })

  useEffect(() => {
    if (addonGroup) {
      form.reset({
        name: addonGroup.name,
        isRequired: addonGroup.isRequired,
        minSelect: addonGroup.minSelect,
        maxSelect: addonGroup.maxSelect ?? undefined,
        isActive: addonGroup.isActive,
      })
    }
  }, [addonGroup, form])

  async function onSubmit(values: UpdateAddonGroupInput) {
    try {
      await updateAddonGroup.mutateAsync(values)
      toast.success("Addon group updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update addon group")
    }
  }

  async function handleDelete() {
    try {
      await deleteAddonGroup.mutateAsync(addonGroupId)
      toast.success("Addon group deleted")
      router.push("/dashboard/addon-groups")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete addon group")
    }
  }

  usePageTitle("Addon Group Details")

  if (showSkeleton) return <DetailPageSkeleton fields={4} />
  if (!isLoading && !addonGroup) return <NotFoundCard resource="Addon group" />
  if (!addonGroup) return null

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{addonGroup.name}</h1>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive">Delete</Button>} />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete addon group &quot;{addonGroup.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>This soft-deletes the addon group. This cannot be undone from the UI.</AlertDialogDescription>
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
                name="minSelect"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum selections</FormLabel>
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
                name="maxSelect"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum selections (optional)</FormLabel>
                    <FormControl
                      type="number"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isRequired"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="isRequired"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <Label htmlFor="isRequired">Required</Label>
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
              <Button type="submit" disabled={updateAddonGroup.isPending}>
                {updateAddonGroup.isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
