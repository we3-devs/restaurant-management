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
import { useCreatePosition, useDeletePosition, usePositions } from "@/hooks/use-employees"
import { useAssignPermission, useRole, useRoles, useUnassignPermission } from "@/hooks/use-roles"
import { usePermissions, type Permission } from "@/hooks/use-permissions"
import { createPositionSchema, type CreatePositionInput } from "@/lib/validators/employees"
import { usePageTitle } from "@rms/ui/use-page-title"

export default function PositionsPage() {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canManage = isSuperadmin || permissions.includes("employees.manage")
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
              <TableHead>Default role</TableHead>
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
                  {position.defaultRole ? (
                    <Badge variant="outline">{position.defaultRole.name}</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={position.isActive ? "secondary" : "outline"}>
                    {position.isActive ? "active" : "inactive"}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell>
                    {position.defaultRole && (
                      <PositionPermissionsDialog
                        roleId={position.defaultRole.id}
                        positionName={position.name}
                      />
                    )}
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

function PositionPermissionsDialog({ roleId, positionName }: { roleId: number; positionName: string }) {
  const [open, setOpen] = useState(false)
  const { data: role } = useRole(open ? roleId : 0)
  const { data: permissions } = usePermissions()
  const assignPermission = useAssignPermission(roleId)
  const unassignPermission = useUnassignPermission(roleId)

  const permissionsByModule = useMemo(() => {
    const groups = new Map<string, Permission[]>()
    for (const permission of permissions ?? []) {
      const list = groups.get(permission.module) ?? []
      list.push(permission)
      groups.set(permission.module, list)
    }
    return groups
  }, [permissions])

  type AccessLevel = "none" | "view" | "full" | "enabled"

  function moduleAccessLevel(modulePermissions: Permission[]): AccessLevel {
    const granted = new Set(role?.permissions ?? [])
    const managePermission = modulePermissions.find((permission) => permission.action === "manage")
    const viewPermission = modulePermissions.find((permission) => permission.action === "view")
    const singlePermission = modulePermissions.find((permission) => permission.action !== "view" && permission.action !== "manage")
    if (managePermission && granted.has(managePermission.slug)) return "full"
    if (viewPermission && granted.has(viewPermission.slug)) return "view"
    if (singlePermission && granted.has(singlePermission.slug)) return "enabled"
    return "none"
  }

  async function handleModuleAccessChange(modulePermissions: Permission[], level: AccessLevel) {
    if (!role) return
    const granted = new Set(role.permissions ?? [])
    const viewPermission = modulePermissions.find((permission) => permission.action === "view")
    const managePermission = modulePermissions.find((permission) => permission.action === "manage")
    const singlePermission = modulePermissions.find((permission) => permission.action !== "view" && permission.action !== "manage")
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
      if (singlePermission) {
        const has = granted.has(singlePermission.slug)
        if (level === "enabled" && !has) await assignPermission.mutateAsync(singlePermission.id)
        if (level === "none" && has) await unassignPermission.mutateAsync(singlePermission.id)
      }
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
            const hasSingle = modulePermissions.some((permission) => permission.action !== "view" && permission.action !== "manage")
            return (
              <div key={module} className="flex items-center justify-between gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0">
                <span className="text-sm font-medium capitalize">{module.replace(/-/g, " ")}</span>
                <Select
                  value={moduleAccessLevel(modulePermissions)}
                  onValueChange={(value) => void handleModuleAccessChange(modulePermissions, value as AccessLevel)}
                  disabled={!role || assignPermission.isPending || unassignPermission.isPending}
                >
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No access</SelectItem>
                    {hasView && <SelectItem value="view">{hasManage ? "View only" : "Enabled"}</SelectItem>}
                    {hasManage && <SelectItem value="full">{hasView ? "Full access" : "Enabled"}</SelectItem>}
                    {hasSingle && <SelectItem value="enabled">Enabled</SelectItem>}
                  </SelectContent>
                </Select>
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
  const { data: rolesPage } = useRoles({ limit: 100 })
  const roles = rolesPage?.data ?? []

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
              name="defaultRoleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default role</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : "none"}
                    onValueChange={(v) => field.onChange(v === "none" ? undefined : Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="No default role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No default role</SelectItem>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={String(role.id)}>
                          {role.name}
                        </SelectItem>
                      ))}
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
