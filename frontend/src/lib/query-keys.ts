/**
 * TanStack Query key factory. Convention for this and all future CRUD
 * domains: `all` -> `lists()` -> `list(params)`, and `all` -> `detail(id)`.
 */
export const queryKeys = {
  users: {
    all: ["users"] as const,
    lists: () => [...queryKeys.users.all, "list"] as const,
    list: (params?: unknown) => [...queryKeys.users.lists(), params] as const,
    detail: (id: number) => [...queryKeys.users.all, "detail", id] as const,
    roleAssignments: (id: number) => [...queryKeys.users.all, "role-assignments", id] as const,
  },
  roles: {
    all: ["roles"] as const,
    lists: () => [...queryKeys.roles.all, "list"] as const,
    list: (params?: unknown) => [...queryKeys.roles.lists(), params] as const,
    detail: (id: number) => [...queryKeys.roles.all, "detail", id] as const,
  },
  permissions: {
    all: ["permissions"] as const,
    list: () => [...queryKeys.permissions.all, "list"] as const,
  },
  outlets: {
    all: ["outlets"] as const,
    lists: () => [...queryKeys.outlets.all, "list"] as const,
    list: (params?: unknown) => [...queryKeys.outlets.lists(), params] as const,
    detail: (id: number) => [...queryKeys.outlets.all, "detail", id] as const,
  },
  outletDepartments: {
    all: ["outlet-departments"] as const,
    lists: () => [...queryKeys.outletDepartments.all, "list"] as const,
    list: (params?: unknown) => [...queryKeys.outletDepartments.lists(), params] as const,
    detail: (id: number) => [...queryKeys.outletDepartments.all, "detail", id] as const,
  },
  warehouses: {
    all: ["warehouses"] as const,
    lists: () => [...queryKeys.warehouses.all, "list"] as const,
    list: (params?: unknown) => [...queryKeys.warehouses.lists(), params] as const,
    detail: (id: number) => [...queryKeys.warehouses.all, "detail", id] as const,
  },
  foodCategories: {
    all: ["food-categories"] as const,
    lists: () => [...queryKeys.foodCategories.all, "list"] as const,
    list: (params?: unknown) => [...queryKeys.foodCategories.lists(), params] as const,
    detail: (id: number) => [...queryKeys.foodCategories.all, "detail", id] as const,
  },
  addonGroups: {
    all: ["addon-groups"] as const,
    lists: () => [...queryKeys.addonGroups.all, "list"] as const,
    list: (params?: unknown) => [...queryKeys.addonGroups.lists(), params] as const,
    detail: (id: number) => [...queryKeys.addonGroups.all, "detail", id] as const,
  },
  foods: {
    all: ["foods"] as const,
    lists: () => [...queryKeys.foods.all, "list"] as const,
    list: (params?: unknown) => [...queryKeys.foods.lists(), params] as const,
    detail: (id: number) => [...queryKeys.foods.all, "detail", id] as const,
    outlets: (id: number) => [...queryKeys.foods.all, "outlets", id] as const,
    addonGroups: (id: number) => [...queryKeys.foods.all, "addon-groups", id] as const,
  },
  foodVariants: {
    all: ["food-variants"] as const,
    lists: () => [...queryKeys.foodVariants.all, "list"] as const,
    list: (params?: unknown) => [...queryKeys.foodVariants.lists(), params] as const,
    detail: (id: number) => [...queryKeys.foodVariants.all, "detail", id] as const,
    outlets: (id: number) => [...queryKeys.foodVariants.all, "outlets", id] as const,
  },
  addons: {
    all: ["addons"] as const,
    lists: () => [...queryKeys.addons.all, "list"] as const,
    list: (params?: unknown) => [...queryKeys.addons.lists(), params] as const,
    detail: (id: number) => [...queryKeys.addons.all, "detail", id] as const,
  },
  diningAreas: {
    all: ["dining-areas"] as const,
    lists: () => [...queryKeys.diningAreas.all, "list"] as const,
    list: (params?: unknown) => [...queryKeys.diningAreas.lists(), params] as const,
    detail: (id: number) => [...queryKeys.diningAreas.all, "detail", id] as const,
  },
  diningTables: {
    all: ["dining-tables"] as const,
    lists: () => [...queryKeys.diningTables.all, "list"] as const,
    list: (params?: unknown) => [...queryKeys.diningTables.lists(), params] as const,
    detail: (id: number) => [...queryKeys.diningTables.all, "detail", id] as const,
  },
  tableSessions: {
    all: ["table-sessions"] as const,
    lists: () => [...queryKeys.tableSessions.all, "list"] as const,
    list: (params?: unknown) => [...queryKeys.tableSessions.lists(), params] as const,
    detail: (id: number) => [...queryKeys.tableSessions.all, "detail", id] as const,
  },
  orders: {
    all: ["orders"] as const,
    lists: () => [...queryKeys.orders.all, "list"] as const,
    list: (params?: unknown) => [...queryKeys.orders.lists(), params] as const,
    detail: (id: number) => [...queryKeys.orders.all, "detail", id] as const,
    items: (id: number) => [...queryKeys.orders.all, "items", id] as const,
    tables: (id: number) => [...queryKeys.orders.all, "tables", id] as const,
    payments: (id: number) => [...queryKeys.orders.all, "payments", id] as const,
  },
  orderItems: {
    all: ["order-items"] as const,
    addons: (id: number) => [...queryKeys.orderItems.all, "addons", id] as const,
  },
} as const;
