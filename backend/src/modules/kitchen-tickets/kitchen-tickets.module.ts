import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrderItem } from '../orders/entities/order-item.entity';
import { OutletDepartment } from '../outlet-departments/entities/outlet-department.entity';
import { KitchenTicketItem } from './entities/kitchen-ticket-item.entity';
import { KitchenTicket } from './entities/kitchen-ticket.entity';
import {
  KitchenDelayScanProcessor,
  KitchenDelayScanScheduler,
} from './kitchen-delay-scan.processor';
import { KitchenTicketsController } from './kitchen-tickets.controller';
import { KitchenTicketsGateway } from './kitchen-tickets.gateway';
import { KitchenTicketsService } from './kitchen-tickets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KitchenTicket,
      KitchenTicketItem,
      // Read/write access needed to mirror ticket-item status changes back
      // onto OrderItem.status and to read stations for the KDS bootstrap —
      // same "register the entity here" pattern OrdersModule uses for these
      // same two tables, to avoid a circular module import.
      OrderItem,
      OutletDepartment,
    ]),
    AuthModule,
    NotificationsModule,
    BullModule.registerQueue({ name: 'kitchen-delay-alerts' }),
  ],
  controllers: [KitchenTicketsController],
  providers: [
    KitchenTicketsService,
    KitchenTicketsGateway,
    KitchenDelayScanProcessor,
    KitchenDelayScanScheduler,
  ],
  exports: [TypeOrmModule, KitchenTicketsService, KitchenTicketsGateway],
})
export class KitchenTicketsModule {}
