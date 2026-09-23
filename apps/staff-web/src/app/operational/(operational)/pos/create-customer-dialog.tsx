"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@rms/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@rms/ui/dialog"
import { Input } from "@rms/ui/input"
import { Label } from "@rms/ui/label"
import { useCreateCustomer } from "@rms/api-client/hooks/use-customers"

export function CreateCustomerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (customer: { id: number }) => void
}) {
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
      const customer = await createCustomer.mutateAsync({
        name: name.trim(),
        phone: phone || undefined,
        email: email || undefined,
      })
      onCreated(customer)
      toast.success(`Customer "${customer.name}" created`)
      setName("")
      setPhone("")
      setEmail("")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create customer")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create customer</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="space-y-1">
            <Label>Phone (optional)</Label>
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="555-0100" />
          </div>
          <div className="space-y-1">
            <Label>Email (optional)</Label>
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="jane@example.com" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={createCustomer.isPending}>
            {createCustomer.isPending ? "Creating..." : "Create customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
