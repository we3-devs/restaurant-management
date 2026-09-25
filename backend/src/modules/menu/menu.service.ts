import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Addon } from '../addons/entities/addon.entity';
import { AddonGroup } from '../addon-groups/entities/addon-group.entity';
import { scopedWhere } from '../../common/tenant/tenant-scope';
import { TenantContext } from '../../common/tenant/tenant-context';
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
    private readonly tenantContext: TenantContext,
  ) {}

  async getVersion(): Promise<MenuVersionResponse> {
    const tenantId = this.tenantContext.getTenantId();
    const rows = await Promise.all([
      this.foods, this.categories, this.foodVariants, this.variants,
      this.subVariants, this.addonGroups, this.addons, this.foodAddonGroups,
      this.stocks,
    ].map((repository) => {
      const qb = repository.createQueryBuilder('x').select('COUNT(*)', 'count').addSelect('MAX(x.updated_at)', 'updated');
      if (tenantId !== null) qb.andWhere('x.tenant_id = :tenantId', { tenantId });
      return qb.getRawOne<{ count: string; updated: string | null }>();
    }));
    return { version: rows.map((row) => `${row?.count ?? 0}:${row?.updated ?? ''}`).join('|') };
  }

  async getBootstrap(outletId: number) {
    const [foods, categories, foodVariants, variants, subVariants, addonGroups, addons, foodAddonGroups, version] = await Promise.all([
      this.foods.find({ where: scopedWhere(this.tenantContext, { isActive: true }), order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.categories.find({ where: scopedWhere(this.tenantContext, { isActive: true }), order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.foodVariants.find({ where: scopedWhere(this.tenantContext, { isActive: true }), order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.variants.find({ where: scopedWhere(this.tenantContext, { isActive: true }), order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.subVariants.find({ where: scopedWhere(this.tenantContext, { isActive: true }), order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.addonGroups.find({ where: scopedWhere(this.tenantContext, { isActive: true }), order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.addons.find({ where: scopedWhere(this.tenantContext, { isActive: true }), order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.foodAddonGroups.find({ where: scopedWhere(this.tenantContext, {}) }),
      this.getVersion(),
    ]);
    const inventoryAvailable = await this.getInventoryAvailability(outletId, foodVariants);
    return {
      version: version.version,
      foods,
      categories,
      foodVariants: foodVariants.map((variant) => ({ ...variant, inventoryAvailable: inventoryAvailable.get(variant.id) ?? true })),
      variants,
      subVariants,
      addonGroups,
      addons,
      foodAddonGroups,
    };
  }

  /**
   * Per food ITEM (variant), not per food — each variant of a food (e.g. a
   * Large vs a Small drink) can be linked to a different ingredient and so
   * can be in-stock/out-of-stock independently of its siblings.
   */
  private async getInventoryAvailability(outletId: number, foodVariants: FoodVariant[]): Promise<Map<number, boolean>> {
    const result = new Map<number, boolean>();
    const trackedVariants = foodVariants.filter((variant) => variant.inventoryIngredientId !== null);
    let warehouse;
    try { warehouse = await this.warehousesService.findDefaultForOutlet(outletId); } catch {
      for (const variant of trackedVariants) result.set(variant.id, false);
      return result;
    }
    const stocks = await this.stocks.find({ where: { warehouseId: warehouse.id } });
    const available = new Map(stocks.map((stock) => [stock.ingredientId, Math.max(0, stock.quantity - stock.reservedQuantity)]));
    for (const variant of trackedVariants) {
      const quantity = available.get(variant.inventoryIngredientId!);
      result.set(variant.id, (quantity ?? 0) > 0);
    }
    return result;
  }
}
