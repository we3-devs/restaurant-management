import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Addon } from '../addons/entities/addon.entity';
import { AddonGroup } from '../addon-groups/entities/addon-group.entity';
import { FoodCategory } from '../food-categories/entities/food-category.entity';
import { FoodAddonGroup } from '../foods/entities/food-addon-group.entity';
import { Food } from '../foods/entities/food.entity';
import { FoodVariant } from '../food-variants/entities/food-variant.entity';
import { WarehouseIngredientStock } from '../inventory-stock/entities/warehouse-ingredient-stock.entity';
import { WarehousesService } from '../warehouses/warehouses.service';
import { SubVariant } from '../variants/entities/sub-variant.entity';
import { Variant } from '../variants/entities/variant.entity';

export interface MenuVersionResponse { version: string }

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Food) private readonly foods: Repository<Food>,
    @InjectRepository(FoodCategory) private readonly categories: Repository<FoodCategory>,
    @InjectRepository(FoodVariant) private readonly foodVariants: Repository<FoodVariant>,
    @InjectRepository(Variant) private readonly variants: Repository<Variant>,
    @InjectRepository(SubVariant) private readonly subVariants: Repository<SubVariant>,
    @InjectRepository(AddonGroup) private readonly addonGroups: Repository<AddonGroup>,
    @InjectRepository(Addon) private readonly addons: Repository<Addon>,
    @InjectRepository(FoodAddonGroup) private readonly foodAddonGroups: Repository<FoodAddonGroup>,
    @InjectRepository(WarehouseIngredientStock) private readonly stocks: Repository<WarehouseIngredientStock>,
    private readonly warehousesService: WarehousesService,
  ) {}

  async getVersion(): Promise<MenuVersionResponse> {
    const rows = await Promise.all([
      this.foods, this.categories, this.foodVariants, this.variants,
      this.subVariants, this.addonGroups, this.addons, this.foodAddonGroups,
      this.stocks,
    ].map((repository) => repository.createQueryBuilder('x').select('COUNT(*)', 'count').addSelect('MAX(x.updated_at)', 'updated').getRawOne<{ count: string; updated: string | null }>()));
    return { version: rows.map((row) => `${row?.count ?? 0}:${row?.updated ?? ''}`).join('|') };
  }

  async getBootstrap(outletId: number) {
    const [foods, categories, foodVariants, variants, subVariants, addonGroups, addons, foodAddonGroups, version] = await Promise.all([
      this.foods.find({ where: { isActive: true }, order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.categories.find({ where: { isActive: true }, order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.foodVariants.find({ where: { isActive: true }, order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.variants.find({ where: { isActive: true }, order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.subVariants.find({ where: { isActive: true }, order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.addonGroups.find({ where: { isActive: true }, order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.addons.find({ where: { isActive: true }, order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.foodAddonGroups.find(),
      this.getVersion(),
    ]);
    const inventoryAvailable = await this.getInventoryAvailability(outletId, foods);
    return { version: version.version, foods: foods.map((food) => ({ ...food, inventoryAvailable: inventoryAvailable.get(food.id) ?? true })), categories, foodVariants, variants, subVariants, addonGroups, addons, foodAddonGroups };
  }

  private async getInventoryAvailability(outletId: number, foods: Food[]): Promise<Map<number, boolean>> {
    const result = new Map<number, boolean>();
    const trackedFoods = foods.filter((food) => food.inventoryIngredientId !== null);
    let warehouse;
    try { warehouse = await this.warehousesService.findDefaultForOutlet(outletId); } catch {
      for (const food of trackedFoods) result.set(food.id, false);
      return result;
    }
    const stocks = await this.stocks.find({ where: { warehouseId: warehouse.id } });
    const available = new Map(stocks.map((stock) => [stock.ingredientId, Math.max(0, stock.quantity - stock.reservedQuantity)]));
    for (const food of trackedFoods) {
      const quantity = available.get(food.inventoryIngredientId!);
      result.set(food.id, (quantity ?? 0) > 0);
    }
    return result;
  }
}
