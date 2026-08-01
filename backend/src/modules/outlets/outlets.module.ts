import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Outlet } from './entities/outlet.entity';
import { OutletsController } from './outlets.controller';
import { OutletsService } from './outlets.service';

@Module({
  imports: [TypeOrmModule.forFeature([Outlet]), AuthModule],
  controllers: [OutletsController],
  providers: [OutletsService],
  exports: [TypeOrmModule, OutletsService],
})
export class OutletsModule {}
