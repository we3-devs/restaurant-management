import { redirect } from "next/navigation"

// staff/layout.tsx does the real (backend-verified) session check and the
// portal-based cross-app landing decision (bouncing dashboard-portal users
// to dashboard-web) — mirrors dashboard-web's app/page.tsx exactly, see the
// comment there for why this doesn't call getCurrentUser() itself.
export default function RootPage() {
  redirect("/staff")
}
