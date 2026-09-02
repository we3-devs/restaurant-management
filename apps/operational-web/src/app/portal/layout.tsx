import { QueryProvider } from "@rms/api-client/query-provider"

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>
}
