"use client"

import { useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

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
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DetailPageSkeleton, NotFoundCard } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { usePermissions, type Permission } from "@/hooks/use-permissions"
import { useAssignPermission, useDeleteRole, useRole, useUnassignPermission, useUpdateRole } from "@/hooks/use-roles"
import { updateRoleSchema, type UpdateRoleInput } from "@/lib/validators/roles"

export function RoleDetail({ roleId }: { roleId: number }) {
  const router = useRouter()
  const { permissions: userPermissions, isSuperadmin } = useCurrentUser()
  const canManage = isSuperadmin || userPermissions.includes("roles.manage")
  const { data: role, isLoading } = useRole(roleId)
  const showSkeleton = useDelayedLoading(isLoading)
  const { data: permissions } = usePermissions()
  const updateRole = useUpdateRole(roleId)
  const deleteRole = useDeleteRole()
  const assignPermission = useAssignPermission(roleId)
  const unassignPermission = useUnassignPermission(roleId)

  const form = useForm<UpdateRoleInput>({
    resolver: zodResolver(updateRoleSchema),
    defaultValues: { name: "", description: "", isAssignable: true, isActive: true, portal: "dashboard" },
  })

  useEffect(() => {
    if (role) {
      form.reset({
        name: role.name,
        description: role.description ?? "",
        isAssignable: role.isAssignable,
        isActive: role.isActive,
        portal: role.portal,
      })
    }
  }, [role, form])

  const permissionsByModule = useMemo(() => {
    const groups = new Map<string, Permission[]>()
    for (const permission of permissions ?? []) {
      const list = groups.get(permission.module) ?? []
      list.push(permission)
      groups.set(permission.module, list)
    }
    return groups
  }, [permissions])

  async function onSubmit(values: UpdateRoleInput) {
    try {
      await updateRole.mutateAsync(values)
      toast.success("Role updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update role")
    }
  }

  /**
   * Every module in this system only ever has a "view" and/or "manage"
   * permission (verified against the seed data) — so instead of a raw
   * checkbox per permission slug, each module gets one dropdown collapsing
   * that into "No access / View only / Full access". "Full access" grants
   * both, since view and manage are checked independently by the API (manage
   * alone wouldn't unlock read-only screens gated on `.view`).
   */
  type AccessLevel = "none" | "view" | "full"

  function moduleAccessLevel(modulePermissions: Permission[]): AccessLevel {
    const granted = new Set(role?.permissions ?? [])
    const managePerm = modulePermissions.find((p) => p.action === "manage")
    const viewPerm = modulePermissions.find((p) => p.action === "view")
    if (managePerm && granted.has(managePerm.slug)) return "full"
    if (viewPerm && granted.has(viewPerm.slug)) return "view"
    return "none"
  }

  async function handleModuleAccessChange(modulePermissions: Permission[], level: AccessLevel) {
    const granted = new Set(role?.permissions ?? [])
    const viewPerm = modulePermissions.find((p) => p.action === "view")
    const managePerm = modulePermissions.find((p) => p.action === "manage")
    const wantView = level === "view" || level === "full"
    const wantManage = level === "full"

    try {
      if (viewPerm) {
        const has = granted.has(viewPerm.slug)
        if (wantView && !has) await assignPermission.mutateAsync(viewPerm.id)
        if (!wantView && has) await unassignPermission.mutateAsync(viewPerm.id)
      }
      if (managePerm) {
        const has = granted.has(managePerm.slug)
        if (wantManage && !has) await assignPermission.mutateAsync(managePerm.id)
        if (!wantManage && has) await unassignPermission.mutateAsync(managePerm.id)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update access")
    }
  }

  async function handleDelete() {
    try {
      await deleteRole.mutateAsync(roleId)
      toast.success("Role deleted")
      router.push("/roles")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete role")
    }
  }

  if (showSkeleton) return <DetailPageSkeleton fields={5} />
  if (!isLoading && !role) return <NotFoundCard resource="Role" />
  if (!role) return null

  const readOnly = role.isSystem || !canManage
  const canDelete = canManage && !role.isSystem

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{role.name}</h1>
          <p className="text-sm text-muted-foreground">{role.slug}</p>
        </div>
        {canDelete && (
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive">Delete</Button>} />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete role &quot;{role.name}&quot;?</AlertDialogTitle>
                <AlertDialogDescription>
                  This revokes it from every user currently assigned it. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {role.isSystem && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          This is a system role — it cannot be edited or deleted.
        </p>
      )}
      {!role.isSystem && !canManage && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          You don&apos;t have permission to edit this role.
        </p>
      )}

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
                    <FormControl disabled={readOnly} {...field} />
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
                    <FormControl disabled={readOnly} {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="portal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Portal access</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select portal access" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dashboard">Dashboard only</SelectItem>
                        <SelectItem value="staff">Staff app only</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Which app holders of this role land in after login.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={readOnly || updateRole.isPending}>
                {updateRole.isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Set how much this role can do in each area. &quot;Full access&quot; includes viewing.
          </p>
          {[...permissionsByModule.entries()].map(([module, modulePermissions]) => {
            const hasView = modulePermissions.some((p) => p.action === "view")
            const hasManage = modulePermissions.some((p) => p.action === "manage")
            const level = moduleAccessLevel(modulePermissions)
            return (
              <div key={module} className="flex items-center justify-between gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0">
                <span className="text-sm font-medium capitalize">{module.replace(/-/g, " ")}</span>
                <Select
                  value={level}
                  onValueChange={(v) => handleModuleAccessChange(modulePermissions, v as AccessLevel)}
                  disabled={readOnly}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No access</SelectItem>
                    {hasView && <SelectItem value="view">{hasManage ? "View only" : "Enabled"}</SelectItem>}
                    {hasManage && <SelectItem value="full">{hasView ? "Full access" : "Enabled"}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
