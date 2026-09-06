import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddonGroupsController } from './addon-groups.controller';
import { AddonGroupsService } from './addon-groups.service';
import { AddonGroup } from './entities/addon-group.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AddonGroup])],
  controllers: [AddonGroupsController],
  providers: [AddonGroupsService],
  exports: [TypeOrmModule, AddonGroupsService],
})
export class AddonGroupsModule {}
