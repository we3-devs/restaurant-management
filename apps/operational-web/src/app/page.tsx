import { redirect } from "next/navigation"

// Placeholder landing redirect — refined once the portal-access gate (see
// packages/auth/src/route-access.ts getLandingPath) is wired for the
// cross-app split, so a dashboard-only user landing here gets bounced back
// to dashboard-web instead of hitting AccessDenied.
export default function RootPage() {
  redirect("/staff")
}
