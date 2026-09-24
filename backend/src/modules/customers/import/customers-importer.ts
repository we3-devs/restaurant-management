import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { EntityManager, Repository } from 'typeorm';
import type { ImportDomainConfig, ImportRawRow } from '../../data-import/interfaces/import-domain-config.interface';
import type { ImportCommitResult } from '../../data-import/interfaces/import-result.interface';
import type { ImportValidatedRow } from '../../data-import/interfaces/import-row.interface';
import { primaryAddressLine1, withPrimaryAddress } from '../customers.service';
import { Customer } from '../entities/customer.entity';

interface CustomerImportRow extends ImportValidatedRow {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  existingId: number | null;
}

/**
 * Customers — identity: phone OR email (upsert; phone checked first when a
 * row has both). Mutable on re-import: name, address. A row needs at least
 * one of phone/email to be matchable at all. Known simplification: if a
 * row's phone matches one existing customer and its email matches a
 * *different* existing customer, the phone match wins silently rather than
 * being flagged as a conflict — rare enough for legacy data that it isn't
 * worth the extra complexity here.
 */
@Injectable()
export class CustomersImporter implements ImportDomainConfig<Record<string, string>, CustomerImportRow> {
  domain = 'customers';
  label = 'Customers';
  mode = 'upsert' as const;
  identityDescription = 'phone or email';
  headerAliases: Record<string, string> = {
    name: 'name',
    phone: 'phone',
    email: 'email',
    address: 'address',
  };

  constructor(
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
  ) {}

  async validateRows(rows: ImportRawRow<Record<string, string>>[]): Promise<CustomerImportRow[]> {
    const existing = await this.customersRepository.find({ select: { id: true, phone: true, email: true } });
    const byPhone = new Map(existing.filter((c) => c.phone).map((c) => [c.phone!.trim().toLowerCase(), c.id]));
    const byEmail = new Map(existing.filter((c) => c.email).map((c) => [c.email!.trim().toLowerCase(), c.id]));
    const seenInBatch = new Set<string>();

    return rows.map(({ rowNumber, raw }) => {
      const name = (raw.name ?? '').trim();
      const phone = (raw.phone ?? '').trim() || null;
      const email = (raw.email ?? '').trim() || null;
      const address = (raw.address ?? '').trim() || null;
      const errors: string[] = [];

      if (!name) errors.push('name is required');
      if (!phone && !email) errors.push('phone or email is required');

      const identityKey = (phone ?? email)?.toLowerCase();
      if (identityKey) {
        if (seenInBatch.has(identityKey)) {
          errors.push(`Duplicate phone/email "${phone ?? email}" in this file`);
        }
        seenInBatch.add(identityKey);
      }

      const existingId = (phone && byPhone.get(phone.toLowerCase())) || (email && byEmail.get(email.toLowerCase())) || null;

      return { rowNumber, name, phone, email, address, existingId, errors };
    });
  }

  async commitRows(rows: CustomerImportRow[], manager: EntityManager): Promise<ImportCommitResult> {
    const repo = manager.getRepository(Customer);
    const failures: ImportCommitResult['failures'] = [];
    const succeeded: ImportCommitResult['succeeded'] = [];

    for (const row of rows) {
      // Each row gets its own SAVEPOINT — without this, one row's constraint
      // violation aborts the whole shared chunk transaction, and every row
      // after it fails with a useless "current transaction is aborted"
      // instead of its own real error.
      const savepoint = `import_row_${row.rowNumber}`;
      await manager.query(`SAVEPOINT "${savepoint}"`);
      try {
        if (row.existingId) {
          const current = await repo.findOne({ where: { id: row.existingId } });
          await repo.update(row.existingId, {
            name: row.name,
            addresses: withPrimaryAddress(current?.addresses, row.address),
          });
          await manager.query(`RELEASE SAVEPOINT "${savepoint}"`);
          succeeded.push({ rowNumber: row.rowNumber, entityId: row.existingId });
        } else {
          const created = await repo.save(
            repo.create({
              name: row.name,
              phone: row.phone,
              email: row.email,
              addresses: withPrimaryAddress(null, row.address),
            }),
          );
          await manager.query(`RELEASE SAVEPOINT "${savepoint}"`);
          succeeded.push({ rowNumber: row.rowNumber, entityId: created.id });
        }
      } catch (error) {
        await manager.query(`ROLLBACK TO SAVEPOINT "${savepoint}"`);
        failures.push({ rowNumber: row.rowNumber, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return { committedCount: succeeded.length, failedCount: failures.length, succeeded, failures };
  }

  async buildTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Customers');
    sheet.addRow(['name', 'phone', 'email', 'address']);
    sheet.addRow(['Jane Smith', '9800000000', 'jane@example.com', '123 Main St']);
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async buildExport(): Promise<Buffer> {
    const customers = await this.customersRepository.find({ order: { id: 'ASC' } });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Customers');
    sheet.addRow(['name', 'phone', 'email', 'address']);
    for (const customer of customers) {
      sheet.addRow([customer.name, customer.phone ?? '', customer.email ?? '', primaryAddressLine1(customer.addresses) ?? '']);
    }
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }
}
