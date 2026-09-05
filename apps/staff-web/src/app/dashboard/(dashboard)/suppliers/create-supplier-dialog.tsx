"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { useOutlets } from "@/hooks/use-outlets"
import { useCreateSupplier, useCreateSupplierCategory, useSupplierCategories } from "@/hooks/use-suppliers"
import {
  SUPPLIER_STATUSES,
  createSupplierSchema,
  type CreateSupplierInput,
} from "@/lib/validators/suppliers"

const defaultValues: CreateSupplierInput = {
  companyName: "",
  outletId: 0,
  contactPerson: "",
  phone: "",
  email: "",
  categoryId: undefined,
  defaultPaymentTerms: "",
  creditLimit: 0,
  status: "active",
}

export function CreateSupplierDialog() {
  const [open, setOpen] = useState(false)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryDescription, setNewCategoryDescription] = useState("")
  const { data: outlets, isLoading: outletsLoading } = useOutlets({ limit: 100 })
  const { data: categories, isLoading: categoriesLoading } = useSupplierCategories()
  const createSupplier = useCreateSupplier()
  const createCategory = useCreateSupplierCategory()

  const form = useForm<CreateSupplierInput>({
    resolver: zodResolver(createSupplierSchema),
    defaultValues,
  })

  async function onSubmit(values: CreateSupplierInput) {
    try {
      await createSupplier.mutateAsync({
        ...values,
        email: values.email || undefined,
      })
      toast.success("Supplier created")
      form.reset(defaultValues)
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create supplier")
    }
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return
    try {
      const category = await createCategory.mutateAsync({ name: newCategoryName, description: newCategoryDescription })
      form.setValue("categoryId", category.id, { shouldValidate: true })
      setNewCategoryName("")
      setNewCategoryDescription("")
      setCategoryDialogOpen(false)
      toast.success("Supplier category created")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create supplier category")
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create supplier</Button>} />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create supplier</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Company name</FormLabel>
                  <FormControl {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="outletId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Outlet</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <SelectTrigger className="w-full" disabled={outletsLoading}>
                      <SelectValue placeholder={outletsLoading ? "Loading…" : "Select an outlet"} />
                    </SelectTrigger>
                    <SelectContent>
                      {outlets?.data.map((outlet) => (
                        <SelectItem key={outlet.id} value={String(outlet.id)}>
                          {outlet.name}
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
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category (optional)</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : "none"}
                    onValueChange={(value) => {
                      if (value === "create") {
                        setCategoryDialogOpen(true)
                        return
                      }
                      field.onChange(value === "none" ? undefined : Number(value))
                    }}
                  >
                    <div className="flex gap-2"><SelectTrigger className="flex-1" disabled={categoriesLoading}><SelectValue placeholder={categoriesLoading ? "Loading…" : "Select a category"} /></SelectTrigger><Button type="button" variant="outline" size="icon" onClick={() => setCategoryDialogOpen(true)} aria-label="Add supplier category">+</Button></div>
                    <SelectContent>
                      <SelectItem value="none">No category</SelectItem>
                      <SelectItem value="create">+ Add new category</SelectItem>
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
              name="contactPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact person</FormLabel>
                  <FormControl {...field} />
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
                  <FormControl {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Email</FormLabel>
                  <FormControl type="email" {...field} />
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
                  <FormControl placeholder="e.g. Net 30" {...field} />
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
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
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
            <DialogFooter className="col-span-2">
              <Button type="submit" disabled={createSupplier.isPending}>
                {createSupplier.isPending ? "Creating..." : "Create supplier"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add supplier category</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Category name" />
          <Input value={newCategoryDescription} onChange={(event) => setNewCategoryDescription(event.target.value)} placeholder="Description (optional)" />
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)}>Cancel</Button><Button type="button" onClick={() => void addCategory()} disabled={!newCategoryName.trim() || createCategory.isPending}>{createCategory.isPending ? "Adding..." : "Add category"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
