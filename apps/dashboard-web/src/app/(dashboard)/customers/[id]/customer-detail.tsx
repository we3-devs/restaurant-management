"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { DetailPageSkeleton, NotFoundCard } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useCustomer, useCustomerOutlets, useUpdateCustomer, useUpdateCustomerOutlet } from "@/hooks/use-customers"
import {
  useCustomerCreditAccount,
  useCustomerCreditTransactions,
  useSetCustomerCreditLimit,
  useSettleCustomerDebt,
} from "@/hooks/use-customer-credit"
import { useOutlets } from "@/hooks/use-outlets"
import { updateCustomerSchema, type UpdateCustomerInput } from "@/lib/validators/customers"
import { settleCustomerDebtSchema, type SettleCustomerDebtInput } from "@/lib/validators/customer-credit"

export function CustomerDetail({ customerId }: { customerId: number }) {
  const { data: customer, isLoading } = useCustomer(customerId)
  const showSkeleton = useDelayedLoading(isLoading)
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

  if (showSkeleton) return <DetailPageSkeleton fields={4} />
  if (!isLoading && !customer) return <NotFoundCard resource="Customer" />
  if (!customer) return null

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

      <CustomerCreditSection customerId={customerId} />

      <CustomerOutletsSection customerId={customerId} />
    </div>
  )
}

function CustomerCreditSection({ customerId }: { customerId: number }) {
  const { data: account } = useCustomerCreditAccount(customerId)
  const { data: transactions } = useCustomerCreditTransactions({ customerId, limit: 10 })
  const setCreditLimit = useSetCustomerCreditLimit(customerId)
  const [creditLimitInput, setCreditLimitInput] = useState("")

  async function handleSaveCreditLimit() {
    const creditLimit = Number(creditLimitInput)
    if (Number.isNaN(creditLimit) || creditLimit < 0) return
    try {
      await setCreditLimit.mutateAsync({ creditLimit })
      toast.success("Credit limit updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update credit limit")
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Credit / tab</CardTitle>
        <SettleCustomerDebtDialog customerId={customerId} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-4">
          <span className="text-muted-foreground">Outstanding balance</span>
          <span className={account && account.outstandingBalance > 0 ? "font-medium text-destructive" : "font-medium"}>
            {account?.outstandingBalance ?? 0}
          </span>
          <span className="text-muted-foreground">Credit limit</span>
          <span className="font-medium">{account?.creditLimit ?? 0}</span>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="credit-limit">Set credit limit</Label>
            <input
              id="credit-limit"
              type="number"
              step="0.01"
              min="0"
              placeholder={String(account?.creditLimit ?? 0)}
              value={creditLimitInput}
              onChange={(e) => setCreditLimitInput(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveCreditLimit}
            disabled={setCreditLimit.isPending || creditLimitInput === ""}
          >
            {setCreditLimit.isPending ? "Saving..." : "Save"}
          </Button>
        </div>

        {(transactions?.data.length ?? 0) > 0 && (
          <div className="space-y-1 border-t border-input pt-3">
            {transactions?.data.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <Badge variant={transaction.amount < 0 ? "secondary" : "destructive"}>{transaction.type}</Badge>
                  <span className="text-muted-foreground">
                    {new Date(transaction.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <span>{transaction.amount}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SettleCustomerDebtDialog({ customerId }: { customerId: number }) {
  const [open, setOpen] = useState(false)
  const settleDebt = useSettleCustomerDebt()

  const form = useForm<SettleCustomerDebtInput>({
    resolver: zodResolver(settleCustomerDebtSchema),
    defaultValues: { customerId, amount: 0, notes: "" },
  })

  async function onSubmit(values: SettleCustomerDebtInput) {
    try {
      await settleDebt.mutateAsync({ ...values, notes: values.notes || undefined })
      toast.success("Debt settled")
      form.reset({ customerId, amount: 0, notes: "" })
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to settle debt")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Settle debt</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settle customer debt</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={settleDebt.isPending}>
                {settleDebt.isPending ? "Saving..." : "Settle debt"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
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
