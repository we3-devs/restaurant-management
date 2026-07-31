"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { BriefcaseIcon } from "lucide-react"

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
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useCreatePosition, useDeletePosition, usePositions } from "@/hooks/use-employees"
import { createPositionSchema, type CreatePositionInput } from "@/lib/validators/employees"

export default function PositionsPage() {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canManage = isSuperadmin || permissions.includes("employees.manage")
  const { data: positions, isLoading } = usePositions()
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Positions</h1>
        {canManage && <CreatePositionDialog />}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
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
                  <Badge variant={position.isActive ? "secondary" : "outline"}>
                    {position.isActive ? "active" : "inactive"}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell>
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
