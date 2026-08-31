/** Request-scoped intent for an authorized superadmin operational override. */
export interface OperationalMutationOptions {
  closedHoursOverride?: boolean
}

export function operationalMutationHeaders(override = false): HeadersInit | undefined {
  return override ? { "X-Outlet-Closed-Override": "true" } : undefined
}
