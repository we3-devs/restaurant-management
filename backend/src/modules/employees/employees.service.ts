import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { generateDocumentNumber } from '../../common/utils/document-number.util';
import { Position } from './entities/position.entity';
import { Employee } from './entities/employee.entity';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';
import { CreatePositionDto, UpdatePositionDto } from './dto/create-position.dto';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee) private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(Position) private readonly positionRepo: Repository<Position>,
  ) {}

  // ---- Positions ----
  async findAllPositions(): Promise<Position[]> {
    return this.positionRepo.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }
  async findPosition(id: number): Promise<Position> {
    const p = await this.positionRepo.findOne({ where: { id } }); if (!p) throw new NotFoundException(`Position ${id} not found`); return p;
  }
  async createPosition(dto: CreatePositionDto): Promise<Position> {
    return this.positionRepo.save(this.positionRepo.create(dto));
  }
  async updatePosition(id: number, dto: UpdatePositionDto): Promise<Position> {
    const p = await this.findPosition(id); Object.assign(p, dto); return this.positionRepo.save(p);
  }
  async removePosition(id: number): Promise<void> {
    await this.findPosition(id); await this.positionRepo.delete(id);
  }

  // ---- Employees ----
  async findAll(query: ListEmployeesQueryDto): Promise<PaginatedResponse<Employee>> {
    const { page, limit, search, outletId, positionId, employmentStatus } = query;
    const where: FindOptionsWhere<Employee> = {};
    if (outletId) where.outletId = outletId;
    if (positionId) where.positionId = positionId;
    if (employmentStatus) where.employmentStatus = employmentStatus;
    if (search) {
      const [data, total] = await this.employeeRepo.findAndCount({
        where: [
          { ...where, name: ILike(`%${search}%`) },
          { ...where, employeeCode: ILike(`%${search}%`) },
          { ...where, email: ILike(`%${search}%`) },
        ],
        order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit,
      });
      return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
    }
    const [data, total] = await this.employeeRepo.findAndCount({ where, order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit });
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async findOne(id: number): Promise<Employee> {
    const e = await this.employeeRepo.findOne({ where: { id }, relations: ['position'] });
    if (!e) throw new NotFoundException(`Employee ${id} not found`); return e;
  }

  async create(dto: CreateEmployeeDto, createdBy: number): Promise<Employee> {
    return this.employeeRepo.save(this.employeeRepo.create({
      ...dto, employeeCode: generateDocumentNumber('EMP', dto.outletId), createdBy,
    }));
  }

  async update(id: number, dto: UpdateEmployeeDto): Promise<Employee> {
    const e = await this.findOne(id); Object.assign(e, dto); return this.employeeRepo.save(e);
  }

  async remove(id: number): Promise<void> {
    const e = await this.findOne(id); await this.employeeRepo.remove(e);
  }
}
