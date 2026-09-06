import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadsModule } from '../uploads/uploads.module';
import { OutletsModule } from '../outlets/outlets.module';
import { OutletsImporter } from '../outlets/import/outlets-importer';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { IngredientsImporter } from '../ingredients/import/ingredients-importer';
import { EmployeesModule } from '../employees/employees.module';
import { EmployeesImporter } from '../employees/import/employees-importer';
import { CustomersModule } from '../customers/customers.module';
import { CustomersImporter } from '../customers/import/customers-importer';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { SuppliersImporter } from '../suppliers/import/suppliers-importer';
import { FoodsModule } from '../foods/foods.module';
import { FoodsImporter } from '../foods/import/foods-importer';
import { DataImportController } from './data-import.controller';
import { DataImportService } from './data-import.service';
import { ImporterRegistry, IMPORT_DOMAIN_CONFIG } from './importer-registry';
import { ImportJob } from './entities/import-job.entity';
import { ImportJobRow } from './entities/import-job-row.entity';
import type { ImportDomainConfig } from './interfaces/import-domain-config.interface';

/**
 * Generic, domain-agnostic bulk-import engine — see the ImportDomainConfig
 * interface. The controller/service/parser/registry never reference a
 * specific domain. The one unavoidable exception is right here: NestJS has
 * no multi-provider merging across modules, so *something* has to combine
 * each domain's importer into the array ImporterRegistry reads — that's this
 * module's `useFactory` below, not the engine's runtime logic. Each domain
 * module exports its own importer as a plain provider; this module imports
 * the domain module and lists the importer as a `useFactory` inject
 * argument. Adding a new domain later means one import + one array entry
 * here, nothing in data-import.service.ts/.controller.ts.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ImportJob, ImportJobRow]),
    UploadsModule,
    OutletsModule,
    IngredientsModule,
    EmployeesModule,
    CustomersModule,
    SuppliersModule,
    FoodsModule,
  ],
  controllers: [DataImportController],
  providers: [
    DataImportService,
    ImporterRegistry,
    {
      provide: IMPORT_DOMAIN_CONFIG,
      useFactory: (
        outlets: OutletsImporter,
        ingredients: IngredientsImporter,
        employees: EmployeesImporter,
        customers: CustomersImporter,
        suppliers: SuppliersImporter,
        foods: FoodsImporter,
      ): ImportDomainConfig[] => [outlets, ingredients, employees, customers, suppliers, foods],
      inject: [OutletsImporter, IngredientsImporter, EmployeesImporter, CustomersImporter, SuppliersImporter, FoodsImporter],
    },
  ],
  exports: [ImporterRegistry],
})
export class DataImportModule {}
