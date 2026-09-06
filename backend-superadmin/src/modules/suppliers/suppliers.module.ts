import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { KitchenTicketsModule } from '../kitchen-tickets/kitchen-tickets.module';
import { OutletsModule } from '../outlets/outlets.module';
import { SupplierCategory } from './entities/supplier-category.entity';
import { SupplierDocument } from './entities/supplier-document.entity';
import { Supplier } from './entities/supplier.entity';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { SuppliersImporter } from './import/suppliers-importer';

@Module({
  imports: [
    TypeOrmModule.forFeature([Supplier, SupplierCategory, SupplierDocument]),
    NotificationsModule,
    KitchenTicketsModule,
    OutletsModule,
  ],
  controllers: [SuppliersController],
  providers: [SuppliersService, SuppliersImporter],
  exports: [TypeOrmModule, SuppliersService, SuppliersImporter],
})
export class SuppliersModule {}
