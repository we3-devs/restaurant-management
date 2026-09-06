import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddonGroupsModule } from '../addon-groups/addon-groups.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { UnitsModule } from '../units/units.module';
import { AddonsController } from './addons.controller';
import { AddonsService } from './addons.service';
import { AddonRecipe } from './entities/addon-recipe.entity';
import { Addon } from './entities/addon.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Addon, AddonRecipe]),
    AddonGroupsModule,
    IngredientsModule,
    UnitsModule,
  ],
  controllers: [AddonsController],
  providers: [AddonsService],
  exports: [TypeOrmModule, AddonsService],
})
export class AddonsModule {}
