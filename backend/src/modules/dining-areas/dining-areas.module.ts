import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutletsModule } from '../outlets/outlets.module';
import { DiningAreasController } from './dining-areas.controller';
import { DiningAreasService } from './dining-areas.service';
import { DiningArea } from './entities/dining-area.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DiningArea]), OutletsModule],
  controllers: [DiningAreasController],
  providers: [DiningAreasService],
  exports: [TypeOrmModule, DiningAreasService],
})
export class DiningAreasModule {}
