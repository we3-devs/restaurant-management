import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { OutletsModule } from '../outlets/outlets.module';
import { DiningAreasController } from './dining-areas.controller';
import { DiningAreasService } from './dining-areas.service';
import { DiningArea } from './entities/dining-area.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DiningArea]), AuthModule, OutletsModule],
  controllers: [DiningAreasController],
  providers: [DiningAreasService],
  exports: [TypeOrmModule, DiningAreasService],
})
export class DiningAreasModule {}
