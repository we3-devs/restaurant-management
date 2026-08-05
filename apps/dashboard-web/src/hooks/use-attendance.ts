import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type { AdjustAttendanceInput, ClockInInput, ClockOutInput } from "@/lib/validators/attendance"

export type AttendanceStatus = "present" | "late" | "early_leave" | "absent" | "half_day"

export interface Attendance {
  id: number
  employeeId: number
  outletId: number
  clockIn: string
  clockOut: string | null
  shiftId: number | null
  status: AttendanceStatus
  isLate: boolean
  isEarlyLeave: boolean
  lateMinutes: number
  earlyLeaveMinutes: number
  workingHours: number
  notes: string | null
  adjustedBy: number | null
  adjustmentReason: string | null
  createdAt: string
  updatedAt: string
}

export interface AttendanceToday {
  total: number
  present: number
  late: number
  onShift: number
  rows: Attendance[]
}

export interface ListAttendanceParams {
  page?: number
  limit?: number
  employeeId?: number
  outletId?: number
  shiftId?: number
  status?: string
  dateFrom?: string
  dateTo?: string
}

export function useAttendanceList(params: ListAttendanceParams = {}) {
  return useQuery({
    queryKey: queryKeys.attendance.list(params),
    queryFn: () => apiClient<PaginatedResponse<Attendance>>(`/attendance${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  })
}

export function useAttendanceToday(outletId?: number) {
  return useQuery({
    queryKey: queryKeys.attendance.today(outletId),
    queryFn: () => apiClient<AttendanceToday>(`/attendance/today${toQueryString({ outletId })}`),
  })
}

export function useClockIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ClockInInput) =>
      apiClient<Attendance>("/attendance/clock-in", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all })
    },
  })
}

export function useClockOut() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ClockOutInput) =>
      apiClient<Attendance>("/attendance/clock-out", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all })
    },
  })
}

export function useAdjustAttendance(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AdjustAttendanceInput) =>
      apiClient<Attendance>(`/attendance/${id}/adjust`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.attendance.lists() }),
  })
}
