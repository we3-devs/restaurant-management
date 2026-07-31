import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { KitchenTicketsModule } from '../kitchen-tickets/kitchen-tickets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Order } from '../orders/entities/order.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    NotificationsModule,
    KitchenTicketsModule,
    AuthModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
