"use client"

import { useEffect, useState } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DetailPageSkeleton, NotFoundCard } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useRoles } from "@/hooks/use-roles"
import { useOutlets } from "@/hooks/use-outlets"
import {
  useAssignRole,
  useDeactivateUser,
  useRevokeRoleAssignment,
  useResetUserPassword,
  useUpdateUser,
  useUser,
  useUserRoleAssignments,
} from "@/hooks/use-users"
import { updateUserSchema, type UpdateUserInput } from "@/lib/validators/users"
import { usePageTitle } from "@rms/ui/use-page-title"

export function UserDetail({ userId }: { userId: number }) {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canManageUsers = isSuperadmin || permissions.includes("users.manage")
  const canManageRoles = isSuperadmin || permissions.includes("roles.manage")
  const { data: user, isLoading } = useUser(userId)
  const showSkeleton = useDelayedLoading(isLoading)
  const { data: assignments } = useUserRoleAssignments(userId)
  const { data: roles } = useRoles({ limit: 100 })
  const { data: outlets } = useOutlets({ limit: 100 })
  const updateUser = useUpdateUser(userId)
  const deactivateUser = useDeactivateUser(userId)
  const assignRole = useAssignRole(userId)
  const revokeAssignment = useRevokeRoleAssignment(userId)
  const resetUserPassword = useResetUserPassword(userId)
  const [selectedRoleId, setSelectedRoleId] = useState<string>("")
  const [selectedOutletId, setSelectedOutletId] = useState<string>("global")
  const [newPassword, setNewPassword] = useState("")

  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { name: "", email: "" },
  })

  useEffect(() => {
    if (user) {
      form.reset({ name: user.name, email: user.email })
    }
  }, [user, form])

  async function onSubmit(values: UpdateUserInput) {
    try {
      await updateUser.mutateAsync(values)
      toast.success("User updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update user")
    }
  }

  async function handleDeactivate() {
    try {
      await deactivateUser.mutateAsync()
      toast.success("User deactivated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to deactivate user")
    }
  }

  async function handleAssign() {
    if (!selectedRoleId) return
    try {
      await assignRole.mutateAsync({
        roleId: Number(selectedRoleId),
        ...(selectedOutletId !== "global" ? { outletId: Number(selectedOutletId) } : {}),
      })
      toast.success(selectedOutletId === "global" ? "Global role assigned" : "Outlet access assigned")
      setSelectedRoleId("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign role")
    }
  }

  async function handleRevoke(assignmentId: number) {
    try {
      await revokeAssignment.mutateAsync(assignmentId)
      toast.success("Role revoked")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke role")
    }
  }

  async function handleResetPassword() {
    try {
      await resetUserPassword.mutateAsync(newPassword)
      setNewPassword("")
      toast.success("Password reset")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reset password")
    }
  }

  usePageTitle("User Details")

  if (showSkeleton) return <DetailPageSkeleton fields={5} />
  if (!isLoading && !user) return <NotFoundCard resource="User" />
  if (!user) return null

  const activeAssignments = (assignments ?? []).filter((assignment) => assignment.isActive)

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{user.name}</h1>
          <div className="flex items-center gap-1.5">
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <Badge variant={user.isActive ? "secondary" : "destructive"}>
              {user.isActive ? "active" : "inactive"}
            </Badge>
          </div>
        </div>
        {user.isActive && canManageUsers && (
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive">Deactivate</Button>} />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Deactivate &quot;{user.name}&quot;?</AlertDialogTitle>
                <AlertDialogDescription>
                  Revokes all of their role assignments. They can still log in but will have no access until
                  reassigned a role.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleDeactivate}>
                  Deactivate
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

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
                    <FormControl disabled={!canManageUsers} {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl type="email" disabled={!canManageUsers} {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              {canManageUsers && (
                <Button type="submit" disabled={updateUser.isPending}>
                  {updateUser.isPending ? "Saving..." : "Save changes"}
                </Button>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Staff assignment</CardTitle>
        </CardHeader>
        <CardContent>
          {user.employeeId ? (
            <div className="space-y-1 text-sm">
              <p>Outlet: {user.outletId ?? "—"}</p>
              <p>Department: {user.departmentId ?? "—"}</p>
              <p className="text-xs text-muted-foreground">
                This assignment is managed from the linked employee record.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No employee record is linked to this user.</p>
          )}
        </CardContent>
      </Card>

      {isSuperadmin && (
        <Card>
          <CardHeader>
            <CardTitle>Reset password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Set a new password for this user. The existing password cannot be viewed or recovered.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <label className="text-sm font-medium" htmlFor="new-user-password">New password</label>
                <input
                  id="new-user-password"
                  type="password"
                  minLength={8}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  placeholder="At least 8 characters"
                />
              </div>
              <Button
                type="button"
                onClick={handleResetPassword}
                disabled={newPassword.length < 8 || resetUserPassword.isPending}
              >
                {resetUserPassword.isPending ? "Resetting..." : "Reset password"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Role assignments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {activeAssignments.length === 0 && (
              <p className="text-sm text-muted-foreground">No active role assignments.</p>
            )}
            {activeAssignments.map((assignment) => (
              <div key={assignment.id} className="flex items-center gap-1.5">
                <Badge variant="secondary">
                  {assignment.roleName} · {assignment.outletId ? (outlets?.data.find((outlet) => outlet.id === assignment.outletId)?.name ?? `Outlet #${assignment.outletId}`) : "All outlets"}
                </Badge>
                {canManageRoles && (
                  <Button variant="ghost" size="sm" onClick={() => handleRevoke(assignment.id)}>
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>

          {canManageRoles && (
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <label className="text-sm font-medium">Assign a role</label>
                <Select value={selectedRoleId} onValueChange={(value) => setSelectedRoleId(String(value))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles?.data.map((role) => (
                      <SelectItem key={role.id} value={String(role.id)}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="text-sm font-medium">Outlet access</label>
                <Select value={selectedOutletId} onValueChange={(value) => setSelectedOutletId(String(value ?? "global"))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select outlet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">All outlets</SelectItem>
                    {outlets?.data.map((outlet) => (
                      <SelectItem key={outlet.id} value={String(outlet.id)}>{outlet.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAssign} disabled={!selectedRoleId || assignRole.isPending}>
                Assign
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
