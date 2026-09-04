"use client"

import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ListSkeleton, StatGridSkeleton } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useOutlets } from "@/hooks/use-outlets"
import { useEmployees } from "@/hooks/use-employees"
import { useStaffDashboard } from "@/hooks/use-assignments"
import { usePageTitle } from "@rms/ui/use-page-title"

export default function StaffDashboardPage() {
  const [outletFilter, setOutletFilter] = useState("all")
  const { data: outlets } = useOutlets({ limit: 100 })
  const { data: employees } = useEmployees({ limit: 200 })
  const { data, isLoading } = useStaffDashboard(outletFilter !== "all" ? Number(outletFilter) : undefined)
  const showSkeleton = useDelayedLoading(isLoading || !data)

  const employeeName = (id: number) => employees?.data.find((e) => e.id === id)?.name ?? "Loading…"

  usePageTitle("Staff Dashboard")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Staff Dashboard</h1>
        <div className="w-56">
          <Select value={outletFilter} onValueChange={(v) => setOutletFilter(v ?? "all")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All outlets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outlets</SelectItem>
              {outlets?.data.map((outlet) => (
                <SelectItem key={outlet.id} value={String(outlet.id)}>
                  {outlet.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {showSkeleton ? (
        <div className="space-y-4">
          <StatGridSkeleton count={5} className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" />
          <ListSkeleton count={3} />
        </div>
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Present today</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{data.presentToday}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Absent today</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{data.absentToday}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Late today</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{data.lateToday}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">On shift now</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{data.onShiftCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tables / orders assigned</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {data.tablesAssigned} / {data.ordersAssigned}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent table assignments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.recentTableAssignments.length === 0 && (
                  <p className="text-sm text-muted-foreground">No active table assignments.</p>
                )}
                {data.recentTableAssignments.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{employeeName(assignment.employeeId)}</span>
                    <span className="text-muted-foreground">Table #{assignment.diningTableId}</span>
                    <Badge variant={assignment.isActive ? "secondary" : "outline"}>
                      {assignment.isActive ? "active" : "ended"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Recent order assignments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.recentOrderAssignments.length === 0 && (
                  <p className="text-sm text-muted-foreground">No active order assignments.</p>
                )}
                {data.recentOrderAssignments.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{employeeName(assignment.employeeId)}</span>
                    <span className="text-muted-foreground">Order #{assignment.orderId}</span>
                    <Badge variant={assignment.servedAt ? "secondary" : assignment.completedAt ? "outline" : "outline"}>
                      {assignment.servedAt ? "served" : assignment.completedAt ? "completed" : "in progress"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
