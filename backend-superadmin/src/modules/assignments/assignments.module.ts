import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { EmployeesModule } from '../employees/employees.module';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { OrderAssignment } from './entities/order-assignment.entity';
import { TableAssignment } from './entities/table-assignment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TableAssignment, OrderAssignment]),
    AuthModule,
    EmployeesModule,
  ],
  controllers: [AssignmentsController],
  providers: [AssignmentsService],
  exports: [TypeOrmModule, AssignmentsService],
})
export class AssignmentsModule {}
