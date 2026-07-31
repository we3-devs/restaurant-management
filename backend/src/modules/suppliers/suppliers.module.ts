import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { KitchenTicketsModule } from '../kitchen-tickets/kitchen-tickets.module';
import { SupplierCategory } from './entities/supplier-category.entity';
import { SupplierDocument } from './entities/supplier-document.entity';
import { Supplier } from './entities/supplier.entity';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Supplier, SupplierCategory, SupplierDocument]),
    NotificationsModule,
    KitchenTicketsModule,
  ],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [TypeOrmModule, SuppliersService],
})
export class SuppliersModule {}
