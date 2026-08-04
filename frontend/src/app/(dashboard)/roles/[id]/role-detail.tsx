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
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { usePermissions } from "@/hooks/use-permissions"
import { useAssignPermission, useDeleteRole, useRole, useUnassignPermission, useUpdateRole } from "@/hooks/use-roles"
import { updateRoleSchema, type UpdateRoleInput } from "@/lib/validators/roles"

export function RoleDetail({ roleId }: { roleId: number }) {
  const router = useRouter()
  const { data: role, isLoading } = useRole(roleId)
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
    const groups = new Map<string, typeof permissions>()
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

  async function handleTogglePermission(permissionId: number, checked: boolean) {
    try {
      if (checked) {
        await assignPermission.mutateAsync(permissionId)
      } else {
        await unassignPermission.mutateAsync(permissionId)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update permission")
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

  if (isLoading || !role) {
    return <Skeleton className="h-96 w-full max-w-2xl" />
  }

  const readOnly = role.isSystem

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{role.name}</h1>
          <p className="text-sm text-muted-foreground">{role.slug}</p>
        </div>
        {!readOnly && (
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

      {readOnly && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          This is a system role — it cannot be edited or deleted.
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
          <CardTitle>Permissions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...permissionsByModule.entries()].map(([module, modulePermissions]) => (
            <div key={module} className="space-y-2">
              <h3 className="text-sm font-medium capitalize">{module}</h3>
              <div className="space-y-2">
                {modulePermissions?.map((permission) => (
                  <div key={permission.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`permission-${permission.id}`}
                      checked={role.permissions?.includes(permission.slug) ?? false}
                      disabled={readOnly}
                      onCheckedChange={(checked) => handleTogglePermission(permission.id, checked === true)}
                    />
                    <Label htmlFor={`permission-${permission.id}`}>{permission.name}</Label>
                    <span className="text-xs text-muted-foreground">{permission.slug}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
