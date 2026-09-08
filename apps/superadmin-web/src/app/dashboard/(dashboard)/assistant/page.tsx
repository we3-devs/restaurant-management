import { redirect } from "next/navigation"
import { getCurrentUser } from "@rms/auth/dal"
import { AssistantPanel } from "./assistant-panel"

export default async function AssistantPage() {
  const user = await getCurrentUser()
  if (!user.isSuperadmin && !user.permissions.includes("assistant.use")) redirect("/dashboard")
  return <AssistantPanel />
}
