import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { generateDocumentNumber } from '../../common/utils/document-number.util';
import { UserRoleAssignment } from '../roles/entities/user-role-assignment.entity';
import { Position } from './entities/position.entity';
import { Employee } from './entities/employee.entity';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';
import { CreatePositionDto, UpdatePositionDto } from './dto/create-position.dto';
import {
  EmployeeResponseDto,
  PositionResponseDto,
} from './dto/employee-response.dto';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee) private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(Position) private readonly positionRepo: Repository<Position>,
    @InjectRepository(UserRoleAssignment)
    private readonly userRoleAssignmentRepo: Repository<UserRoleAssignment>,
  ) {}

  // ---- Positions ----
  async findAllPositions(): Promise<PositionResponseDto[]> {
    const positions = await this.positionRepo.find({ where: { isActive: true }, order: { name: 'ASC' }, relations: ['defaultRole'] });
    return positions.map((p) => this.toPositionResponse(p));
  }
  async findPosition(id: number): Promise<Position> {
    const p = await this.positionRepo.findOne({ where: { id }, relations: ['defaultRole'] }); if (!p) throw new NotFoundException(`Position ${id} not found`); return p;
  }
  async findPositionResponse(id: number): Promise<PositionResponseDto> {
    return this.toPositionResponse(await this.findPosition(id));
  }
  async createPosition(dto: CreatePositionDto): Promise<PositionResponseDto> {
    const saved = await this.positionRepo.save(this.positionRepo.create(dto));
    return this.toPositionResponse(saved);
  }
  async updatePosition(id: number, dto: UpdatePositionDto): Promise<PositionResponseDto> {
    const p = await this.findPosition(id); Object.assign(p, dto);
    const saved = await this.positionRepo.save(p);
    return this.toPositionResponse(saved);
  }
  async removePosition(id: number): Promise<void> {
    await this.findPosition(id); await this.positionRepo.delete(id);
  }

  /**
   * Grants the position's default role to the employee's linked user account,
   * scoped to the employee's outlet. Only adds — never revokes a role the
   * employee already holds, since a user may accumulate roles beyond the one
   * implied by their position.
   */
  private async syncRoleFromPosition(employee: Employee): Promise<void> {
    if (!employee.userId || !employee.positionId) return;
    const position = await this.positionRepo.findOne({ where: { id: employee.positionId } });
    if (!position?.defaultRoleId) return;

    const existing = await this.userRoleAssignmentRepo.findOne({
      where: {
        userId: employee.userId,
        roleId: position.defaultRoleId,
        outletId: employee.outletId,
      },
    });
    if (existing) return;

    await this.userRoleAssignmentRepo.save(
      this.userRoleAssignmentRepo.create({
        userId: employee.userId,
        roleId: position.defaultRoleId,
        scopeType: 'outlet',
        outletId: employee.outletId,
      }),
    );
  }

  // ---- Employees ----
  async findAll(
    query: ListEmployeesQueryDto,
    accessibleOutletIds: number[] | 'ALL' = 'ALL',
  ): Promise<PaginatedResponse<EmployeeResponseDto>> {
    const { page, limit, search, outletId, positionId, employmentStatus } = query;
    const where: FindOptionsWhere<Employee> = {};
    if (outletId) where.outletId = outletId;
    else if (accessibleOutletIds !== 'ALL') where.outletId = In(accessibleOutletIds);
    if (positionId) where.positionId = positionId;
    if (employmentStatus) where.employmentStatus = employmentStatus;
    if (search) {
      const [data, total] = await this.employeeRepo.findAndCount({
        where: [
          { ...where, name: ILike(`%${search}%`) },
          { ...where, employeeCode: ILike(`%${search}%`) },
          { ...where, email: ILike(`%${search}%`) },
        ],
        relations: ['position'],
        order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit,
      });
      return {
        data: data.map((e) => this.toResponse(e)),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      };
    }
    const [data, total] = await this.employeeRepo.findAndCount({
      where,
      relations: ['position'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: data.map((e) => this.toResponse(e)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Internal lookup — returns the raw entity (with position/defaultRole loaded) for outlet-access checks and other services. */
  async findOne(id: number): Promise<Employee> {
    const e = await this.employeeRepo.findOne({ where: { id }, relations: ['position', 'position.defaultRole'] });
    if (!e) throw new NotFoundException(`Employee ${id} not found`); return e;
  }

  async findOneResponse(id: number): Promise<EmployeeResponseDto> {
    return this.toResponse(await this.findOne(id));
  }

  async create(dto: CreateEmployeeDto, createdBy: number): Promise<EmployeeResponseDto> {
    const employee = await this.employeeRepo.save(this.employeeRepo.create({
      ...dto, employeeCode: generateDocumentNumber('EMP', dto.outletId), createdBy,
    }));
    await this.syncRoleFromPosition(employee);
    return this.toResponse(await this.findOne(employee.id));
  }

  async update(id: number, dto: UpdateEmployeeDto): Promise<EmployeeResponseDto> {
    const e = await this.findOne(id); Object.assign(e, dto);
    const saved = await this.employeeRepo.save(e);
    await this.syncRoleFromPosition(saved);
    return this.toResponse(await this.findOne(saved.id));
  }

  async remove(id: number): Promise<void> {
    const e = await this.findOne(id); await this.employeeRepo.remove(e);
  }

  private toResponse(employee: Employee): EmployeeResponseDto {
    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      userId: employee.userId,
      positionId: employee.positionId,
      positionName: employee.position?.name ?? null,
      outletId: employee.outletId,
      departmentId: employee.departmentId,
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      photoUrl: employee.photoUrl,
      joiningDate: employee.joiningDate,
      employmentStatus: employee.employmentStatus,
      emergencyContactName: employee.emergencyContactName,
      emergencyContactPhone: employee.emergencyContactPhone,
      emergencyContactRelation: employee.emergencyContactRelation,
      isActive: employee.isActive,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };
  }

  private toPositionResponse(position: Position): PositionResponseDto {
    return {
      id: position.id,
      name: position.name,
      slug: position.slug,
      description: position.description,
      defaultRoleId: position.defaultRoleId,
      defaultRole: position.defaultRole
        ? {
            id: position.defaultRole.id,
            name: position.defaultRole.name,
            slug: position.defaultRole.slug,
            level: position.defaultRole.level,
          }
        : null,
      isActive: position.isActive,
      createdAt: position.createdAt,
      updatedAt: position.updatedAt,
    };
  }
}
