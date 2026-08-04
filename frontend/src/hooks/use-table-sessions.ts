import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type { CreateTableSessionInput, OpenTableSessionInput, TransferTableSessionInput } from "@/lib/validators/table-sessions"
import type { DiningTable, ListDiningTablesParams } from "./use-dining-tables"
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

export interface OpenTableSessionResult {
  tableSessionId: number
  orderId: number
  tableSession: TableSession
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
 * Flips a dining table to "occupied" everywhere it's cached — the detail
 * query plus every list query that currently holds that row (found by id,
 * not by re-deriving which area/outlet filters it belongs to, since the
 * mutation response doesn't carry the full DiningTable). A list filtered to
 * a status the table no longer matches (e.g. `status: "available"`) has the
 * row removed instead of just relabeled, so it doesn't linger there stale.
 */
function patchDiningTableOccupied(queryClient: QueryClient, diningTableId: number) {
  queryClient.setQueryData<DiningTable>(queryKeys.diningTables.detail(diningTableId), (old) =>
    old ? { ...old, status: "occupied" } : old,
  )

  const entries = queryClient.getQueriesData<PaginatedResponse<DiningTable>>({
    queryKey: queryKeys.diningTables.lists(),
  })
  for (const [key, data] of entries) {
    if (!data) continue
    const index = data.data.findIndex((table) => table.id === diningTableId)
    if (index === -1) continue

    const params = (key[2] as ListDiningTablesParams | undefined) ?? {}
    if (params.status !== undefined && params.status !== "occupied") {
      const total = Math.max(data.meta.total - 1, 0)
      queryClient.setQueryData(key, {
        data: data.data.filter((table) => table.id !== diningTableId),
        meta: { ...data.meta, total, totalPages: Math.ceil(total / data.meta.limit) || 1 },
      })
      continue
    }

    const nextRows = [...data.data]
    nextRows[index] = { ...nextRows[index], status: "occupied" }
    queryClient.setQueryData(key, { ...data, data: nextRows })
  }
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
 * patchTableSessionLists/patchOrderLists/patchDiningTableOccupied above.
 */
export function useOpenTableSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: OpenTableSessionInput) =>
      apiClient<OpenTableSessionResult>("/table-sessions/open", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.tableSessions.detail(result.tableSessionId), result.tableSession)
      queryClient.setQueryData(queryKeys.orders.detail(result.orderId), result.order)

      patchTableSessionLists(queryClient, result.tableSession)
      patchOrderLists(queryClient, result.order)
      patchDiningTableOccupied(queryClient, result.tableSession.diningTableId)

      // Pre-seeds the exact query useOrderDeepLink issues right after this
      // (`useOrders({ tableSessionId, limit: 100 })` once its own
      // diningTableId-scoped table-sessions lookup — patched above — resolves
      // to this same session) so the deep-link resolver's "does this table's
      // new session already have an order" check is answered from cache
      // instead of a GET /orders round trip. Coupled to that hook's exact
      // params by necessity; if use-order-deep-link.ts's query shape changes,
      // update this call to match.
      queryClient.setQueryData(queryKeys.orders.list({ tableSessionId: result.tableSessionId, limit: 100 }), {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.diningTables.lists() })
    },
  })
}

export function useTransferTableSession(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TransferTableSessionInput) =>
      apiClient<TableSession>(`/table-sessions/${id}/transfer`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.diningTables.lists() })
    },
  })
}
