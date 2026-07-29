import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiningTablesModule } from '../dining-tables/dining-tables.module';
import { OutletsModule } from '../outlets/outlets.module';
import { TableSession } from './entities/table-session.entity';
import { TableSessionsController } from './table-sessions.controller';
import { TableSessionsService } from './table-sessions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TableSession]),
    DiningTablesModule,
    OutletsModule,
  ],
  controllers: [TableSessionsController],
  providers: [TableSessionsService],
  exports: [TypeOrmModule, TableSessionsService],
})
export class TableSessionsModule {}
