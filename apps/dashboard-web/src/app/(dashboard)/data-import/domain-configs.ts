/**
 * Presentation-only per-domain config for the data-import wizard — column
 * labels/order for the editable preview table, nothing else. The backend
 * (see backend/src/modules/data-import/) owns every actual validation,
 * lookup, dedupe, and business rule; this file exists only because the
 * wizard needs to know which fields to render as editable cells and what to
 * call them. Column `key`s must match the raw field keys each domain's
 * ImportDomainConfig.headerAliases resolves to (and therefore the keys each
 * row echoes back in its preview/revalidate response) — see each
 * `<domain>-importer.ts` on the backend for the source of truth.
 */
export interface DataImportColumn {
  key: string
  label: string
}

export interface DataImportDomainConfig {
  domain: string
  label: string
  columns: DataImportColumn[]
}

export const dataImportDomainConfigs: DataImportDomainConfig[] = [
  {
    domain: "foods",
    label: "Foods",
    columns: [
      { key: "name", label: "Name" },
      { key: "slug", label: "Slug" },
      { key: "sku", label: "SKU" },
      { key: "foodCategory", label: "Category" },
      { key: "itemType", label: "Type" },
      { key: "basePrice", label: "Price" },
      { key: "shortDescription", label: "Description" },
      { key: "imageUrl", label: "Image URL" },
      { key: "departmentType", label: "Department" },
      { key: "foodType", label: "Food Type" },
    ],
  },
  {
    domain: "outlets",
    label: "Outlets",
    columns: [{ key: "name", label: "Name" }],
  },
  {
    domain: "ingredients",
    label: "Ingredients",
    columns: [
      { key: "outlet", label: "Outlet" },
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "category", label: "Category" },
      { key: "unit", label: "Unit" },
    ],
  },
  {
    domain: "employees",
    label: "Employees",
    columns: [
      { key: "employeeCode", label: "Employee Code" },
      { key: "name", label: "Name" },
      { key: "outlet", label: "Outlet" },
      { key: "position", label: "Position" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
    ],
  },
  {
    domain: "customers",
    label: "Customers",
    columns: [
      { key: "name", label: "Name" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "address", label: "Address" },
    ],
  },
  {
    domain: "suppliers",
    label: "Suppliers",
    columns: [
      { key: "companyName", label: "Company" },
      { key: "supplierNo", label: "Supplier No" },
      { key: "contactPerson", label: "Contact" },
      { key: "outlet", label: "Outlet" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
    ],
  },
]
