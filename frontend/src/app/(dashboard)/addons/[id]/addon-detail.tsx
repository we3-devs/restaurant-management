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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAddonGroups } from "@/hooks/use-addon-groups"
import { useAddon, useDeleteAddon, useUpdateAddon } from "@/hooks/use-addons"
import { updateAddonSchema, type UpdateAddonInput } from "@/lib/validators/addons"

export function AddonDetail({ addonId }: { addonId: number }) {
  const router = useRouter()
  const { data: addon, isLoading } = useAddon(addonId)
  const { data: addonGroups } = useAddonGroups({ limit: 100 })
  const updateAddon = useUpdateAddon(addonId)
  const deleteAddon = useDeleteAddon()

  const form = useForm<UpdateAddonInput>({
    resolver: zodResolver(updateAddonSchema),
    defaultValues: { addonGroupId: undefined, name: "", price: 0, isActive: true },
  })

  useEffect(() => {
    if (addon) {
      form.reset({
        addonGroupId: addon.addonGroupId ?? undefined,
        name: addon.name,
        price: addon.price,
        isActive: addon.isActive,
      })
    }
  }, [addon, form])

  async function onSubmit(values: UpdateAddonInput) {
    try {
      await updateAddon.mutateAsync(values)
      toast.success("Addon updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update addon")
    }
  }

  async function handleDelete() {
    try {
      await deleteAddon.mutateAsync(addonId)
      toast.success("Addon deleted")
      router.push("/addons")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete addon")
    }
  }

  if (isLoading || !addon) {
    return <Skeleton className="h-96 w-full max-w-2xl" />
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{addon.name}</h1>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive">Delete</Button>} />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete addon &quot;{addon.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>This soft-deletes the addon. This cannot be undone from the UI.</AlertDialogDescription>
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
                name="addonGroupId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Addon group</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : "none"}
                      onValueChange={(value) => field.onChange(value === "none" ? null : Number(value))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No group</SelectItem>
                        {addonGroups?.data.map((group) => (
                          <SelectItem key={group.id} value={String(group.id)}>
                            {group.name}
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
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
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
              <Button type="submit" disabled={updateAddon.isPending}>
                {updateAddon.isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
