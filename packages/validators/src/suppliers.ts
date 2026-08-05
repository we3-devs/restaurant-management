import { z } from "zod"

export const SUPPLIER_STATUSES = ["active", "inactive"] as const

export const createSupplierSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  outletId: z.number({ message: "Select an outlet" }).positive(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  altPhone: z.string().optional(),
  email: z.string().email("Enter a valid email address").optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  panVat: z.string().optional(),
  registrationNo: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
  categoryId: z.number().positive().optional(),
  defaultPaymentTerms: z.string().optional(),
  creditLimit: z.number().min(0).optional(),
  rating: z.number().min(0).max(5).optional(),
  status: z.enum(SUPPLIER_STATUSES).optional(),
})

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>

export const updateSupplierSchema = z.object({
  companyName: z.string().min(1, "Company name is required").optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  altPhone: z.string().optional(),
  email: z.string().email("Enter a valid email address").optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  panVat: z.string().optional(),
  registrationNo: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
  categoryId: z.number().positive().optional(),
  defaultPaymentTerms: z.string().optional(),
  creditLimit: z.number().min(0).optional(),
  rating: z.number().min(0).max(5).optional(),
  status: z.enum(SUPPLIER_STATUSES).optional(),
})

export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>

export const createSupplierCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
})

export type CreateSupplierCategoryInput = z.infer<typeof createSupplierCategorySchema>
