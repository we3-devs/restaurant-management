import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth/dal"

export default async function DashboardPage() {
  const user = await getCurrentUser()

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Welcome, {user.name}</CardTitle>
        <CardDescription>{user.email}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>
          <span className="text-muted-foreground">Superadmin:</span>{" "}
          {user.isSuperadmin ? "yes" : "no"}
        </p>
        <p>
          <span className="text-muted-foreground">Global permissions:</span>{" "}
          {user.permissions.length > 0 ? user.permissions.join(", ") : "none"}
        </p>
      </CardContent>
    </Card>
  )
}
