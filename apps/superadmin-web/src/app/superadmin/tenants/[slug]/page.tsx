"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useDeleteSuperadminTenant, useUpdateSuperadminTenant } from "@/hooks/use-outlets"
import { usePageTitle } from "@rms/ui/use-page-title"

type Outlet = { id: number; name: string; slug: string; tenantId: number }
type Tenant = { id: number; name: string; slug: string; isActive: boolean; attendanceRequired: boolean; outlets?: Outlet[] }
type ModuleSummary = { key: string; label: string; count: number; scope: "tenant" | "outlet" }

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`/api/backend${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.message ?? "Request failed")
  return body?.data ?? body
}

export default function TenantDetailPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [modules, setModules] = useState<ModuleSummary[]>([])
  const [outletName, setOutletName] = useState("")
  const [loading, setLoading] = useState(true)
  const updateTenant = useUpdateSuperadminTenant()
  const deleteTenant = useDeleteSuperadminTenant()
  usePageTitle(tenant ? `${tenant.name} · Tenant` : "Tenant")

  async function load() {
    setLoading(true)
    try {
      const tenants = await api("/tenants") as Tenant[]
      const found = tenants.find((item) => item.slug === params.slug)
      if (!found) throw new Error("Tenant not found")
      setTenant(found)
      const summary = await api(`/tenants/${found.id}/summary`)
      setModules(summary.modules ?? [])
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to load tenant"); setTenant(null) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [params.slug])

  async function toggleAttendance() {
    if (!tenant) return
    try { await updateTenant.mutateAsync({ id: tenant.id, attendanceRequired: !tenant.attendanceRequired }); toast.success("Attendance setting updated"); await load() }
    catch (error) { toast.error(error instanceof Error ? error.message : "Failed to update attendance setting") }
  }

  async function toggleStatus() {
    if (!tenant) return
    try { await updateTenant.mutateAsync({ id: tenant.id, isActive: !tenant.isActive }); toast.success(tenant.isActive ? "Tenant deactivated" : "Tenant activated"); await load() }
    catch (error) { toast.error(error instanceof Error ? error.message : "Failed to update tenant status") }
  }

  async function importRoles() {
    if (!tenant) return
    try { const result = await api(`/roles/templates/import/${tenant.id}`, { method: "POST" }); toast.success(result?.imported?.length ? `Imported ${result.imported.length} roles` : "Roles are already available"); await load() }
    catch (error) { toast.error(error instanceof Error ? error.message : "Failed to import roles") }
  }

  async function createOutlet() {
    if (!tenant || !outletName.trim()) return
    try { await api(`/tenants/${tenant.id}/outlets`, { method: "POST", body: JSON.stringify({ name: outletName.trim() }) }); setOutletName(""); toast.success("Outlet created"); await load() }
    catch (error) { toast.error(error instanceof Error ? error.message : "Failed to create outlet") }
  }

  async function removeTenant() {
    if (!tenant || !window.confirm(`Delete tenant "${tenant.name}"?`)) return
    try { await deleteTenant.mutateAsync(tenant.id); toast.success("Tenant deleted"); router.push("/superadmin/tenants") }
    catch (error) { toast.error(error instanceof Error ? error.message : "Failed to delete tenant") }
  }

  if (loading) return <p className="mx-auto max-w-6xl text-sm text-muted-foreground">Loading tenant…</p>
  if (!tenant) return <div className="mx-auto max-w-6xl space-y-3"><p className="text-sm text-muted-foreground">Tenant not found.</p><Button variant="outline" render={<Link href="/superadmin/tenants" />}>Back to tenants</Button></div>

  return <div className="mx-auto w-full max-w-6xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><Button variant="ghost" size="sm" render={<Link href="/superadmin/tenants" />}>← Tenants</Button><h1 className="mt-2 text-2xl font-semibold">{tenant.name}</h1><p className="text-sm text-muted-foreground">{tenant.slug} · Tenant #{tenant.id} · {tenant.isActive ? "Active" : "Inactive"}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { window.localStorage.setItem("active-tenant-slug", tenant.slug); window.location.assign("/dashboard") }}>Open workspace</Button><Button variant="outline" onClick={() => void importRoles()}>Import roles</Button><Button variant="outline" onClick={() => void toggleAttendance()} disabled={updateTenant.isPending}>{tenant.attendanceRequired ? "Attendance required" : "Attendance not required"}</Button><Button variant="outline" onClick={() => void toggleStatus()} disabled={updateTenant.isPending}>{tenant.isActive ? "Deactivate" : "Activate"}</Button><Button variant="destructive" onClick={() => void removeTenant()} disabled={deleteTenant.isPending}>Delete</Button></div></div>
    <section className="rounded-xl border p-4"><h2 className="font-semibold">Outlets</h2><div className="mt-3 flex flex-wrap gap-2"><input className="h-9 min-w-64 rounded-md border bg-background px-3 text-sm" placeholder="New outlet name" value={outletName} onChange={(event) => setOutletName(event.target.value)} /><Button onClick={() => void createOutlet()}>Add outlet</Button></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{(tenant.outlets ?? []).map((outlet) => <div key={outlet.id} className="rounded-md bg-muted/40 px-3 py-3"><div className="font-medium">{outlet.name}</div><div className="text-xs text-muted-foreground">{outlet.slug} · Outlet #{outlet.id}</div></div>)}{(tenant.outlets ?? []).length === 0 && <p className="text-sm text-muted-foreground">No outlets assigned.</p>}</div></section>
    <section className="rounded-xl border p-4"><h2 className="font-semibold">Tenant modules</h2><p className="mt-1 text-sm text-muted-foreground">Records owned directly by this tenant or through its outlets.</p><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{modules.map((module) => <div key={module.key} className="rounded-md border bg-muted/20 px-3 py-3"><div className="font-medium">{module.label}</div><div className="text-xs text-muted-foreground">{module.count} records · {module.scope} scoped</div></div>)}</div></section>
  </div>
}
