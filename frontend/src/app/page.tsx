import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/dal"
import { getLandingPath } from "@/lib/auth/route-access"

// proxy.ts only does a cookie-presence check and sends unauthenticated hits
// to /login; a real session lands here, where getCurrentUser() (the actual
// backend-verified check) tells us the user's permissions so we can route
// admins/superadmins to the desktop dashboard and everyone else to the staff
// PWA, instead of proxy guessing from the cookie alone.
export default async function RootPage() {
  const user = await getCurrentUser()
  redirect(getLandingPath(user))
}
