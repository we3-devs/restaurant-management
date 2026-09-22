"use client"

import { useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { BriefcaseIcon, ShieldCheckIcon } from "lucide-react"

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
import { Checkbox } from "@rms/ui/checkbox"
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
import { TableSkeleton } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useAssignPositionPermission, useCreatePosition, useDeletePosition, usePositions, useUnassignPositionPermission } from "@/hooks/use-employees"
import { usePermissions, type Permission } from "@/hooks/use-permissions"
import { createPositionSchema, type CreatePositionInput } from "@/lib/validators/employees"
import { usePageTitle } from "@rms/ui/use-page-title"

function normalizePortalValue(portal?: string | null): "dashboard" | "staff" | "both" {
  if (portal === "operational") return "staff"
  if (portal === "dashboard" || portal === "staff" || portal === "both") return portal
  return "staff"
}

function formatPortalLabel(portal?: string | null) {
  const normalized = normalizePortalValue(portal)
  if (normalized === "both") return "Dashboard + Operational"
  if (normalized === "dashboard") return "Dashboard"
  return "Operational"
}

export default function PositionsPage() {
  const { permissions } = useCurrentUser()
  const canManage = permissions.includes("employees.manage")
  const { data: positions, isLoading } = usePositions()
  const showSkeleton = useDelayedLoading(isLoading)
  const deletePosition = useDeletePosition()

  async function handleDelete(id: number) {
    try {
      await deletePosition.mutateAsync(id)
      toast.success("Position deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete position")
    }
  }

  const isEmpty = !isLoading && (positions?.length ?? 0) === 0

  usePageTitle("Positions")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Positions</h1>
        {canManage && <CreatePositionDialog />}
      </div>

      {showSkeleton ? (
        <TableSkeleton rows={6} columns={6} />
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <BriefcaseIcon className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No positions found</p>
          <p className="text-sm text-muted-foreground">Create a position to get started.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>App</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions?.map((position) => (
              <TableRow key={position.id}>
                <TableCell className="font-medium">{position.name}</TableCell>
                <TableCell>{position.slug}</TableCell>
                <TableCell>{position.description ?? "—"}</TableCell>
                <TableCell>
                  {position.permissionSlugs.length > 0 ? (
                    <Badge variant="outline">{position.permissionSlugs.length} configured</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>{formatPortalLabel(position.portal)}</TableCell>
                <TableCell>
                  <Badge variant={position.isActive ? "secondary" : "outline"}>
                    {position.isActive ? "active" : "inactive"}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell>
                    <PositionPermissionsDialog positionId={position.id} positionName={position.name} />
                    <AlertDialog>
                      <AlertDialogTrigger render={<Button variant="ghost" size="sm">Delete</Button>} />
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete position &quot;{position.name}&quot;?</AlertDialogTitle>
                          <AlertDialogDescription>This cannot be undone from the UI.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction variant="destructive" onClick={() => handleDelete(position.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

function PositionPermissionsDialog({ positionId, positionName }: { positionId: number; positionName: string }) {
  const [open, setOpen] = useState(false)
  const { data: permissions } = usePermissions()
  const { data: positions } = usePositions()
  const position = positions?.find((item) => item.id === positionId)
  const assignPermission = useAssignPositionPermission(positionId)
  const unassignPermission = useUnassignPositionPermission(positionId)

  const permissionsByModule = useMemo(() => {
    const groups = new Map<string, Permission[]>()
    for (const permission of permissions ?? []) {
      const list = groups.get(permission.module) ?? []
      list.push(permission)
      groups.set(permission.module, list)
    }
    return groups
  }, [permissions])

  type AccessLevel = "none" | "view" | "full"

  // Every module may carry any number of narrower, discretionary
  // permissions beyond the base view/manage pair (e.g. orders has both
  // orders.delete and orders.discount) — each gets its own independent
  // toggle rather than being squeezed into one exclusive "enabled" slot.
  function singlePermissions(modulePermissions: Permission[]): Permission[] {
    return modulePermissions.filter((permission) => permission.action !== "view" && permission.action !== "manage")
  }

  function moduleAccessLevel(modulePermissions: Permission[]): AccessLevel {
    const granted = new Set(position?.permissionSlugs ?? [])
    const managePermission = modulePermissions.find((permission) => permission.action === "manage")
    const viewPermission = modulePermissions.find((permission) => permission.action === "view")
    if (managePermission && granted.has(managePermission.slug)) return "full"
    if (viewPermission && granted.has(viewPermission.slug)) return "view"
    return "none"
  }

  async function handleModuleAccessChange(modulePermissions: Permission[], level: AccessLevel) {
    if (!position) return
    const granted = new Set(position.permissionSlugs ?? [])
    const viewPermission = modulePermissions.find((permission) => permission.action === "view")
    const managePermission = modulePermissions.find((permission) => permission.action === "manage")
    const wantView = level === "view" || level === "full"
    const wantManage = level === "full"

    try {
      if (viewPermission) {
        const has = granted.has(viewPermission.slug)
        if (wantView && !has) await assignPermission.mutateAsync(viewPermission.id)
        if (!wantView && has) await unassignPermission.mutateAsync(viewPermission.id)
      }
      if (managePermission) {
        const has = granted.has(managePermission.slug)
        if (wantManage && !has) await assignPermission.mutateAsync(managePermission.id)
        if (!wantManage && has) await unassignPermission.mutateAsync(managePermission.id)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update permissions")
    }
  }

  async function handleSinglePermissionToggle(permission: Permission, enabled: boolean) {
    if (!position) return
    const has = new Set(position.permissionSlugs ?? []).has(permission.slug)
    try {
      if (enabled && !has) await assignPermission.mutateAsync(permission.id)
      if (!enabled && has) await unassignPermission.mutateAsync(permission.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update permissions")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm"><ShieldCheckIcon className="size-4" />Permissions</Button>} />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{positionName} permissions</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Choose what people assigned to this position can do. Full access includes viewing.
        </p>
        <div className="space-y-3">
          {[...permissionsByModule.entries()].map(([module, modulePermissions]) => {
            const hasView = modulePermissions.some((permission) => permission.action === "view")
            const hasManage = modulePermissions.some((permission) => permission.action === "manage")
            const extraPermissions = singlePermissions(modulePermissions)
            const granted = new Set(position?.permissionSlugs ?? [])
            if (!hasView && !hasManage && extraPermissions.length === 0) return null
            return (
              <div key={module} className="flex items-center justify-between gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0">
                <span className="text-sm font-medium capitalize">{module.replace(/-/g, " ")}</span>
                <div className="flex flex-col items-end gap-2">
                  {(hasView || hasManage) && (
                    <Select
                      value={moduleAccessLevel(modulePermissions)}
                      onValueChange={(value) => void handleModuleAccessChange(modulePermissions, value as AccessLevel)}
                      disabled={!position || assignPermission.isPending || unassignPermission.isPending}
                    >
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No access</SelectItem>
                        {hasView && <SelectItem value="view">{hasManage ? "View only" : "Enabled"}</SelectItem>}
                        {hasManage && <SelectItem value="full">{hasView ? "Full access" : "Enabled"}</SelectItem>}
                      </SelectContent>
                    </Select>
                  )}
                  {extraPermissions.map((permission) => (
                    <label key={permission.slug} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={granted.has(permission.slug)}
                        onCheckedChange={(checked) => void handleSinglePermissionToggle(permission, checked === true)}
                        disabled={!position || assignPermission.isPending || unassignPermission.isPending}
                      />
                      {permission.name}
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CreatePositionDialog() {
  const [open, setOpen] = useState(false)
  const createPosition = useCreatePosition()
  const form = useForm<CreatePositionInput>({
    resolver: zodResolver(createPositionSchema),
    defaultValues: { name: "", slug: "", description: "" },
  })

  async function onSubmit(values: CreatePositionInput) {
    try {
      await createPosition.mutateAsync(values)
      toast.success("Position created")
      form.reset({ name: "", slug: "", description: "" })
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create position")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create position</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create position</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl
                    {...field}
                    onChange={(e) => {
                      field.onChange(e)
                      if (!form.formState.dirtyFields.slug) {
                        form.setValue(
                          "slug",
                          e.target.value
                            .toLowerCase()
                            .trim()
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/(^-|-$)/g, ""),
                        )
                      }
                    }}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="portal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>App access</FormLabel>
                  <Select value={normalizePortalValue(field.value)} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Operational</SelectItem>
                      <SelectItem value="dashboard">Dashboard</SelectItem>
                      <SelectItem value="both">Dashboard + Operational</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createPosition.isPending}>
                {createPosition.isPending ? "Creating..." : "Create position"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
