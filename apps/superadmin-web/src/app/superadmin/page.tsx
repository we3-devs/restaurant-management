"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useDeleteSuperadminTenant, useUpdateSuperadminTenant } from "@/hooks/use-outlets"
import { queryKeys } from "@/lib/query-keys"
import { usePageTitle } from "@rms/ui/use-page-title"

type Outlet = { id: number; name: string; slug: string; tenantId: number }
type Tenant = { id: number; name: string; slug: string; isActive: boolean; outlets?: Outlet[] }

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`/api/backend${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.message ?? "Request failed")
  return body?.data ?? body
}

export default function SuperadminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState("")
  const updateTenant = useUpdateSuperadminTenant()
  const deleteTenant = useDeleteSuperadminTenant()
  usePageTitle("Tenant Management")

  const load = async () => {
    setLoading(true)
    try { setTenants(await api("/superadmin/tenants")) }
    catch (error) { toast.error(error instanceof Error ? error.message : "Failed to load tenants") }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  async function createTenant(event: React.FormEvent) {
    event.preventDefault()
    try {
      await api("/superadmin/tenants", { method: "POST", body: JSON.stringify({ name, slug }) })
      setName(""); setSlug(""); toast.success("Tenant created")
      await queryClient.invalidateQueries({ queryKey: queryKeys.outlets.superadminTenants() })
      await load()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to create tenant") }
  }

  async function moveOutlet(outletId: number, tenantId: number) {
    const outlet = tenants.flatMap((item) => item.outlets ?? []).find((item) => item.id === outletId)
    const targetTenant = tenants.find((item) => item.id === tenantId)
    if (!outlet || !targetTenant || outlet.tenantId === tenantId) return
    const confirmed = window.confirm(
      `Move "${outlet.name}" to "${targetTenant.name}"? This changes tenant visibility for its ingredients, inventory, purchase orders, and related outlet data.`,
    )
    if (!confirmed) {
      await load()
      return
    }
    try { await api(`/superadmin/outlets/${outletId}/tenant`, { method: "PATCH", body: JSON.stringify({ tenantId }) }); toast.success("Outlet moved"); await load() }
    catch (error) { toast.error(error instanceof Error ? error.message : "Failed to move outlet") }
  }

  function beginEdit(tenant: Tenant) {
    setEditingId(tenant.id)
    setEditName(tenant.name)
  }

  async function saveTenant(tenant: Tenant) {
    if (!editName.trim()) return
    try {
      await updateTenant.mutateAsync({ id: tenant.id, name: editName.trim() })
      toast.success("Tenant updated")
      setEditingId(null)
      await load()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to update tenant") }
  }

  async function toggleTenant(tenant: Tenant) {
    try {
      await updateTenant.mutateAsync({ id: tenant.id, isActive: !tenant.isActive })
      toast.success(tenant.isActive ? "Tenant deactivated" : "Tenant activated")
      await load()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to update tenant status") }
  }

  async function deleteTenantRecord(tenant: Tenant) {
    if (!window.confirm(`Delete tenant "${tenant.name}"? This is only allowed when no users, outlets, or related records reference it.`)) return
    try {
      await deleteTenant.mutateAsync(tenant.id)
      toast.success("Tenant deleted")
      await load()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to delete tenant") }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div><h1 className="text-2xl font-semibold">Tenant Management</h1><p className="text-sm text-muted-foreground">Manage tenant ownership. Moving an outlet also moves the tenant ownership of its ingredients, inventory, purchase orders, and related records.</p></div>
      <form onSubmit={createTenant} className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <label className="grid gap-1 text-sm">Tenant name<input className="h-9 rounded-md border bg-background px-3" value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label className="grid gap-1 text-sm">Slug<input className="h-9 rounded-md border bg-background px-3" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} pattern="[a-z0-9-]+" required /></label>
        <Button type="submit">Create tenant</Button>
      </form>
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : tenants.map((tenant) => (
        <section key={tenant.id} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {editingId === tenant.id ? (
                <div className="flex flex-wrap gap-2">
                  <input className="h-9 min-w-56 rounded-md border bg-background px-3" value={editName} onChange={(event) => setEditName(event.target.value)} />
                  <Button size="sm" onClick={() => void saveTenant(tenant)} disabled={updateTenant.isPending}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              ) : <h2 className="font-semibold">{tenant.name}</h2>}
              <p className="text-sm text-muted-foreground">{tenant.slug} · {tenant.isActive ? "Active" : "Inactive"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Tenant #{tenant.id}</span>
              <Button size="sm" variant="outline" onClick={() => beginEdit(tenant)}>Edit</Button>
              <Button size="sm" variant="outline" onClick={() => void toggleTenant(tenant)} disabled={updateTenant.isPending}>{tenant.isActive ? "Deactivate" : "Activate"}</Button>
              <Button size="sm" variant="destructive" onClick={() => void deleteTenantRecord(tenant)} disabled={deleteTenant.isPending}>Delete</Button>
            </div>
          </div>
          <div className="mt-4 space-y-2">{(tenant.outlets ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No outlets assigned.</p> : tenant.outlets?.map((outlet) => <div key={outlet.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2"><span>{outlet.name} <span className="text-xs text-muted-foreground">({outlet.slug})</span></span><select className="h-8 rounded-md border bg-background px-2 text-sm" value={tenant.id} onChange={(e) => void moveOutlet(outlet.id, Number(e.target.value))}>{tenants.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></div>)}</div>
        </section>
      ))}
    </div>
  )
}
