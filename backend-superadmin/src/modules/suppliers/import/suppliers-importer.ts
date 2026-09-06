import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { EntityManager, Repository } from 'typeorm';
import type { ImportDomainConfig, ImportRawRow } from '../../data-import/interfaces/import-domain-config.interface';
import type { ImportCommitResult } from '../../data-import/interfaces/import-result.interface';
import type { ImportValidatedRow } from '../../data-import/interfaces/import-row.interface';
import { Supplier } from '../entities/supplier.entity';
import { Outlet } from '../../outlets/entities/outlet.entity';

interface SupplierImportRow extends ImportValidatedRow {
  supplierNo: string;
  companyName: string;
  contactPerson: string | null;
  /** Raw lookup text as typed/uploaded — echoed back (not just the resolved id) so the frontend has something editable to redisplay and resend at revalidate/commit time. */
  outlet: string;
  outletId: number | null;
  phone: string | null;
  email: string | null;
  existingId: number | null;
}

/**
 * Suppliers — identity: company name + contact person (upsert). Mutable on
 * re-import: phone, email. supplierNo must be explicit and unique (never
 * auto-generated — same rationale as employeeCode: a silently-generated
 * identifier is worse than a rejected row for anything that becomes a
 * reference number on paperwork). Outlet is resolved by exact name match,
 * required since every supplier belongs to exactly one outlet.
 */
@Injectable()
export class SuppliersImporter implements ImportDomainConfig<Record<string, string>, SupplierImportRow> {
  domain = 'suppliers';
  label = 'Suppliers';
  mode = 'upsert' as const;
  identityDescription = 'company name + contact person';
  headerAliases: Record<string, string> = {
    companyname: 'companyName',
    company: 'companyName',
    supplierno: 'supplierNo',
    contactperson: 'contactPerson',
    contact: 'contactPerson',
    outlet: 'outlet',
    phone: 'phone',
    email: 'email',
  };

  constructor(
    @InjectRepository(Supplier)
    private readonly suppliersRepository: Repository<Supplier>,
    @InjectRepository(Outlet)
    private readonly outletsRepository: Repository<Outlet>,
  ) {}

  async validateRows(rows: ImportRawRow<Record<string, string>>[]): Promise<SupplierImportRow[]> {
    const [existing, outlets] = await Promise.all([
      this.suppliersRepository.find({ select: { id: true, companyName: true, contactPerson: true, supplierNo: true } }),
      this.outletsRepository.find({ select: { id: true, name: true } }),
    ]);
    const identityKey = (companyName: string, contactPerson: string | null) =>
      `${companyName.trim().toLowerCase()}|${(contactPerson ?? '').trim().toLowerCase()}`;
    const byIdentity = new Map(existing.map((s) => [identityKey(s.companyName, s.contactPerson), s.id]));
    const existingSupplierNos = new Set(existing.map((s) => s.supplierNo.trim().toLowerCase()));
    const outletByName = new Map(outlets.map((o) => [o.name.trim().toLowerCase(), o.id]));
    const seenInBatch = new Set<string>();

    return rows.map(({ rowNumber, raw }) => {
      const companyName = (raw.companyName ?? '').trim();
      const supplierNo = (raw.supplierNo ?? '').trim();
      const contactPerson = (raw.contactPerson ?? '').trim() || null;
      const outletName = (raw.outlet ?? '').trim();
      const phone = (raw.phone ?? '').trim() || null;
      const email = (raw.email ?? '').trim() || null;
      const errors: string[] = [];

      if (!companyName) errors.push('company name is required');

      if (!supplierNo) {
        errors.push('supplier number is required');
      } else {
        const noKey = supplierNo.toLowerCase();
        if (!byIdentity.has(identityKey(companyName, contactPerson)) && existingSupplierNos.has(noKey)) {
          errors.push(`Supplier number "${supplierNo}" already exists`);
        }
      }

      let outletId: number | null = null;
      if (!outletName) {
        errors.push('outlet is required');
      } else {
        outletId = outletByName.get(outletName.toLowerCase()) ?? null;
        if (outletId === null) errors.push(`Outlet "${outletName}" not found — expected an existing outlet`);
      }

      const key = identityKey(companyName, contactPerson);
      if (companyName) {
        if (seenInBatch.has(key)) {
          errors.push(`Duplicate supplier "${companyName}"${contactPerson ? ` / ${contactPerson}` : ''} in this file`);
        }
        seenInBatch.add(key);
      }

      const existingId = byIdentity.get(key) ?? null;

      return { rowNumber, supplierNo, companyName, contactPerson, outlet: outletName, outletId, phone, email, existingId, errors };
    });
  }

  async commitRows(rows: SupplierImportRow[], manager: EntityManager): Promise<ImportCommitResult> {
    const repo = manager.getRepository(Supplier);
    const failures: ImportCommitResult['failures'] = [];
    const succeeded: ImportCommitResult['succeeded'] = [];

    for (const row of rows) {
      try {
        if (row.existingId) {
          await repo.update(row.existingId, { phone: row.phone, email: row.email });
          succeeded.push({ rowNumber: row.rowNumber, entityId: row.existingId });
        } else {
          const created = await repo.save(
            repo.create({
              supplierNo: row.supplierNo,
              companyName: row.companyName,
              contactPerson: row.contactPerson,
              outletId: row.outletId!,
              phone: row.phone,
              email: row.email,
            }),
          );
          succeeded.push({ rowNumber: row.rowNumber, entityId: created.id });
        }
      } catch (error) {
        failures.push({ rowNumber: row.rowNumber, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return { committedCount: succeeded.length, failedCount: failures.length, succeeded, failures };
  }

  async buildTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Suppliers');
    sheet.addRow(['companyName', 'supplierNo', 'contactPerson', 'outlet', 'phone', 'email']);
    sheet.addRow(['Acme Foods Pvt Ltd', 'SUP-001', 'Ram Sharma', 'Downtown', '9800000000', 'sales@acme.example']);
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async buildExport(): Promise<Buffer> {
    const [suppliers, outlets] = await Promise.all([
      this.suppliersRepository.find({ order: { id: 'ASC' } }),
      this.outletsRepository.find({ select: { id: true, name: true } }),
    ]);
    const outletById = new Map(outlets.map((o) => [o.id, o.name]));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Suppliers');
    sheet.addRow(['companyName', 'supplierNo', 'contactPerson', 'outlet', 'phone', 'email']);
    for (const supplier of suppliers) {
      sheet.addRow([
        supplier.companyName,
        supplier.supplierNo,
        supplier.contactPerson ?? '',
        outletById.get(supplier.outletId) ?? '',
        supplier.phone ?? '',
        supplier.email ?? '',
      ]);
    }
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }
}
