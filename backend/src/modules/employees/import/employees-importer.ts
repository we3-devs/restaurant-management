import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { EntityManager, Repository } from 'typeorm';
import type { ImportDomainConfig, ImportRawRow } from '../../data-import/interfaces/import-domain-config.interface';
import type { ImportCommitResult } from '../../data-import/interfaces/import-result.interface';
import type { ImportValidatedRow } from '../../data-import/interfaces/import-row.interface';
import { Employee } from '../entities/employee.entity';
import { Position } from '../entities/position.entity';
import { Outlet } from '../../outlets/entities/outlet.entity';

interface EmployeeImportRow extends ImportValidatedRow {
  employeeCode: string;
  name: string;
  /** Raw lookup text as typed/uploaded — echoed back (not just the resolved id) so the frontend has something editable to redisplay and resend at revalidate/commit time. */
  outlet: string;
  outletId: number | null;
  position: string;
  positionId: number | null;
  email: string | null;
  phone: string | null;
}

/**
 * Employees — create only, no upsert. A spreadsheet re-import must never
 * silently overwrite an existing employee's identity/contact fields, so a
 * row whose employeeCode already exists is a validation error, not an
 * update. Explicitly does NOT import login credentials — imported employees
 * get no linked user account; that's provisioned separately through the
 * existing "create user" flow if/when they need one. Outlet and position are
 * resolved by exact name match only, same as every other importer.
 */
@Injectable()
export class EmployeesImporter implements ImportDomainConfig<Record<string, string>, EmployeeImportRow> {
  domain = 'employees';
  label = 'Employees';
  mode = 'create' as const;
  identityDescription = 'employee code';
  headerAliases: Record<string, string> = {
    name: 'name',
    employeecode: 'employeeCode',
    code: 'employeeCode',
    outlet: 'outlet',
    position: 'position',
    email: 'email',
    phone: 'phone',
  };

  constructor(
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
    @InjectRepository(Position)
    private readonly positionsRepository: Repository<Position>,
    @InjectRepository(Outlet)
    private readonly outletsRepository: Repository<Outlet>,
  ) {}

  async validateRows(rows: ImportRawRow<Record<string, string>>[]): Promise<EmployeeImportRow[]> {
    const [existingEmployees, positions, outlets] = await Promise.all([
      this.employeesRepository.find({ select: { employeeCode: true } }),
      this.positionsRepository.find({ select: { id: true, name: true } }),
      this.outletsRepository.find({ select: { id: true, name: true } }),
    ]);
    const existingCodes = new Set(existingEmployees.map((e) => e.employeeCode.trim().toLowerCase()));
    const positionByName = new Map(positions.map((p) => [p.name.trim().toLowerCase(), p.id]));
    const outletByName = new Map(outlets.map((o) => [o.name.trim().toLowerCase(), o.id]));
    const seenCodesInBatch = new Set<string>();

    return rows.map(({ rowNumber, raw }) => {
      const name = (raw.name ?? '').trim();
      const employeeCode = (raw.employeeCode ?? '').trim();
      const outletName = (raw.outlet ?? '').trim();
      const positionName = (raw.position ?? '').trim();
      const email = (raw.email ?? '').trim() || null;
      const phone = (raw.phone ?? '').trim() || null;
      const errors: string[] = [];

      if (!name) errors.push('name is required');

      if (!employeeCode) {
        errors.push('employee code is required');
      } else {
        const codeKey = employeeCode.toLowerCase();
        if (existingCodes.has(codeKey)) {
          errors.push(`Employee code "${employeeCode}" already exists`);
        } else if (seenCodesInBatch.has(codeKey)) {
          errors.push(`Duplicate employee code "${employeeCode}" in this file`);
        }
        seenCodesInBatch.add(codeKey);
      }

      let outletId: number | null = null;
      if (!outletName) {
        errors.push('outlet is required');
      } else {
        outletId = outletByName.get(outletName.toLowerCase()) ?? null;
        if (outletId === null) errors.push(`Outlet "${outletName}" not found — expected an existing outlet`);
      }

      let positionId: number | null = null;
      if (positionName) {
        positionId = positionByName.get(positionName.toLowerCase()) ?? null;
        if (positionId === null) errors.push(`Position "${positionName}" not found — expected an existing position`);
      }

      return { rowNumber, employeeCode, name, outlet: outletName, outletId, position: positionName, positionId, email, phone, errors };
    });
  }

  async commitRows(rows: EmployeeImportRow[], manager: EntityManager): Promise<ImportCommitResult> {
    const repo = manager.getRepository(Employee);
    const failures: ImportCommitResult['failures'] = [];
    const succeeded: ImportCommitResult['succeeded'] = [];

    for (const row of rows) {
      try {
        const created = await repo.save(
          repo.create({
            employeeCode: row.employeeCode,
            name: row.name,
            outletId: row.outletId!,
            positionId: row.positionId,
            email: row.email,
            phone: row.phone,
          }),
        );
        succeeded.push({ rowNumber: row.rowNumber, entityId: created.id });
      } catch (error) {
        failures.push({ rowNumber: row.rowNumber, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return { committedCount: succeeded.length, failedCount: failures.length, succeeded, failures };
  }

  async buildTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Employees');
    sheet.addRow(['name', 'employeeCode', 'outlet', 'position', 'email', 'phone']);
    sheet.addRow(['Jane Doe', 'EMP-001', 'Downtown', 'Waiter', 'jane@example.com', '9800000000']);
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async buildExport(): Promise<Buffer> {
    const [employees, positions, outlets] = await Promise.all([
      this.employeesRepository.find({ order: { id: 'ASC' } }),
      this.positionsRepository.find({ select: { id: true, name: true } }),
      this.outletsRepository.find({ select: { id: true, name: true } }),
    ]);
    const positionById = new Map(positions.map((p) => [p.id, p.name]));
    const outletById = new Map(outlets.map((o) => [o.id, o.name]));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Employees');
    sheet.addRow(['name', 'employeeCode', 'outlet', 'position', 'email', 'phone']);
    for (const employee of employees) {
      sheet.addRow([
        employee.name,
        employee.employeeCode,
        outletById.get(employee.outletId) ?? '',
        employee.positionId ? (positionById.get(employee.positionId) ?? '') : '',
        employee.email ?? '',
        employee.phone ?? '',
      ]);
    }
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }
}
