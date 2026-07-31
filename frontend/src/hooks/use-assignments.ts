import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"

export interface TableAssignment {
  id: number
  employeeId: number
  diningTableId: number
  sessionId: number | null
  outletId: number
  assignedAt: string
  unassignedAt: string | null
  isActive: boolean
}

export interface OrderAssignment {
  id: number
  employeeId: number
  orderId: number
  outletId: number
  assignedAt: string
  completedAt: string | null
  servedAt: string | null
  isActive: boolean
}

export interface StaffDashboard {
  presentToday: number
  absentToday: number
  lateToday: number
  onShiftCount: number
  tablesAssigned: number
  ordersAssigned: number
  recentTableAssignments: TableAssignment[]
  recentOrderAssignments: OrderAssignment[]
}

export function useStaffDashboard(outletId?: number) {
  return useQuery({
    queryKey: queryKeys.assignments.staffDashboard(outletId),
    queryFn: () => apiClient<StaffDashboard>(`/staff-dashboard${toQueryString({ outletId })}`),
  })
}

export function useTableAssignments(outletId?: number) {
  return useQuery({
    queryKey: queryKeys.assignments.tables(outletId),
    queryFn: () => apiClient<TableAssignment[]>(`/table-assignments${toQueryString({ outletId })}`),
  })
}

export function useOrderAssignments(outletId?: number) {
  return useQuery({
    queryKey: queryKeys.assignments.orders(outletId),
    queryFn: () => apiClient<OrderAssignment[]>(`/order-assignments${toQueryString({ outletId })}`),
  })
}

export function useAssignTable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { employeeId: number; diningTableId: number; sessionId?: number; outletId: number }) =>
      apiClient<TableAssignment>("/table-assignments", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all }),
  })
}

export function useUnassignTable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<TableAssignment>(`/table-assignments/${id}/unassign`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all }),
  })
}

export function useAssignOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { employeeId: number; orderId: number; outletId: number }) =>
      apiClient<OrderAssignment>("/order-assignments", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all }),
  })
}
