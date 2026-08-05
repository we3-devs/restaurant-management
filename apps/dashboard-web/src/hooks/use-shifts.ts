import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type { AssignShiftInput, CreateShiftInput, UpdateShiftInput } from "@/lib/validators/shifts"

export interface Shift {
  id: number
  name: string
  slug: string
  startTime: string
  endTime: string
  breakDurationMinutes: number
  workingHours: number
  description: string | null
  isActive: boolean
  outletId: number
  createdAt: string
  updatedAt: string
}

export interface ShiftAssignment {
  id: number
  shiftId: number
  employeeId: number
  assignedDate: string
  isActive: boolean
  createdBy: number | null
  createdAt: string
  updatedAt: string
}

export function useShifts(outletId?: number) {
  return useQuery({
    queryKey: queryKeys.shifts.list({ outletId }),
    queryFn: () => apiClient<Shift[]>(`/shifts${toQueryString({ outletId })}`),
  })
}

export function useShift(id: number) {
  return useQuery({
    queryKey: queryKeys.shifts.detail(id),
    queryFn: () => apiClient<Shift>(`/shifts/${id}`),
    enabled: id > 0,
  })
}

export function useCreateShift() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateShiftInput) => apiClient<Shift>("/shifts", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shifts.lists() }),
  })
}

export function useUpdateShift(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateShiftInput) =>
      apiClient<Shift>(`/shifts/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.detail(id) })
    },
  })
}

export function useDeleteShift() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/shifts/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shifts.lists() }),
  })
}

export function useShiftAssignments(shiftId: number, date?: string) {
  return useQuery({
    queryKey: queryKeys.shifts.assignments(shiftId, date),
    queryFn: () => apiClient<ShiftAssignment[]>(`/shifts/${shiftId}/assignments${toQueryString({ date })}`),
    enabled: shiftId > 0,
  })
}

export function useAssignShift() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AssignShiftInput) =>
      apiClient<ShiftAssignment>("/shift-assignments", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.assignments(input.shiftId) })
    },
  })
}

export function useUnassignShift(shiftId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (assignmentId: number) => apiClient<void>(`/shift-assignments/${assignmentId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shifts.assignments(shiftId) }),
  })
}
