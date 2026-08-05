"use client"

import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useCustomer, useCustomerOutlets, useUpdateCustomer, useUpdateCustomerOutlet } from "@/hooks/use-customers"
import { useOutlets } from "@/hooks/use-outlets"
import { updateCustomerSchema, type UpdateCustomerInput } from "@/lib/validators/customers"

export function CustomerDetail({ customerId }: { customerId: number }) {
  const { data: customer, isLoading } = useCustomer(customerId)
  const updateCustomer = useUpdateCustomer(customerId)

  const form = useForm<UpdateCustomerInput>({
    resolver: zodResolver(updateCustomerSchema),
    defaultValues: { name: "", phone: "", email: "", address: "" },
  })

  useEffect(() => {
    if (customer) {
      form.reset({
        name: customer.name,
        phone: customer.phone ?? "",
        email: customer.email ?? "",
        address: customer.address ?? "",
      })
    }
  }, [customer, form])

  async function onSubmit(values: UpdateCustomerInput) {
    try {
      await updateCustomer.mutateAsync(values)
      toast.success("Customer updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update customer")
    }
  }

  if (isLoading || !customer) {
    return <Skeleton className="h-96 w-full max-w-2xl" />
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">{customer.name}</h1>
        <div className="flex items-center gap-1.5">
          <p className="text-sm text-muted-foreground">{customer.email ?? customer.phone ?? "No contact info"}</p>
          <Badge variant={customer.isActive ? "secondary" : "destructive"}>
            {customer.isActive ? "active" : "inactive"}
          </Badge>
        </div>
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
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl type="email" {...field} />
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
              <Button type="submit" disabled={updateCustomer.isPending}>
                {updateCustomer.isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <CustomerOutletsSection customerId={customerId} />
    </div>
  )
}

function CustomerOutletsSection({ customerId }: { customerId: number }) {
  const { data: visits } = useCustomerOutlets(customerId)
  const { data: outlets } = useOutlets({ limit: 100 })
  const updateOutlet = useUpdateCustomerOutlet(customerId)

  const outletName = (outletId: number) => outlets?.data.find((o) => o.id === outletId)?.name ?? `#${outletId}`

  async function handleToggleFavorite(outletId: number, isFavoriteOutlet: boolean) {
    try {
      await updateOutlet.mutateAsync({ outletId, isFavoriteOutlet })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update favorite outlet")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Outlets visited</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {(visits ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No visits recorded yet.</p>
        )}
        {(visits ?? []).map((visit) => (
          <div key={visit.id} className="flex items-center justify-between gap-2 rounded-lg border border-input p-3">
            <div>
              <p className="font-medium">{outletName(visit.outletId)}</p>
              <p className="text-xs text-muted-foreground">
                {visit.visitCount} visit{visit.visitCount === 1 ? "" : "s"}
                {visit.lastVisitedAt && ` · last ${new Date(visit.lastVisitedAt).toLocaleDateString()}`}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Checkbox
                id={`favorite-${visit.id}`}
                checked={visit.isFavoriteOutlet}
                onCheckedChange={(checked) => handleToggleFavorite(visit.outletId, checked === true)}
              />
              <Label htmlFor={`favorite-${visit.id}`}>Favorite</Label>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
