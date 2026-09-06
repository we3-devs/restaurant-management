"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@rms/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@rms/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@rms/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rms/ui/select"
import { useCreateDiningArea } from "@rms/api-client/hooks/use-dining-areas"
import { useOutlets } from "@rms/api-client/hooks/use-outlets"
import { createDiningAreaSchema, type CreateDiningAreaInput } from "@rms/validators/dining-areas"

export function CreateDiningAreaDialog() {
  const [open, setOpen] = useState(false)
  const { data: outlets, isLoading: outletsLoading } = useOutlets({ limit: 100 })
  const createDiningArea = useCreateDiningArea()
  const form = useForm<CreateDiningAreaInput>({ resolver: zodResolver(createDiningAreaSchema), defaultValues: { outletId: 0, name: "", code: "" } })

  async function onSubmit(values: CreateDiningAreaInput) {
    try {
      await createDiningArea.mutateAsync({ ...values, code: values.code || undefined })
      toast.success(`Dining area "${values.name}" created`)
      form.reset({ outletId: 0, name: "", code: "" })
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create dining area")
    }
  }

  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button>Create dining area</Button>} /><DialogContent><DialogHeader><DialogTitle>Create dining area</DialogTitle></DialogHeader><Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4"><FormField control={form.control} name="outletId" render={({ field }) => <FormItem><FormLabel>Outlet</FormLabel><Select value={field.value ? String(field.value) : ""} onValueChange={(value) => field.onChange(Number(value))}><SelectTrigger className="w-full" disabled={outletsLoading}><SelectValue placeholder={outletsLoading ? "Loading…" : "Select an outlet"} /></SelectTrigger><SelectContent>{outlets?.data.map((outlet) => <SelectItem key={outlet.id} value={String(outlet.id)}>{outlet.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} /><FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl placeholder="Main Hall" {...field} /><FormMessage /></FormItem>} /><FormField control={form.control} name="code" render={({ field }) => <FormItem><FormLabel>Code (optional)</FormLabel><FormControl placeholder="MAIN" {...field} /><FormMessage /></FormItem>} /><DialogFooter><Button type="submit" disabled={createDiningArea.isPending}>{createDiningArea.isPending ? "Creating..." : "Create dining area"}</Button></DialogFooter></form></Form></DialogContent></Dialog>
}
