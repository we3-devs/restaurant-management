import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RolesModule } from '../roles/roles.module';
import { EmployeeDocument } from './entities/employee-document.entity';
import { Employee } from './entities/employee.entity';
import { Position } from './entities/position.entity';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, Position, EmployeeDocument]), AuthModule, RolesModule],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [TypeOrmModule, EmployeesService],
})
export class EmployeesModule {}
