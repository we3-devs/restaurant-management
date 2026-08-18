"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOutIcon } from "lucide-react"
import { Button } from "@rms/ui/button"
import { Input } from "@rms/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@rms/ui/card"
import { FormSkeleton } from "@rms/ui/skeletons"
import {
  useAddCustomerAddress,
  useCustomerAddresses,
  useCustomerProfile,
  useRemoveCustomerAddress,
  useUpdateCustomerPreferences,
  useUpdateCustomerProfile,
} from "@rms/api-client/hooks/use-customer-portal"
import { useCustomerLogout } from "@rms/api-client/hooks/use-customer-auth"

export function CustomerProfileClient() {
  const router = useRouter()
  const { data: profile, isLoading: profileLoading } = useCustomerProfile()
  const { data: addresses } = useCustomerAddresses()
  const updateProfile = useUpdateCustomerProfile()
  const updatePreferences = useUpdateCustomerPreferences()
  const addAddress = useAddCustomerAddress()
  const removeAddress = useRemoveCustomerAddress()
  const logout = useCustomerLogout()

  async function handleLogout() {
    await logout.mutateAsync()
    router.push("/portal/login")
    router.refresh()
  }

  const [name, setName] = useState("")
  const [dietary, setDietary] = useState("")
  const [allergies, setAllergies] = useState("")
  const [addressLabel, setAddressLabel] = useState("")
  const [addressLine1, setAddressLine1] = useState("")

  if (profileLoading)
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <h1 className="text-xl font-semibold">Profile</h1>
        <FormSkeleton fields={3} />
      </div>
    )
  if (!profile) return <div className="p-4 text-sm text-muted-foreground">Couldn&apos;t load your profile.</div>

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>Basic info</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p>
            <span className="text-muted-foreground">Name:</span> {profile.name}
          </p>
          <p>
            <span className="text-muted-foreground">Phone:</span> {profile.phone ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Email:</span> {profile.email ?? "—"}
          </p>
          <div className="flex gap-2 pt-2">
            <Input placeholder="Update name" value={name} onChange={(e) => setName(e.target.value)} />
            <Button
              disabled={!name || updateProfile.isPending}
              onClick={() => updateProfile.mutate({ name })}
            >
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dietary preferences & allergies</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Current: {(profile.dietaryPreferences ?? []).join(", ") || "none"}
          </p>
          <Input
            placeholder="Comma-separated e.g. vegetarian, halal"
            value={dietary}
            onChange={(e) => setDietary(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">Allergies: {(profile.allergies ?? []).join(", ") || "none"}</p>
          <Input
            placeholder="Comma-separated e.g. peanuts, shellfish"
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
          />
          <Button
            disabled={updatePreferences.isPending}
            onClick={() =>
              updatePreferences.mutate({
                dietaryPreferences: dietary
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                allergies: allergies
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          >
            Save preferences
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved addresses</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <ul className="flex flex-col gap-2">
            {(addresses ?? []).map((address) => (
              <li key={address.id} className="flex items-center justify-between rounded-lg border p-2">
                <div>
                  <p className="font-medium">
                    {address.label} {address.isDefault && "(default)"}
                  </p>
                  <p className="text-sm text-muted-foreground">{address.line1}</p>
                </div>
                <Button variant="ghost" onClick={() => removeAddress.mutate(address.id)}>
                  Remove
                </Button>
              </li>
            ))}
            {(addresses ?? []).length === 0 && <p className="text-muted-foreground">No saved addresses.</p>}
          </ul>
          <div className="flex gap-2 pt-2">
            <Input placeholder="Label (Home)" value={addressLabel} onChange={(e) => setAddressLabel(e.target.value)} />
            <Input placeholder="Address line" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
            <Button
              disabled={!addressLabel || !addressLine1 || addAddress.isPending}
              onClick={() => {
                addAddress.mutate({ label: addressLabel, line1: addressLine1 })
                setAddressLabel("")
                setAddressLine1("")
              }}
            >
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button variant="outline" disabled={logout.isPending} onClick={handleLogout}>
        <LogOutIcon />
        {logout.isPending ? "Signing out..." : "Sign out"}
      </Button>
    </div>
  )
}
