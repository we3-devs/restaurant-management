"use client";

import { toast } from "sonner";

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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useDeleteDiningTable, type DiningTable } from "@/hooks/use-dining-tables";
import { DownloadableQrCode } from "./downloadable-qr-code";

const GUEST_WEB_URL = process.env.NEXT_PUBLIC_GUEST_WEB_URL;

export function TableDetailDialog({
	table,
	isSuperadmin = false,
	onClose,
}: {
	table: DiningTable;
	isSuperadmin?: boolean;
	onClose: () => void;
}) {
	const deleteTable = useDeleteDiningTable();

	async function handleDelete() {
		try {
			await deleteTable.mutateAsync(table.id);
			toast.success(`Table "${table.name}" deleted`);
			onClose();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to delete table");
		}
	}

	const guestUrl = table.code ? `${GUEST_WEB_URL}?table=${table.code}` : null;

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
							<DownloadableQrCode value={guestUrl} fileName={`table-${table.code}-qr`} />
						) : (
							<p className="text-sm text-muted-foreground">
								This table has no code set, so it can&apos;t have a guest ordering QR yet.
							</p>
						)}
					</div>

					{isSuperadmin && (
						<>
							<Separator />
							<AlertDialog>
								<AlertDialogTrigger
									render={
										<Button
											variant="destructive"
											className="w-full"
											disabled={table.status === "occupied"}
										>
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
	);
}
