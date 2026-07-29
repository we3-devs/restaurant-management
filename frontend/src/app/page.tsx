import { redirect } from "next/navigation"

// proxy.ts already redirects "/" based on session presence; this is a
// defense-in-depth fallback in case the matcher ever excludes this route.
export default function RootPage() {
  redirect("/login")
}
