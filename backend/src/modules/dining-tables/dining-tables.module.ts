import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstrumentationModule } from '../../common/instrumentation/instrumentation.module';
import { DiningAreasModule } from '../dining-areas/dining-areas.module';
import { OutletsModule } from '../outlets/outlets.module';
import { DiningTablesController } from './dining-tables.controller';
import { DiningTablesService } from './dining-tables.service';
import { DiningTable } from './entities/dining-table.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DiningTable]),
    DiningAreasModule,
    OutletsModule,
    InstrumentationModule,
  ],
  controllers: [DiningTablesController],
  providers: [DiningTablesService],
  exports: [TypeOrmModule, DiningTablesService],
})
export class DiningTablesModule {}
