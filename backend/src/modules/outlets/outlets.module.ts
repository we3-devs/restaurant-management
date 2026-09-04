import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Outlet } from './entities/outlet.entity';
import { OutletsController } from './outlets.controller';
import { OutletsService } from './outlets.service';
import { OutletsImporter } from './import/outlets-importer';
import { Tenant } from '../tenants/entities/tenant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Outlet, Tenant]), AuthModule],
  controllers: [OutletsController],
  providers: [OutletsService, OutletsImporter],
  exports: [TypeOrmModule, OutletsService, OutletsImporter],
})
export class OutletsModule {}
