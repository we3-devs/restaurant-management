"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Label } from "@/components/ui/label"
import { useCreateAddonGroup } from "@/hooks/use-addon-groups"
import { createAddonGroupSchema, type CreateAddonGroupInput } from "@/lib/validators/addon-groups"

export function CreateAddonGroupDialog() {
  const [open, setOpen] = useState(false)
  const createAddonGroup = useCreateAddonGroup()

  const form = useForm<CreateAddonGroupInput>({
    resolver: zodResolver(createAddonGroupSchema),
    defaultValues: { name: "", isRequired: false, minSelect: 0 },
  })

  async function onSubmit(values: CreateAddonGroupInput) {
    try {
      await createAddonGroup.mutateAsync(values)
      toast.success(`Addon group "${values.name}" created`)
      form.reset({ name: "", isRequired: false, minSelect: 0 })
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create addon group")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create addon group</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create addon group</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl placeholder="Choose your sauce" {...field} />
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
            <DialogFooter>
              <Button type="submit" disabled={createAddonGroup.isPending}>
                {createAddonGroup.isPending ? "Creating..." : "Create addon group"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
