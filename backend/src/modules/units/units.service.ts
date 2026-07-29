import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, QueryFailedError, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { CreateUnitConversionDto } from './dto/create-unit-conversion.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { ListUnitsQueryDto } from './dto/list-units-query.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitConversion } from './entities/unit-conversion.entity';
import { Unit } from './entities/unit.entity';

@Injectable()
export class UnitsService {
  constructor(
    @InjectRepository(Unit)
    private readonly unitsRepository: Repository<Unit>,
    @InjectRepository(UnitConversion)
    private readonly unitConversionsRepository: Repository<UnitConversion>,
  ) {}

  async findAll(query: ListUnitsQueryDto): Promise<PaginatedResponse<Unit>> {
    const { page, limit, search, type } = query;
    const where: FindOptionsWhere<Unit> = {};
    if (type !== undefined) {
      where.type = type;
    }
    if (search) {
      where.name = ILike(`%${search}%`);
    }

    const [units, total] = await this.unitsRepository.findAndCount({
      where,
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: units,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Internal lookup used by IngredientsService to validate a unit id. */
  async findOne(id: number): Promise<Unit> {
    const unit = await this.unitsRepository.findOne({ where: { id } });
    if (!unit) {
      throw new NotFoundException(`Unit ${id} not found`);
    }
    return unit;
  }

  async create(dto: CreateUnitDto): Promise<Unit> {
    const unit = this.unitsRepository.create({
      name: dto.name,
      shortName: dto.shortName,
      type: dto.type ?? 'quantity',
      isBase: dto.isBase ?? false,
    });

    try {
      return await this.unitsRepository.save(unit);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          `Unit "${dto.shortName}" already exists for type "${dto.type ?? 'quantity'}"`,
        );
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateUnitDto): Promise<Unit> {
    const unit = await this.findOne(id);

    Object.assign(unit, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.shortName !== undefined && { shortName: dto.shortName }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.isBase !== undefined && { isBase: dto.isBase }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });

    try {
      return await this.unitsRepository.save(unit);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          `Unit "${unit.shortName}" already exists for type "${unit.type}"`,
        );
      }
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.unitsRepository.softDelete(id);
  }

  // ------------------------------------------------------------ conversions

  async listConversions(fromUnitId: number): Promise<UnitConversion[]> {
    await this.findOne(fromUnitId);
    return this.unitConversionsRepository.find({ where: { fromUnitId } });
  }

  async addConversion(
    fromUnitId: number,
    dto: CreateUnitConversionDto,
  ): Promise<UnitConversion> {
    await this.findOne(fromUnitId);
    await this.findOne(dto.toUnitId);

    try {
      return await this.unitConversionsRepository.save(
        this.unitConversionsRepository.create({
          fromUnitId,
          toUnitId: dto.toUnitId,
          multiplier: dto.multiplier,
          isActive: dto.isActive ?? true,
        }),
      );
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          `A conversion from unit ${fromUnitId} to unit ${dto.toUnitId} already exists`,
        );
      }
      throw error;
    }
  }

  async removeConversion(id: number): Promise<void> {
    const conversion = await this.unitConversionsRepository.findOne({
      where: { id },
    });
    if (!conversion) {
      throw new NotFoundException(`Unit conversion ${id} not found`);
    }
    await this.unitConversionsRepository.delete(id);
  }
}
