import { Injectable } from '@nestjs/common';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { Addon } from '../addons/entities/addon.entity';
import { AddonsService } from '../addons/addons.service';
import { CustomerResponseDto } from '../customers/dto/customer-response.dto';
import { CustomersService } from '../customers/customers.service';
import { DiningTable } from '../dining-tables/entities/dining-table.entity';
import { DiningTablesService } from '../dining-tables/dining-tables.service';
import { FoodCategory } from '../food-categories/entities/food-category.entity';
import { FoodCategoriesService } from '../food-categories/food-categories.service';
import { IngredientCategory } from '../ingredient-categories/entities/ingredient-category.entity';
import { IngredientCategoriesService } from '../ingredient-categories/ingredient-categories.service';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { IngredientsService } from '../ingredients/ingredients.service';
import { Outlet } from '../outlets/entities/outlet.entity';
import { OutletsService } from '../outlets/outlets.service';
import { OutletDepartment } from '../outlet-departments/entities/outlet-department.entity';
import { OutletDepartmentsService } from '../outlet-departments/outlet-departments.service';
import { Reservation } from '../reservations/entities/reservation.entity';
import { ReservationsService } from '../reservations/reservations.service';
import { Unit } from '../units/entities/unit.entity';
import { UnitsService } from '../units/units.service';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { WarehousesService } from '../warehouses/warehouses.service';
import { PosBootstrapQueryDto } from './dto/pos-bootstrap-query.dto';
import { ReservationsBootstrapQueryDto } from './dto/reservations-bootstrap-query.dto';
import {
  WaiterAddonDto,
  WaiterDiningTableDto,
  WaiterFoodCategoryDto,
  WaiterOutletDepartmentDto,
  WaiterOutletDto,
  WaiterPosBootstrapResponseDto,
} from './dto/waiter-pos-bootstrap-response.dto';

function toWaiterOutlet(outlet: Outlet): WaiterOutletDto {
  return { id: outlet.id, name: outlet.name };
}

function toWaiterDepartment(dept: OutletDepartment): WaiterOutletDepartmentDto {
  return {
    id: dept.id,
    outletId: dept.outletId,
    name: dept.name,
    type: dept.type,
    canPrepareOrder: dept.canPrepareOrder,
  };
}

function toWaiterTable(table: DiningTable): WaiterDiningTableDto {
  return {
    id: table.id,
    outletId: table.outletId,
    diningAreaId: table.diningAreaId,
    name: table.name,
    code: table.code,
    capacity: table.capacity,
    // Straight passthrough of the live column — never hardcode/mask this.
    status: table.status,
    sortOrder: table.sortOrder,
    isActive: table.isActive,
  };
}

function toWaiterFoodCategory(category: FoodCategory): WaiterFoodCategoryDto {
  return {
    id: category.id,
    parentId: category.parentId,
    name: category.name,
    sortOrder: category.sortOrder,
  };
}

function toWaiterAddon(addon: Addon): WaiterAddonDto {
  return {
    id: addon.id,
    addonGroupId: addon.addonGroupId,
    name: addon.name,
    price: addon.price,
  };
}

export interface ReservationsBootstrapResponse {
  reservations: PaginatedResponse<Reservation>;
  customers: PaginatedResponse<CustomerResponseDto>;
  outlets: PaginatedResponse<Outlet>;
}

export interface InventoryBootstrapResponse {
  ingredients: PaginatedResponse<Ingredient>;
  units: PaginatedResponse<Unit>;
  categories: PaginatedResponse<IngredientCategory>;
  warehouses: PaginatedResponse<Warehouse>;
}

/**
 * Aggregate "screen bootstrap" endpoints. Each one is a thin fan-out over
 * the same services their standalone REST endpoints already use — no
 * duplicated query logic — just collapsed into a single round trip for
 * screens that otherwise fire 4-6 independent requests on every mount.
 * Food variants deliberately stay out of the POS payload: the variant
 * picker only needs them for one food at a time, so fetching them lazily
 * when that dialog opens is already the cheaper path.
 */
@Injectable()
export class BootstrapService {
  constructor(
    private readonly outletsService: OutletsService,
    private readonly outletDepartmentsService: OutletDepartmentsService,
    private readonly diningTablesService: DiningTablesService,
    private readonly foodCategoriesService: FoodCategoriesService,
    private readonly addonsService: AddonsService,
    private readonly customersService: CustomersService,
    private readonly reservationsService: ReservationsService,
    private readonly ingredientsService: IngredientsService,
    private readonly unitsService: UnitsService,
    private readonly ingredientCategoriesService: IngredientCategoriesService,
    private readonly warehousesService: WarehousesService,
  ) {}

  /**
   * outletId has already been validated against the caller's outlet
   * assignments (or superadmin) by BootstrapController before this runs —
   * see OutletAccessService.assertOutletAccess. Departments/tables are
   * fetched scoped to that outletId at the query level; food categories and
   * addons have no outlet dimension anywhere in the schema (global catalog),
   * so there's nothing to scope there.
   */
  async getPosBootstrap(
    query: PosBootstrapQueryDto,
  ): Promise<WaiterPosBootstrapResponseDto> {
    const { outletId } = query;

    const [outlet, departments, tables, foodCategories, addons] =
      await Promise.all([
        this.outletsService.findOne(outletId),
        this.outletDepartmentsService.findAll({
          page: 1,
          limit: 100,
          outletId,
        }),
        this.diningTablesService.findAll({ page: 1, limit: 100, outletId }),
        this.foodCategoriesService.findAll({ page: 1, limit: 100 }),
        this.addonsService.findAll({ page: 1, limit: 100 }),
      ]);

    return {
      outlet: toWaiterOutlet(outlet),
      departments: departments.data.map(toWaiterDepartment),
      tables: tables.data.map(toWaiterTable),
      foodCategories: foodCategories.data.map(toWaiterFoodCategory),
      addons: addons.data.map(toWaiterAddon),
    };
  }

  async getReservationsBootstrap(
    query: ReservationsBootstrapQueryDto,
  ): Promise<ReservationsBootstrapResponse> {
    const { outletId } = query;

    const [reservations, customers, outlets] = await Promise.all([
      this.reservationsService.findAll({ page: 1, limit: 50, outletId }),
      this.customersService.findAll({ page: 1, limit: 100 }),
      this.outletsService.findAll({ page: 1, limit: 100 }),
    ]);

    return { reservations, customers, outlets };
  }

  async getInventoryBootstrap(): Promise<InventoryBootstrapResponse> {
    const [ingredients, units, categories, warehouses] = await Promise.all([
      this.ingredientsService.findAll({ page: 1, limit: 100 }),
      this.unitsService.findAll({ page: 1, limit: 100 }),
      this.ingredientCategoriesService.findAll({ page: 1, limit: 100 }),
      this.warehousesService.findAll({ page: 1, limit: 100 }),
    ]);

    return { ingredients, units, categories, warehouses };
  }
}
