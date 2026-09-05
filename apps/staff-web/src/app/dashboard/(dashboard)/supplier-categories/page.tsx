"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useCreateSupplierCategory, useDeleteSupplierCategory, useSupplierCategories, useUpdateSupplierCategory } from "@/hooks/use-suppliers"
import { usePageTitle } from "@rms/ui/use-page-title"

export default function SupplierCategoriesPage() {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canManage = isSuperadmin || permissions.includes("suppliers.manage")
  const { data: categories, isLoading } = useSupplierCategories()
  const create = useCreateSupplierCategory()
  const remove = useDeleteSupplierCategory()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [editing, setEditing] = useState<number | null>(null)
  const update = useUpdateSupplierCategory(editing ?? 0)

  async function save() {
    if (!name.trim()) return
    try {
      if (editing) await update.mutateAsync({ name, description })
      else await create.mutateAsync({ name, description })
      toast.success(editing ? "Category updated" : "Category created")
      setName(""); setDescription(""); setEditing(null)
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to save category") }
  }

  async function deleteCategory(id: number) {
    try { await remove.mutateAsync(id); toast.success("Category deleted") } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to delete category") }
  }

  usePageTitle("Supplier Categories")
  return <div className="max-w-2xl space-y-4">
    <div><h1 className="text-lg font-semibold">Supplier Categories</h1><p className="text-sm text-muted-foreground">Group suppliers by what they provide.</p></div>
    {canManage && <Card><CardHeader><CardTitle>{editing ? "Edit category" : "Add category"}</CardTitle></CardHeader><CardContent className="flex gap-2"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" /><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" /><Button onClick={() => void save()} disabled={!name.trim() || create.isPending || update.isPending}>{editing ? "Save" : "Add"}</Button>{editing && <Button variant="outline" onClick={() => { setEditing(null); setName(""); setDescription("") }}>Cancel</Button>}</CardContent></Card>}
    <Card><CardContent className="divide-y p-0">{isLoading ? <p className="p-4 text-sm text-muted-foreground">Loading…</p> : (categories ?? []).length === 0 ? <p className="p-4 text-sm text-muted-foreground">No supplier categories.</p> : (categories ?? []).map((category) => <div key={category.id} className="flex items-center justify-between gap-3 p-4"><div><p className="font-medium">{category.name}</p>{category.description && <p className="text-sm text-muted-foreground">{category.description}</p>}</div>{canManage && <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => { setEditing(category.id); setName(category.name); setDescription(category.description ?? "") }}>Edit</Button><Button variant="destructive" size="sm" onClick={() => void deleteCategory(category.id)}>Delete</Button></div>}</div>)}</CardContent></Card>
  </div>
}
