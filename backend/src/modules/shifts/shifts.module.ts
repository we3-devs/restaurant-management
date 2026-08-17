import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ShiftAssignment } from './entities/shift-assignment.entity';
import { Shift } from './entities/shift.entity';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';

@Module({
  imports: [TypeOrmModule.forFeature([Shift, ShiftAssignment]), AuthModule],
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [TypeOrmModule, ShiftsService],
})
export class ShiftsModule {}
