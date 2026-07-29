import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddonGroupsModule } from '../addon-groups/addon-groups.module';
import { AddonsController } from './addons.controller';
import { AddonsService } from './addons.service';
import { Addon } from './entities/addon.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Addon]), AddonGroupsModule],
  controllers: [AddonsController],
  providers: [AddonsService],
  exports: [TypeOrmModule, AddonsService],
})
export class AddonsModule {}
