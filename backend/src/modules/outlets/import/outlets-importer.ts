import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { EntityManager, Repository } from 'typeorm';
import type { ImportDomainConfig, ImportRawRow } from '../../data-import/interfaces/import-domain-config.interface';
import type { ImportCommitResult } from '../../data-import/interfaces/import-result.interface';
import type { ImportValidatedRow } from '../../data-import/interfaces/import-row.interface';
import { Outlet } from '../entities/outlet.entity';

interface OutletImportRow extends ImportValidatedRow {
  name: string;
}

/**
 * Outlets — identity: name (create only, no upsert). Outlets are few and
 * high-stakes, so a re-imported name that already exists is a validation
 * error, not an update — nothing about an existing outlet is ever mutated by
 * this importer; it only ever creates brand-new rows.
 */
@Injectable()
export class OutletsImporter implements ImportDomainConfig<Record<string, string>, OutletImportRow> {
  domain = 'outlets';
  label = 'Outlets';
  mode = 'create' as const;
  identityDescription = 'name';
  headerAliases: Record<string, string> = {
    name: 'name',
    outletname: 'name',
    outlet: 'name',
  };

  constructor(
    @InjectRepository(Outlet)
    private readonly outletsRepository: Repository<Outlet>,
  ) {}

  async validateRows(rows: ImportRawRow<Record<string, string>>[]): Promise<OutletImportRow[]> {
    const existing = await this.outletsRepository.find({ select: { name: true } });
    const existingNames = new Set(existing.map((o) => o.name.trim().toLowerCase()));
    const seenInBatch = new Set<string>();

    return rows.map(({ rowNumber, raw }) => {
      const name = (raw.name ?? '').trim();
      const errors: string[] = [];

      if (!name) {
        errors.push('name is required');
      } else {
        const key = name.toLowerCase();
        if (existingNames.has(key)) {
          errors.push(`Outlet "${name}" already exists`);
        } else if (seenInBatch.has(key)) {
          errors.push(`Duplicate outlet name "${name}" in this file`);
        } else {
          seenInBatch.add(key);
        }
      }

      return { rowNumber, name, errors };
    });
  }

  async commitRows(rows: OutletImportRow[], manager: EntityManager): Promise<ImportCommitResult> {
    const repo = manager.getRepository(Outlet);
    const failures: ImportCommitResult['failures'] = [];
    const succeeded: ImportCommitResult['succeeded'] = [];

    for (const row of rows) {
      try {
        const created = await repo.save(repo.create({ name: row.name }));
        succeeded.push({ rowNumber: row.rowNumber, entityId: created.id });
      } catch (error) {
        failures.push({
          rowNumber: row.rowNumber,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { committedCount: succeeded.length, failedCount: failures.length, succeeded, failures };
  }

  async buildTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Outlets');
    sheet.addRow(['name']);
    sheet.addRow(['Example Outlet']);
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }
}
