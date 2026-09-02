import { QueryProvider } from "@rms/api-client/query-provider"

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>
}
