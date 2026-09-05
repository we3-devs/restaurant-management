import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { toQueryString, type PaginatedResponse } from "../types"
import { queryKeys } from "../query-keys"
import type {
  CreateEmployeeApiInput,
  CreatePositionInput,
  UpdateEmployeeInput,
  UpdatePositionInput,
} from "@rms/validators/employees"

export type EmploymentStatus = "active" | "inactive" | "terminated" | "resigned"

export interface Position {
  id: number
  name: string
  slug: string
  description: string | null
  defaultRoleId: number | null
  defaultRole?: { id: number; name: string; slug: string; level: string } | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Employee {
  id: number
  employeeCode: string
  userId: number | null
  positionId: number | null
  outletId: number
  departmentId: number | null
  name: string
  email: string | null
  phone: string | null
  photoUrl: string | null
  joiningDate: string | null
  employmentStatus: EmploymentStatus
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  emergencyContactRelation: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface EmployeeDepartmentAssignment {
  id: number
  employeeId: number
  departmentId: number
  department: { id: number; name: string; outletId: number }
}

export function useEmployeeDepartments(id: number) {
  return useQuery({
    queryKey: queryKeys.employees.departments(id),
    queryFn: () => apiClient<EmployeeDepartmentAssignment[]>(`/employees/${id}/departments`),
    enabled: id > 0,
  })
}

export function useAssignEmployeeDepartment(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (departmentId: number) => apiClient<EmployeeDepartmentAssignment>(`/employees/${id}/departments`, { method: "POST", body: JSON.stringify({ departmentId }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.employees.departments(id) }),
  })
}

export function useRemoveEmployeeDepartment(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (departmentId: number) => apiClient<void>(`/employees/${id}/departments/${departmentId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.employees.departments(id) }),
  })
}

export interface ListEmployeesParams {
  page?: number
  limit?: number
  search?: string
  outletId?: number
  positionId?: number
  employmentStatus?: string
}

export function useEmployees(params: ListEmployeesParams = {}) {
  return useQuery({
    queryKey: queryKeys.employees.list(params),
    queryFn: () => apiClient<PaginatedResponse<Employee>>(`/employees${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  })
}

export function useEmployee(id: number) {
  return useQuery({
    queryKey: queryKeys.employees.detail(id),
    queryFn: () => apiClient<Employee>(`/employees/${id}`),
    enabled: id > 0,
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateEmployeeApiInput) =>
      apiClient<Employee>("/employees", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
    },
  })
}

export function useUpdateEmployee(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateEmployeeInput) =>
      apiClient<Employee>(`/employees/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
    },
  })
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/employees/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.employees.lists() }),
  })
}

export function usePositions() {
  return useQuery({
    queryKey: queryKeys.positions.list(),
    queryFn: () => apiClient<Position[]>("/positions"),
  })
}

export function useCreatePosition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePositionInput) =>
      apiClient<Position>("/positions", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.positions.list() }),
  })
}

export function useUpdatePosition(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdatePositionInput) =>
      apiClient<Position>(`/positions/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.positions.list() }),
  })
}

export function useDeletePosition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/positions/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.positions.list() }),
  })
}

export interface EmployeePerformance {
  employeeId: number
  ordersServed: number
  salesGenerated: number
  tablesServed: number
  averageServiceMinutes: number
  workingHours: number
  attendancePercent: number
  lateCount: number
  totalAttendanceDays: number
}

export function useEmployeePerformance(id: number, params: { dateFrom?: string; dateTo?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.employees.performance(id, params),
    queryFn: () => apiClient<EmployeePerformance>(`/assignments/performance/${id}${toQueryString(params)}`),
    enabled: id > 0,
  })
}
