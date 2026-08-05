import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@rms/ui/card"
import { LoginForm } from "./login-form"

export default function LoginPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Restaurant Management System</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  )
}
