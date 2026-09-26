import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TenantContext } from '../../common/tenant/tenant-context';
import { scopedWhere, tenantFields } from '../../common/tenant/tenant-scope';
import { IngredientsService } from '../ingredients/ingredients.service';
import { StockInsService } from '../stock-ins/stock-ins.service';
import { CreateIngredientVariantPortionDto } from './dto/create-ingredient-variant-portion.dto';
import { CreateIngredientVariantDto } from './dto/create-ingredient-variant.dto';
import { ReceiveVariantsStockDto } from './dto/receive-variants-stock.dto';
import { IngredientVariantPortion } from './entities/ingredient-variant-portion.entity';
import { IngredientVariant } from './entities/ingredient-variant.entity';

@Injectable()
export class IngredientVariantsService {
  constructor(
    @InjectRepository(IngredientVariant)
    private readonly variantsRepository: Repository<IngredientVariant>,
    @InjectRepository(IngredientVariantPortion)
    private readonly portionsRepository: Repository<IngredientVariantPortion>,
    private readonly ingredientsService: IngredientsService,
    private readonly stockInsService: StockInsService,
    private readonly tenantContext: TenantContext,
  ) {}

  // ---------------------------------------------------------------- variants

  /** Every size variant of a base item — the item's own detail page's "Variants" section. */
  async listForParent(parentIngredientId: number): Promise<IngredientVariant[]> {
    await this.ingredientsService.findOne(parentIngredientId);
    return this.variantsRepository.find({
      where: scopedWhere(this.tenantContext, { parentIngredientId }),
      order: { sortOrder: 'ASC', label: 'ASC' },
    });
  }

  /** Kits an ingredient is itself a variant of, across every parent — the reverse lookup. */
  async listForIngredient(ingredientId: number): Promise<(IngredientVariant & { parentName: string })[]> {
    const variants = await this.variantsRepository.find({
      where: scopedWhere(this.tenantContext, { ingredientId }),
      order: { label: 'ASC' },
    });
    if (variants.length === 0) {
      return [];
    }
    const parents = await this.ingredientsService.findByIds([
      ...new Set(variants.map((variant) => variant.parentIngredientId)),
    ]);
    const nameById = new Map(parents.map((parent) => [parent.id, parent.name]));
    return variants.map((variant) => ({
      ...variant,
      parentName: nameById.get(variant.parentIngredientId) ?? '',
    }));
  }

  async addVariant(
    parentIngredientId: number,
    dto: CreateIngredientVariantDto,
  ): Promise<IngredientVariant> {
    await this.ingredientsService.findOne(parentIngredientId);
    await this.ingredientsService.findOne(dto.ingredientId);

    const variant = this.variantsRepository.create({
      parentIngredientId,
      ingredientId: dto.ingredientId,
      label: dto.label,
      unitId: dto.unitId,
      unitsPerPackage: dto.unitsPerPackage ?? null,
      packageLabel: dto.packageLabel ?? null,
      sortOrder: dto.sortOrder ?? 0,
      ...tenantFields(this.tenantContext),
    });
    return this.variantsRepository.save(variant);
  }

  async removeVariant(parentIngredientId: number, variantId: number): Promise<void> {
    const variant = await this.findVariantOrThrow(parentIngredientId, variantId);
    await this.portionsRepository.delete(
      scopedWhere<IngredientVariantPortion>(this.tenantContext, { ingredientVariantId: variantId }),
    );
    await this.variantsRepository.delete(variant.id);
  }

  private async findVariantOrThrow(
    parentIngredientId: number,
    variantId: number,
  ): Promise<IngredientVariant> {
    const variant = await this.variantsRepository.findOne({
      where: scopedWhere(this.tenantContext, { id: variantId, parentIngredientId }),
    });
    if (!variant) {
      throw new NotFoundException(`Variant ${variantId} not found`);
    }
    return variant;
  }

  // --------------------------------------------------------------- portions

  async listPortions(parentIngredientId: number, variantId: number): Promise<IngredientVariantPortion[]> {
    await this.findVariantOrThrow(parentIngredientId, variantId);
    return this.portionsRepository.find({
      where: scopedWhere(this.tenantContext, { ingredientVariantId: variantId }),
      order: { name: 'ASC' },
    });
  }

  async addPortion(
    parentIngredientId: number,
    variantId: number,
    dto: CreateIngredientVariantPortionDto,
  ): Promise<IngredientVariantPortion> {
    await this.findVariantOrThrow(parentIngredientId, variantId);
    const portion = this.portionsRepository.create({
      ingredientVariantId: variantId,
      name: dto.name,
      unitId: dto.unitId,
      quantity: dto.quantity,
      ...tenantFields(this.tenantContext),
    });
    return this.portionsRepository.save(portion);
  }

  async removePortion(parentIngredientId: number, variantId: number, portionId: number): Promise<void> {
    await this.findVariantOrThrow(parentIngredientId, variantId);
    const portion = await this.portionsRepository.findOne({
      where: scopedWhere(this.tenantContext, { id: portionId, ingredientVariantId: variantId }),
    });
    if (!portion) {
      throw new NotFoundException(`Portion ${portionId} not found`);
    }
    await this.portionsRepository.delete(portion.id);
  }

  // ------------------------------------------------------------- receiving

  /**
   * Receives stock for several variants of the same base item in one go
   * (e.g. 1 carton of 4x 250ml plus 3 cartons of 4x 500ml each), converting
   * each line's package count via that variant's own unitsPerPackage before
   * posting — one IngredientStockIn with one item per line, approved
   * immediately so it hits the ledger the same way a regular Stock-In does.
   */
  async receiveStock(
    parentIngredientId: number,
    dto: ReceiveVariantsStockDto,
    createdBy: number,
  ): Promise<void> {
    await this.ingredientsService.findOne(parentIngredientId);

    const variants = await this.variantsRepository.find({
      where: scopedWhere(this.tenantContext, {
        id: In(dto.lines.map((line) => line.variantId)),
        parentIngredientId,
      }),
    });
    const variantById = new Map(variants.map((variant) => [variant.id, variant]));

    const stockIn = await this.stockInsService.create(
      {
        warehouseId: dto.warehouseId,
        stockInDate: dto.stockInDate,
        source: 'purchase',
        remarks: dto.remarks,
      },
      createdBy,
    );

    for (const line of dto.lines) {
      const variant = variantById.get(line.variantId);
      if (!variant) {
        throw new NotFoundException(`Variant ${line.variantId} not found on this item`);
      }
      const quantity = variant.unitsPerPackage
        ? line.packages * variant.unitsPerPackage
        : line.packages;
      await this.stockInsService.addItem(stockIn.id, {
        ingredientId: variant.ingredientId,
        quantity,
        unitCost: line.unitCost,
      });
    }

    await this.stockInsService.approve(stockIn.id, createdBy);
  }
}
