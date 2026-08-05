import { getCurrentCustomer } from "@rms/auth/customer-dal"
import { GuestPageContent } from "./guest-page-content"

export default async function GuestPage() {
  const customer = await getCurrentCustomer()
  return <GuestPageContent initialCustomer={customer} />
}
