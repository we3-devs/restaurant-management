import { ShieldAlertIcon } from "lucide-react"

export function AccessDenied() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
      <ShieldAlertIcon className="size-10 text-muted-foreground" />
      <p className="font-medium">You don&apos;t have access to this page</p>
      <p className="text-sm text-muted-foreground">Ask an admin to grant you the required permission.</p>
    </div>
  )
}
