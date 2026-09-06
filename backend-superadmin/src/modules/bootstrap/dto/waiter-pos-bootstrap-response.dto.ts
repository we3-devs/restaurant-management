import { ApiProperty } from '@nestjs/swagger';
import type { OutletDepartmentType } from '../../outlet-departments/entities/outlet-department.entity';
import type {
  DiningTableStatus,
} from '../../dining-tables/entities/dining-table.entity';

/**
 * Minimal, waiter-facing projections of the underlying entities — no
 * timestamps, soft-delete markers, or floor-plan-editor/admin-only fields
 * (position/size/rotation, department code/description, addon recipe flags,
 * category slug/image). Keep in sync with whatever the POS screen actually
 * reads; add a field here (not by widening this back to the full entity)
 * if the UI grows a real need for it.
 */
export class WaiterOutletDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;
}

export class WaiterOutletDepartmentDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  outletId: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  type: OutletDepartmentType;

  @ApiProperty()
  canPrepareOrder: boolean;
}

export class WaiterDiningTableDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  outletId: number;

  @ApiProperty()
  diningAreaId: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false, nullable: true })
  code: string | null;

  @ApiProperty()
  capacity: number;

  /** Live status — never hardcoded/masked; reflects the same column TableSessionsService writes. */
  @ApiProperty()
  status: DiningTableStatus;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  isActive: boolean;
}

export class WaiterFoodCategoryDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ required: false, nullable: true })
  parentId: number | null;

  @ApiProperty()
  name: string;

  @ApiProperty()
  sortOrder: number;
}

export class WaiterAddonDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ required: false, nullable: true })
  addonGroupId: number | null;

  @ApiProperty()
  name: string;

  @ApiProperty()
  price: number;
}

export class WaiterPosBootstrapResponseDto {
  @ApiProperty({ type: WaiterOutletDto })
  outlet: WaiterOutletDto;

  @ApiProperty({ type: [WaiterOutletDepartmentDto] })
  departments: WaiterOutletDepartmentDto[];

  @ApiProperty({ type: [WaiterDiningTableDto] })
  tables: WaiterDiningTableDto[];

  @ApiProperty({ type: [WaiterFoodCategoryDto] })
  foodCategories: WaiterFoodCategoryDto[];

  @ApiProperty({ type: [WaiterAddonDto] })
  addons: WaiterAddonDto[];
}
