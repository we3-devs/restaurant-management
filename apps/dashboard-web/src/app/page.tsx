import { redirect } from "next/navigation"

// proxy.ts only does a cookie-presence check and sends unauthenticated hits
// to /login. The real, backend-verified session check (and the portal-based
// dashboard-vs-staff landing decision) happens in (dashboard)/layout.tsx,
// which redirects to /staff itself when needed — see getLandingPath's usage
// there. Redirecting straight to /dashboard here (rather than calling
// getCurrentUser() a second time just to pick a path) avoids a second
// backend /auth/me round trip on every login for the common (dashboard)
// case.
export default function RootPage() {
  redirect("/dashboard")
}
