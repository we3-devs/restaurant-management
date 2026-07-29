import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutletDepartmentsModule } from '../outlet-departments/outlet-departments.module';
import { OutletsModule } from '../outlets/outlets.module';
import { Warehouse } from './entities/warehouse.entity';
import { WarehousesController } from './warehouses.controller';
import { WarehousesService } from './warehouses.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Warehouse]),
    OutletsModule,
    OutletDepartmentsModule,
  ],
  controllers: [WarehousesController],
  providers: [WarehousesService],
  exports: [TypeOrmModule, WarehousesService],
})
export class WarehousesModule {}
