"use client"

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
} from "@rms/ui/alert-dialog"
import { Button } from "@rms/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@rms/ui/dialog"
import { Separator } from "@rms/ui/separator"
import { useDeleteDiningTable, type DiningTable } from "@rms/api-client/hooks/use-dining-tables"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { resolveTenantHost, tenantGuestUrl } from "@rms/auth/tenant"
import { DownloadableQrCode } from "./downloadable-qr-code"

export function TableDetailDialog({ table, onClose }: { table: DiningTable; onClose: () => void }) {
  const { permissions } = useCurrentUser()
  const canManage = permissions.includes("dining-tables.manage")
  const deleteTable = useDeleteDiningTable()

  async function handleDelete() {
    try {
      await deleteTable.mutateAsync(table.id)
      toast.success(`Table "${table.name}" deleted`)
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete table")
    }
  }

  const guestUrl = (() => {
    if (!table.code || typeof window === "undefined") return null
    const tenant = resolveTenantHost(window.location.host)
    return tenantGuestUrl(tenant?.slug, table.code)
  })()

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {table.name} &mdash; {table.status}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Table status: {table.status}</p>

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Guest ordering QR</p>
            {guestUrl ? (
              <DownloadableQrCode value={guestUrl} fileName={`table-${table.code}-qr`} tableLabel={table.name} />
            ) : (
              <p className="text-sm text-muted-foreground">
                This table has no code set, so it can&apos;t have a guest ordering QR yet.
              </p>
            )}
          </div>

          {canManage && (
            <>
              <Separator />
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button variant="destructive" className="w-full" disabled={table.status === "occupied"}>
                      Delete table
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete table &quot;{table.name}&quot;?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes the table (no soft delete). This cannot be undone.
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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
