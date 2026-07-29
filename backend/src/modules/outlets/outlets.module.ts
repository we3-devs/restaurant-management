import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Outlet } from './entities/outlet.entity';
import { OutletsController } from './outlets.controller';
import { OutletsService } from './outlets.service';

@Module({
  imports: [TypeOrmModule.forFeature([Outlet])],
  controllers: [OutletsController],
  providers: [OutletsService],
  exports: [TypeOrmModule, OutletsService],
})
export class OutletsModule {}
