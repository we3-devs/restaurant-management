import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersModule } from '../customers/customers.module';
import { DiningTablesModule } from '../dining-tables/dining-tables.module';
import { OutletsModule } from '../outlets/outlets.module';
import { TableSessionsModule } from '../table-sessions/table-sessions.module';
import { ReservationTable } from './entities/reservation-table.entity';
import { Reservation } from './entities/reservation.entity';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation, ReservationTable]),
    OutletsModule,
    CustomersModule,
    DiningTablesModule,
    forwardRef(() => TableSessionsModule),
  ],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [TypeOrmModule, ReservationsService],
})
export class ReservationsModule {}
