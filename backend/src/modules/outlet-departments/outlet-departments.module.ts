import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutletsModule } from '../outlets/outlets.module';
import { OutletDepartment } from './entities/outlet-department.entity';
import { OutletDepartmentsController } from './outlet-departments.controller';
import { OutletDepartmentsService } from './outlet-departments.service';

@Module({
  imports: [TypeOrmModule.forFeature([OutletDepartment]), OutletsModule],
  controllers: [OutletDepartmentsController],
  providers: [OutletDepartmentsService],
  exports: [TypeOrmModule, OutletDepartmentsService],
})
export class OutletDepartmentsModule {}
