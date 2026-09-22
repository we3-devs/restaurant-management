import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryKitItem } from './entities/inventory-kit-item.entity';
import { InventoryKitPortion } from './entities/inventory-kit-portion.entity';
import { InventoryKit } from './entities/inventory-kit.entity';
import { InventoryKitsController } from './inventory-kits.controller';
import { InventoryKitsService } from './inventory-kits.service';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryKit, InventoryKitItem, InventoryKitPortion])],
  controllers: [InventoryKitsController],
  providers: [InventoryKitsService],
  exports: [TypeOrmModule, InventoryKitsService],
})
export class InventoryKitsModule {}
