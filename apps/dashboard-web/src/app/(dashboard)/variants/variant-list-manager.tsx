"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Pencil, Plus, Trash2, X } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import {
  useCreateVariantListValue,
  useDeleteVariantListValue,
  useUpdateVariantListValue,
  useVariantList,
  type VariantList,
  type VariantListValue,
} from "@/hooks/use-variant-lists"

/**
 * Editor for one of the two global option lists.
 *
 * Both lists have an identical shape and identical rules, so one component
 * drives both — the only difference is which endpoint it talks to and the
 * wording. Values here are shared by every food, so an edit made once applies
 * across the whole menu.
 */
export function VariantListManager({
  list,
  title,
  example,
}: {
  list: VariantList
  title: string
  example: string
}) {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canManage = isSuperadmin || permissions.includes("food-variants.manage")

  const { data, isLoading } = useVariantList(list)
  const createValue = useCreateVariantListValue(list)
  const deleteValue = useDeleteVariantListValue(list)

  const [name, setName] = useState("")
  const [skuSegment, setSkuSegment] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)

  async function handleCreate() {
    if (!name.trim()) return
    try {
      await createValue.mutateAsync({
        name: name.trim(),
        skuSegment: skuSegment.trim() || undefined,
      })
      toast.success(`"${name.trim()}" added`)
      setName("")
      setSkuSegment("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add")
    }
  }

  async function handleDelete(value: VariantListValue) {
    try {
      await deleteValue.mutateAsync(value.id)
      toast.success(`"${value.name}" deleted`)
    } catch (error) {
      // The API refuses while food items still reference it and says how many.
      toast.error(error instanceof Error ? error.message : "Failed to delete")
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Shared across every food — add {example} once and it is available to all
          of them. Prices live on the food item, not here.
        </p>
      </div>

      {canManage && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
          <div className="space-y-1.5">
            <Label htmlFor="value-name">Name</Label>
            <Input
              id="value-name"
              value={name}
              placeholder={example}
              className="w-48"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleCreate()
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="value-segment">SKU code</Label>
            <Input
              id="value-segment"
              value={skuSegment}
              placeholder="optional"
              className="w-32 font-mono uppercase"
              onChange={(event) => setSkuSegment(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleCreate()
              }}
            />
          </div>
          <Button onClick={handleCreate} disabled={!name.trim() || createValue.isPending}>
            <Plus className="size-3.5" />
            {createValue.isPending ? "Adding..." : "Add"}
          </Button>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (data?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>SKU code</TableHead>
              <TableHead />
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((value) =>
              editingId === value.id ? (
                <EditRow
                  key={value.id}
                  list={list}
                  value={value}
                  onDone={() => setEditingId(null)}
                />
              ) : (
                <TableRow key={value.id}>
                  <TableCell>{value.name}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {value.skuSegment ?? "—"}
                  </TableCell>
                  <TableCell>
                    {!value.isActive && <Badge variant="destructive">inactive</Badge>}
                  </TableCell>
                  <TableCell>
                    {canManage && (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(value.id)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button variant="ghost" size="sm">
                                <Trash2 className="size-3.5" />
                              </Button>
                            }
                          />
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete &quot;{value.name}&quot;?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This is refused while any food item still uses it.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                onClick={() => handleDelete(value)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

/**
 * Inline edit. A rename here propagates to every food item using the value, and
 * changing the SKU code recomposes their codes — hence the note in the UI.
 */
function EditRow({
  list,
  value,
  onDone,
}: {
  list: VariantList
  value: VariantListValue
  onDone: () => void
}) {
  const updateValue = useUpdateVariantListValue(list, value.id)
  const [name, setName] = useState(value.name)
  const [skuSegment, setSkuSegment] = useState(value.skuSegment ?? "")
  const [isActive, setIsActive] = useState(value.isActive)

  async function save() {
    try {
      await updateValue.mutateAsync({
        name: name.trim(),
        skuSegment: skuSegment.trim() || undefined,
        isActive,
      })
      toast.success("Updated everywhere it is used")
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update")
    }
  }

  return (
    <TableRow>
      <TableCell>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </TableCell>
      <TableCell>
        <Input
          value={skuSegment}
          className="font-mono uppercase"
          onChange={(event) => setSkuSegment(event.target.value)}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`active-${value.id}`}
            checked={isActive}
            onCheckedChange={(checked) => setIsActive(checked === true)}
          />
          <Label htmlFor={`active-${value.id}`} className="text-xs">
            Active
          </Label>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button size="sm" onClick={save} disabled={updateValue.isPending}>
            {updateValue.isPending ? "Saving..." : "Save"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onDone}>
            <X className="size-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
