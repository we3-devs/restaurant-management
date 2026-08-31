import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { operationalMutationHeaders, type OperationalMutationOptions } from "../operational-mutation"
import { toQueryString, type PaginatedResponse } from "../types"
import { queryKeys } from "../query-keys"
import type { CreateTableSessionInput, OpenTableSessionInput, TransferTableSessionInput } from "@rms/validators/table-sessions"
import { patchDiningTableStatus } from "./use-dining-tables"
import type { ListOrdersParams, Order } from "./use-orders"

export interface TableSessionCustomerSummary {
  id: number
  name: string
  phone: string | null
  loyaltyTier: string | null
}

export interface TableSession {
  id: number
  outletId: number
  diningTableId: number
  reservationId: number | null
  customerId: number | null
  // Populated by both the list endpoint and GET /table-sessions/:id.
  customer?: TableSessionCustomerSummary | null
  customers?: TableSessionCustomerSummary[]
  // Only populated by GET /table-sessions/:id (findOneDetailed) — the list
  // endpoint's rows already show table/outlet context from their own filters.
  outletName?: string
  diningTableName?: string
  guestCount: number
  source: string
  status: string
  startedAt: string | null
  endedAt: string | null
  startedBy: number | null
  endedBy: number | null
  transferredBy: number | null
  transferredAt: string | null
  createdAt: string
  updatedAt: string
}

/** Human-readable session label — the time it was opened, since sessions don't have their own name. */
export function tableSessionName(session: Pick<TableSession, "startedAt" | "createdAt">): string {
  const timestamp = session.startedAt ?? session.createdAt
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export interface ListTableSessionsParams {
  page?: number
  limit?: number
  outletId?: number
  diningTableId?: number
  status?: string
}

export function useTableSessions(params: ListTableSessionsParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.tableSessions.list(params),
    queryFn: () => apiClient<PaginatedResponse<TableSession>>(`/table-sessions${toQueryString(params)}`),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  })
}

export function useTableSession(id: number) {
  return useQuery({
    queryKey: queryKeys.tableSessions.detail(id),
    queryFn: () => apiClient<TableSession>(`/table-sessions/${id}`),
    enabled: id > 0,
  })
}

export function useStartTableSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTableSessionInput) =>
      apiClient<TableSession>("/table-sessions", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.diningTables.lists() })
    },
  })
}

// Matches OrdersService#openTableWithOrder's actual return shape
// (backend/src/modules/orders/orders.service.ts) — `{ session, order }`,
// not the tableSessionId/orderId/tableSession shape this used to declare.
export interface OpenTableSessionResult {
  session: TableSession
  order: Order
}

function withPage<T extends { id: number }>(
  data: PaginatedResponse<T>,
  row: T,
  limit: number | undefined,
): PaginatedResponse<T> {
  if (data.data.some((existing) => existing.id === row.id)) return data
  // Newest-first list order (every list endpoint here sorts createdAt DESC)
  // — a freshly-created row belongs at the front. Capped to the cached
  // page's own `limit` so a `limit: 1` cache doesn't end up holding 2 rows.
  const merged = [row, ...data.data]
  const nextData = limit ? merged.slice(0, limit) : merged
  const total = data.meta.total + 1
  return {
    data: nextData,
    meta: { ...data.meta, total, totalPages: Math.ceil(total / data.meta.limit) || 1 },
  }
}

/**
 * Inserts a just-created table session into every currently-cached
 * table-sessions LIST query whose filters it actually matches (same
 * outletId/diningTableId/status, if the query filters on them) — sparing
 * every mounted consumer (OrderSwitcher, StartSaleDialog's active-table
 * dropdown, the deep-link resolver) the GET /table-sessions refetch an
 * invalidateQueries() would have triggered. Queries the row doesn't belong
 * in (e.g. a `status: "completed"` list) are correctly left untouched, and
 * queries that were never fetched are left alone too — they'll fetch fresh,
 * correct data whenever they're next observed, so there's nothing to patch.
 */
function patchTableSessionLists(queryClient: QueryClient, session: TableSession) {
  const entries = queryClient.getQueriesData<PaginatedResponse<TableSession>>({
    queryKey: queryKeys.tableSessions.lists(),
  })
  for (const [key, data] of entries) {
    if (!data) continue
    const params = (key[2] as ListTableSessionsParams | undefined) ?? {}
    if (params.outletId !== undefined && params.outletId !== session.outletId) continue
    if (params.diningTableId !== undefined && params.diningTableId !== session.diningTableId) continue
    if (params.status !== undefined && params.status !== session.status) continue
    queryClient.setQueryData(key, withPage(data, session, params.limit))
  }
}

/** Same idea as patchTableSessionLists, for the order the session was just opened with. */
function patchOrderLists(queryClient: QueryClient, order: Order) {
  const entries = queryClient.getQueriesData<PaginatedResponse<Order>>({
    queryKey: queryKeys.orders.lists(),
  })
  for (const [key, data] of entries) {
    if (!data) continue
    const params = (key[2] as ListOrdersParams | undefined) ?? {}
    if (params.outletId !== undefined && params.outletId !== order.outletId) continue
    if (params.tableSessionId !== undefined && params.tableSessionId !== order.tableSessionId) continue
    if (params.status !== undefined && params.status !== order.status) continue
    if (params.search) continue // can't cheaply tell if the order matches an ILike search term
    queryClient.setQueryData(key, withPage(data, order, params.limit))
  }
}

/**
 * Resolves which dining table a session is sitting at, from cache only — so
 * the occupancy patches below can run synchronously in an onSuccess without
 * an extra GET. Prefers the detail query, falling back to scanning cached
 * lists. Returns null when nothing cached knows, in which case callers skip
 * their optimistic patch and let the refetch settle it.
 */
export function findCachedDiningTableId(queryClient: QueryClient, tableSessionId: number): number | null {
  const detail = queryClient.getQueryData<TableSession>(queryKeys.tableSessions.detail(tableSessionId))
  if (detail) return detail.diningTableId

  for (const [, data] of queryClient.getQueriesData<PaginatedResponse<TableSession>>({
    queryKey: queryKeys.tableSessions.lists(),
  })) {
    const match = data?.data.find((session) => session.id === tableSessionId)
    if (match) return match.diningTableId
  }
  return null
}

/**
 * POST /table-sessions/open — opens a table session and creates its first
 * order in one atomic backend transaction, returning both ids in one
 * response. Replaces the old two-request flow (useStartTableSession then
 * useCreateOrder) for the "seat a walk-in table" case, so the caller never
 * has a session id without a matching order id to navigate to.
 *
 * The response already carries the full tableSession and order, so every
 * cache this used to `invalidateQueries()` (and therefore refetch over the
 * network) is instead patched in place from that response — see
 * patchTableSessionLists/patchOrderLists above and patchDiningTableStatus in
 * use-dining-tables.ts.
 */
export function useOpenTableSession(options: OperationalMutationOptions = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: OpenTableSessionInput) =>
      apiClient<OpenTableSessionResult>("/table-sessions/open", { method: "POST", body: JSON.stringify(input), headers: operationalMutationHeaders(options.closedHoursOverride) }),
    onSuccess: (result) => {
      // Defensive: never assume the response has the shape we expect.
      if (!result?.session || !result?.order) return

      queryClient.setQueryData(queryKeys.tableSessions.detail(result.session.id), result.session)
      queryClient.setQueryData(queryKeys.orders.detail(result.order.id), result.order)

      patchTableSessionLists(queryClient, result.session)
      patchOrderLists(queryClient, result.order)
      patchDiningTableStatus(queryClient, result.session.diningTableId, "occupied")

      // Pre-seeds the exact query useOrderDeepLink issues right after this
      // (`useOrders({ tableSessionId, limit: 100 })` once its own
      // diningTableId-scoped table-sessions lookup — patched above — resolves
      // to this same session) so the deep-link resolver's "does this table's
      // new session already have an order" check is answered from cache
      // instead of a GET /orders round trip. Coupled to that hook's exact
      // params by necessity; if use-order-deep-link.ts's query shape changes,
      // update this call to match.
      queryClient.setQueryData(queryKeys.orders.list({ tableSessionId: result.session.id, limit: 100 }), {
        data: [result.order],
        meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
      })
    },
  })
}

export function useEndTableSession(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<TableSession>(`/table-sessions/${id}/end`, { method: "POST" }),
    onSuccess: (session) => {
      // Ending the session frees the table server-side
      // (TableSessionsService#end -> DiningTablesService#setStatus), so paint
      // it available right away — the mirror of the "occupied" patch seating
      // already does, which is why seating used to feel instant and closing
      // out didn't.
      if (session?.diningTableId) {
        patchDiningTableStatus(queryClient, session.diningTableId, "available")
      }
      // refetchType "all" because the floor board is usually unmounted at
      // this point (staff are on the POS/checkout screen): the default
      // active-only invalidation would just flag these stale and defer the
      // GET until the board is next mounted, stacking the round trip on top
      // of the navigation instead of overlapping with it.
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.lists(), refetchType: "all" })
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.diningTables.lists(), refetchType: "all" })
    },
  })
}

export function useTransferTableSession(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TransferTableSessionInput) =>
      apiClient<TableSession>(`/table-sessions/${id}/transfer`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: (session, input) => {
      // Transfer frees the old table and occupies the new one in the same
      // call — patch both so neither card waits on the refetch. The old id
      // comes from cache (the response only carries the new one).
      const previousDiningTableId = findCachedDiningTableId(queryClient, id)
      if (previousDiningTableId !== null && previousDiningTableId !== input.newDiningTableId) {
        patchDiningTableStatus(queryClient, previousDiningTableId, "available")
      }
      patchDiningTableStatus(queryClient, session?.diningTableId ?? input.newDiningTableId, "occupied")

      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.lists(), refetchType: "all" })
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.diningTables.lists(), refetchType: "all" })
    },
  })
}

/** Sets or changes the session's customer of record — e.g. cashier assigns a customer from the table popup. */
export function useSetTableSessionCustomer(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (customerId: number) =>
      apiClient<TableSession>(`/table-sessions/${id}/customer`, {
        method: "POST",
        body: JSON.stringify({ customerId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.detail(id) })
    },
  })
}

export function useTableSessionCustomers(id: number) {
  return useQuery({
    queryKey: [...queryKeys.tableSessions.detail(id), "customers"],
    queryFn: () => apiClient<TableSessionCustomerSummary[]>(`/table-sessions/${id}/customers`),
    enabled: id > 0,
  })
}

export function useAddTableSessionCustomer(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (customerId: number) =>
      apiClient<TableSessionCustomerSummary[]>(`/table-sessions/${id}/customers`, {
        method: "POST",
        body: JSON.stringify({ customerId }),
      }),
    onSuccess: (customers) => {
      queryClient.setQueryData([...queryKeys.tableSessions.detail(id), "customers"], customers)
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.detail(id) })
    },
  })
}

export function useRemoveTableSessionCustomer(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (customerId: number) =>
      apiClient<TableSessionCustomerSummary[]>(`/table-sessions/${id}/customers/${customerId}`, { method: "DELETE" }),
    onSuccess: (customers) => {
      queryClient.setQueryData([...queryKeys.tableSessions.detail(id), "customers"], customers)
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.detail(id) })
    },
  })
}
