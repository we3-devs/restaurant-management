"use client"

import { useState } from "react"
import { PlusIcon, SearchIcon, UserIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@rms/ui/badge"
import { Button } from "@rms/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@rms/ui/dialog"
import { Input } from "@rms/ui/input"
import { Label } from "@rms/ui/label"
import { TableSkeleton } from "@rms/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rms/ui/table"
import { useDelayedLoading } from "@rms/ui/use-delayed-loading"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { useLoyaltyAccount } from "@rms/api-client/hooks/use-loyalty"
import {
  useCreateCustomer,
  useCustomerOutlets,
  useCustomers,
  useUpdateCustomer,
  type Customer,
} from "@rms/api-client/hooks/use-customers"

/**
 * Quick customer lookup for the counter — mainly used by cashiers to find a
 * returning guest (for loyalty redemption) or add a walk-in on the spot.
 * Deliberately not the dashboard's full data-table (dashboard-web
 * /customers): no pagination controls, no delete, just search + create/edit
 * sized for a phone screen mid-transaction.
 */
export default function StaffCustomersPage() {
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Customer | null>(null)
  const { data, isLoading } = useCustomers({ search: search || undefined, limit: 50 })
  const showSkeleton = useDelayedLoading(isLoading)
  const customers = data?.data ?? []

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Customers</h1>
        <NewCustomerDialog />
      </div>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, or email..."
          className="pl-8"
        />
      </div>

      {showSkeleton && <TableSkeleton rows={8} columns={3} />}
      {!showSkeleton && customers.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {search ? "No customers match your search." : "No customers yet."}
        </p>
      )}

      {!showSkeleton && customers.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Loyalty points</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <CustomerRow key={customer.id} customer={customer} onSelect={() => setSelected(customer)} />
            ))}
          </TableBody>
        </Table>
      )}

      {selected && <CustomerDetailDialog customer={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function CustomerRow({ customer, onSelect }: { customer: Customer; onSelect: () => void }) {
  const { data: loyalty } = useLoyaltyAccount(customer.id)

  return (
    <TableRow className="cursor-pointer" onClick={onSelect}>
      <TableCell className="font-medium">{customer.name}</TableCell>
      <TableCell>{loyalty?.currentPoints ?? 0}</TableCell>
      <TableCell>
        <Badge variant={customer.isActive ? "secondary" : "destructive"}>
          {customer.isActive ? "active" : "inactive"}
        </Badge>
      </TableCell>
    </TableRow>
  )
}

function NewCustomerDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const createCustomer = useCreateCustomer()

  async function handleCreate() {
    if (name.trim().length < 2) {
      toast.error("Name must be at least 2 characters")
      return
    }
    try {
      await createCustomer.mutateAsync({
        name: name.trim(),
        phone: phone || undefined,
        email: email || undefined,
      })
      toast.success(`Customer "${name}" created`)
      setName("")
      setPhone("")
      setEmail("")
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create customer")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <PlusIcon className="size-4" />
            New
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New customer</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="space-y-1">
            <Label>Phone (optional)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="555-0100" />
          </div>
          <div className="space-y-1">
            <Label>Email (optional)</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={createCustomer.isPending} className="w-full">
            {createCustomer.isPending ? "Creating..." : "Create customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CustomerDetailDialog({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { outletId } = useActiveOutlet()
  const { data: loyalty } = useLoyaltyAccount(customer.id)
  const { data: outlets } = useCustomerOutlets(customer.id)
  const updateCustomer = useUpdateCustomer(customer.id)
  const visit = outlets?.find((o) => o.outletId === outletId)

  const [name, setName] = useState(customer.name)
  const [phone, setPhone] = useState(customer.phone ?? "")
  const [email, setEmail] = useState(customer.email ?? "")

  async function handleSave() {
    if (name.trim().length < 2) {
      toast.error("Name must be at least 2 characters")
      return
    }
    try {
      await updateCustomer.mutateAsync({
        name: name.trim(),
        phone: phone || undefined,
        email: email || undefined,
      })
      toast.success("Customer updated")
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update customer")
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="size-4" />
            {customer.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-input p-2 text-sm">
            <span className="text-muted-foreground">Loyalty points</span>
            <span className="font-medium">{loyalty?.currentPoints ?? 0}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-input p-2 text-sm">
            <span className="text-muted-foreground">Visits at this outlet</span>
            <span className="font-medium">{visit?.visitCount ?? 0}</span>
          </div>
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={updateCustomer.isPending} className="w-full">
            {updateCustomer.isPending ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
