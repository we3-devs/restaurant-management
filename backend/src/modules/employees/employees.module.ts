import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RolesModule } from '../roles/roles.module';
import { OutletsModule } from '../outlets/outlets.module';
import { EmployeeDocument } from './entities/employee-document.entity';
import { Employee } from './entities/employee.entity';
import { Position } from './entities/position.entity';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { EmployeesImporter } from './import/employees-importer';

@Module({
  imports: [
    TypeOrmModule.forFeature([Employee, Position, EmployeeDocument]),
    AuthModule,
    RolesModule,
    OutletsModule,
  ],
  controllers: [EmployeesController],
  providers: [EmployeesService, EmployeesImporter],
  exports: [TypeOrmModule, EmployeesService, EmployeesImporter],
})
export class EmployeesModule {}
