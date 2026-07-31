import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';
import { Outlet } from '../../outlets/entities/outlet.entity';
import { SupplierCategory } from './supplier-category.entity';

export type SupplierStatus = 'active' | 'inactive';

@Entity({ name: 'suppliers' })
export class Supplier {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: new BigIntTransformer(),
  })
  id: number;

  @Column({ name: 'supplier_no', type: 'varchar', length: 255, unique: true })
  supplierNo: string;

  @Column({ name: 'company_name', type: 'varchar', length: 500 })
  companyName: string;

  @Column({ name: 'contact_person', type: 'varchar', length: 255, nullable: true })
  contactPerson: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  phone: string | null;

  @Column({ name: 'alt_phone', type: 'varchar', length: 100, nullable: true })
  altPhone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  state: string | null;

  @Column({ name: 'postal_code', type: 'varchar', length: 50, nullable: true })
  postalCode: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: 'Nepal' })
  country: string | null;

  @Column({ name: 'pan_vat', type: 'varchar', length: 100, nullable: true })
  panVat: string | null;

  @Column({ name: 'registration_no', type: 'varchar', length: 255, nullable: true })
  registrationNo: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  website: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({
    name: 'category_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  categoryId: number | null;

  @ManyToOne(() => SupplierCategory, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: SupplierCategory | null;

  @Column({
    name: 'outlet_id',
    type: 'bigint',
    transformer: new BigIntTransformer(),
  })
  outletId: number;

  @ManyToOne(() => Outlet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outlet_id' })
  outlet: Outlet;

  @Column({ name: 'default_payment_terms', type: 'varchar', length: 100, nullable: true })
  defaultPaymentTerms: string | null;

  @Column({
    name: 'credit_limit',
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(),
  })
  creditLimit: number;

  @Column({
    name: 'outstanding_balance',
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(),
  })
  outstandingBalance: number;

  @Column({
    name: 'total_purchased',
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(),
  })
  totalPurchased: number;

  @Column({ name: 'last_purchase_date', type: 'date', nullable: true })
  lastPurchaseDate: string | null;

  @Column({ type: 'integer', default: 0 })
  rating: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: SupplierStatus;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({
    name: 'created_by',
    type: 'bigint',
    transformer: new BigIntTransformer(),
    nullable: true,
  })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
