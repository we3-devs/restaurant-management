"use client"

import Link from "next/link"
import { BarChart3, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePageTitle } from "@rms/ui/use-page-title"

export default function SuperadminPage() {
  usePageTitle("Superadmin")

  return <div className="mx-auto w-full max-w-6xl space-y-6">
    <div><h1 className="text-2xl font-semibold">Superadmin</h1><p className="text-sm text-muted-foreground">Platform administration and tenant operations.</p></div>
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-xl border p-5"><Building2 className="mb-3 size-5 text-primary" /><h2 className="font-semibold">Tenant management</h2><p className="mt-1 text-sm text-muted-foreground">Create tenants, manage outlets, import roles, configure attendance, and review tenant modules.</p><Button className="mt-4" render={<Link href="/superadmin/tenants" />}>Manage tenants</Button></section>
      <section className="rounded-xl border p-5"><BarChart3 className="mb-3 size-5 text-primary" /><h2 className="font-semibold">Analytics data</h2><p className="mt-1 text-sm text-muted-foreground">Build and refresh platform analytics snapshots.</p><Button className="mt-4" variant="outline" render={<Link href="/superadmin/analytics" />}>Open analytics</Button></section>
    </div>
  </div>
}
