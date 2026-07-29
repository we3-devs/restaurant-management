"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAddonGroups } from "@/hooks/use-addon-groups"
import { useCreateAddon } from "@/hooks/use-addons"
import { createAddonSchema, type CreateAddonInput } from "@/lib/validators/addons"

export function CreateAddonDialog() {
  const [open, setOpen] = useState(false)
  const { data: addonGroups } = useAddonGroups({ limit: 100 })
  const createAddon = useCreateAddon()

  const form = useForm<CreateAddonInput>({
    resolver: zodResolver(createAddonSchema),
    defaultValues: { addonGroupId: undefined, name: "", price: 0 },
  })

  async function onSubmit(values: CreateAddonInput) {
    try {
      await createAddon.mutateAsync(values)
      toast.success(`Addon "${values.name}" created`)
      form.reset({ addonGroupId: undefined, name: "", price: 0 })
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create addon")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create addon</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create addon</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="addonGroupId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Addon group (optional)</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : "none"}
                    onValueChange={(value) => field.onChange(value === "none" ? undefined : Number(value))}
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
                  <FormControl placeholder="Extra cheese" {...field} />
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
            <DialogFooter>
              <Button type="submit" disabled={createAddon.isPending}>
                {createAddon.isPending ? "Creating..." : "Create addon"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
