import { verifyCustomerSession } from "@rms/auth/customer-dal"
import { CustomerProfileClient } from "./profile-client"

export default async function CustomerProfilePage() {
  await verifyCustomerSession()
  return <CustomerProfileClient />
}
