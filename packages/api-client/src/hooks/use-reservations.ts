import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { toQueryString, type PaginatedResponse } from "../types"
import { queryKeys } from "../query-keys"
import type {
  AssignReservationTableInput,
  CreateReservationInput,
  UpdateReservationInput,
} from "@rms/validators/reservations"

export interface Reservation {
  id: number
  outletId: number
  customerId: number
  reservedAt: string
  guestCount: number
  status: string
  source: string
  specialRequest: string | null
  internalNote: string | null
  depositAmount: number
  depositStatus: string
  confirmedAt: string | null
  seatedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  noShowAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ReservationTableAssignment {
  id: number
  reservationId: number
  diningTableId: number
}

export interface ListReservationsParams {
  page?: number
  limit?: number
  outletId?: number
  customerId?: number
  status?: string
  source?: string
}

export function useReservations(params: ListReservationsParams = {}) {
  return useQuery({
    queryKey: queryKeys.reservations.list(params),
    queryFn: () => apiClient<PaginatedResponse<Reservation>>(`/reservations${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  })
}

export function useReservation(id: number) {
  return useQuery({
    queryKey: queryKeys.reservations.detail(id),
    queryFn: () => apiClient<Reservation>(`/reservations/${id}`),
    enabled: id > 0,
  })
}

export function useCreateReservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateReservationInput) =>
      apiClient<Reservation>("/reservations", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.reservations.lists() }),
  })
}

export function useUpdateReservation(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateReservationInput) =>
      apiClient<Reservation>(`/reservations/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations.detail(id) })
    },
  })
}

export function useUpdateReservationStatus(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (status: string) =>
      apiClient<Reservation>(`/reservations/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations.detail(id) })
    },
  })
}

export function useReservationTables(reservationId: number) {
  return useQuery({
    queryKey: queryKeys.reservations.tables(reservationId),
    queryFn: () => apiClient<ReservationTableAssignment[]>(`/reservations/${reservationId}/tables`),
    enabled: reservationId > 0,
  })
}

export function useAssignReservationTable(reservationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AssignReservationTableInput) =>
      apiClient<ReservationTableAssignment>(`/reservations/${reservationId}/tables`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.reservations.tables(reservationId) }),
  })
}

export function useUnassignReservationTable(reservationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (diningTableId: number) =>
      apiClient<void>(`/reservations/${reservationId}/tables/${diningTableId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.reservations.tables(reservationId) }),
  })
}
