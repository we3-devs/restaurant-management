import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { LoginForm } from "./login-form"


export default function LoginPage() {
  return (
    <Card className="shadow-md sm:shadow-lg">
      <CardHeader className="lg:hidden">
        <CardTitle className="text-lg">Staff sign in</CardTitle>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  )
}
