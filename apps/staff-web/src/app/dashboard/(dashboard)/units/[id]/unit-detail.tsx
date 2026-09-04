"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DetailPageSkeleton, NotFoundCard } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAddUnitConversion, useDeleteUnit, useUnit, useUnitConversions, useUnits, useUpdateUnit } from "@/hooks/use-units"
import { updateUnitSchema, type UpdateUnitInput } from "@/lib/validators/units"
import { usePageTitle } from "@rms/ui/use-page-title"

const unitTypes = ["weight", "volume", "quantity", "custom"] as const

export function UnitDetail({ unitId }: { unitId: number }) {
  const router = useRouter()
  const { data: unit, isLoading } = useUnit(unitId)
  const showSkeleton = useDelayedLoading(isLoading)
  const updateUnit = useUpdateUnit(unitId)
  const deleteUnit = useDeleteUnit()
  const { data: conversions } = useUnitConversions(unitId)
  const { data: allUnits } = useUnits({ limit: 100 })
  const addConversion = useAddUnitConversion(unitId)

  const [toUnitId, setToUnitId] = useState("")
  const [multiplier, setMultiplier] = useState("")

  const form = useForm<UpdateUnitInput>({
    resolver: zodResolver(updateUnitSchema),
    defaultValues: { name: "", shortName: "", type: "quantity", isActive: true },
  })

  useEffect(() => {
    if (unit) {
      form.reset({ name: unit.name, shortName: unit.shortName, type: unit.type, isActive: unit.isActive })
    }
  }, [unit, form])

  async function onSubmit(values: UpdateUnitInput) {
    try {
      await updateUnit.mutateAsync(values)
      toast.success("Unit updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update unit")
    }
  }

  async function handleDelete() {
    try {
      await deleteUnit.mutateAsync(unitId)
      toast.success("Unit deleted")
      router.push("/dashboard/units")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete unit")
    }
  }

  async function handleAddConversion() {
    if (!toUnitId || !multiplier) return
    try {
      await addConversion.mutateAsync({ toUnitId: Number(toUnitId), multiplier: Number(multiplier) })
      toast.success("Conversion added")
      setToUnitId("")
      setMultiplier("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add conversion")
    }
  }

  usePageTitle("Unit Details")

  if (showSkeleton) return <DetailPageSkeleton fields={5} />
  if (!isLoading && !unit) return <NotFoundCard resource="Unit" />
  if (!unit) return null

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{unit.name}</h1>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive">Delete</Button>} />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete unit &quot;{unit.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>This soft-deletes the unit. This cannot be undone from the UI.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="shortName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short name</FormLabel>
                    <FormControl {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {unitTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="isActive"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                )}
              />
              <Button type="submit" disabled={updateUnit.isPending}>
                {updateUnit.isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conversions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>To unit</TableHead>
                <TableHead>Multiplier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversions?.map((conversion) => (
                <TableRow key={conversion.id}>
                  <TableCell>{allUnits?.data.find((u) => u.id === conversion.toUnitId)?.name ?? conversion.toUnitId}</TableCell>
                  <TableCell>{conversion.multiplier}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label>To unit</Label>
              <Select value={toUnitId} onValueChange={(value) => setToUnitId(value ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a unit" />
                </SelectTrigger>
                <SelectContent>
                  {allUnits?.data
                    .filter((u) => u.id !== unitId)
                    .map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32 space-y-1.5">
              <Label>Multiplier</Label>
              <Input value={multiplier} onChange={(e) => setMultiplier(e.target.value)} placeholder="0.001" />
            </div>
            <Button onClick={handleAddConversion} disabled={addConversion.isPending}>
              Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The reverse conversion is created automatically with multiplier 1 / multiplier.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
