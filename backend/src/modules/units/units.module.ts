import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnitConversion } from './entities/unit-conversion.entity';
import { Unit } from './entities/unit.entity';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';

@Module({
  imports: [TypeOrmModule.forFeature([Unit, UnitConversion])],
  controllers: [UnitsController],
  providers: [UnitsService],
  exports: [TypeOrmModule, UnitsService],
})
export class UnitsModule {}
