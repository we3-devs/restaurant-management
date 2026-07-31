export const REPORT_TYPES = [
  'sales',
  'orders',
  'inventory',
  'stock-movements',
  'ingredient-consumption',
  'wastage',
  'kitchen-performance',
  'reservations',
  'customers',
  'payments',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export interface ReportColumn {
  key: string;
  header: string;
}

/** Single source of truth for column headers, used by both the on-screen table and the CSV/Excel/PDF exporters. */
export const REPORT_COLUMNS: Record<ReportType, ReportColumn[]> = {
  sales: [
    { key: 'orderNumber', header: 'Order #' },
    { key: 'createdAt', header: 'Date' },
    { key: 'subtotal', header: 'Subtotal' },
    { key: 'discountAmount', header: 'Discount' },
    { key: 'taxAmount', header: 'Tax' },
    { key: 'serviceChargeAmount', header: 'Service Charge' },
    { key: 'grandTotal', header: 'Grand Total' },
    { key: 'paymentStatus', header: 'Payment Status' },
  ],
  orders: [
    { key: 'orderNumber', header: 'Order #' },
    { key: 'createdAt', header: 'Date' },
    { key: 'orderType', header: 'Type' },
    { key: 'source', header: 'Source' },
    { key: 'status', header: 'Status' },
    { key: 'itemCount', header: 'Items' },
  ],
  inventory: [
    { key: 'ingredientName', header: 'Ingredient' },
    { key: 'warehouseName', header: 'Warehouse' },
    { key: 'quantity', header: 'On Hand' },
    { key: 'reorderLevel', header: 'Reorder Level' },
    { key: 'minimumStock', header: 'Minimum Stock' },
    { key: 'stockValue', header: 'Stock Value' },
  ],
  'stock-movements': [
    { key: 'movementType', header: 'Type' },
    { key: 'documentNo', header: 'Document #' },
    { key: 'date', header: 'Date' },
    { key: 'warehouseName', header: 'Warehouse' },
    { key: 'status', header: 'Status' },
  ],
  'ingredient-consumption': [
    { key: 'ingredientName', header: 'Ingredient' },
    { key: 'totalConsumed', header: 'Consumed' },
    { key: 'orderCount', header: 'Orders' },
  ],
  wastage: [
    { key: 'wastageDate', header: 'Date' },
    { key: 'ingredientName', header: 'Ingredient' },
    { key: 'warehouseName', header: 'Warehouse' },
    { key: 'quantity', header: 'Quantity' },
    { key: 'unitCost', header: 'Unit Cost' },
    { key: 'totalCost', header: 'Total Cost' },
    { key: 'reason', header: 'Reason' },
  ],
  'kitchen-performance': [
    { key: 'ticketId', header: 'Ticket #' },
    { key: 'orderNumber', header: 'Order #' },
    { key: 'departmentName', header: 'Station' },
    { key: 'priority', header: 'Priority' },
    { key: 'createdAt', header: 'Sent' },
    { key: 'prepMinutes', header: 'Prep Minutes' },
    { key: 'recallCount', header: 'Recalls' },
  ],
  reservations: [
    { key: 'reservedAt', header: 'Reserved For' },
    { key: 'customerName', header: 'Customer' },
    { key: 'guestCount', header: 'Guests' },
    { key: 'status', header: 'Status' },
    { key: 'source', header: 'Source' },
  ],
  customers: [
    { key: 'name', header: 'Name' },
    { key: 'phone', header: 'Phone' },
    { key: 'orderCount', header: 'Orders' },
    { key: 'totalSpent', header: 'Total Spent' },
    { key: 'lastOrderAt', header: 'Last Order' },
  ],
  payments: [
    { key: 'paymentNumber', header: 'Payment #' },
    { key: 'orderNumber', header: 'Order #' },
    { key: 'method', header: 'Method' },
    { key: 'type', header: 'Type' },
    { key: 'amount', header: 'Amount' },
    { key: 'status', header: 'Status' },
    { key: 'paidAt', header: 'Paid At' },
  ],
};
