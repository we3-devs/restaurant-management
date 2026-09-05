import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, IsNull, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { generateDocumentNumber } from '../../common/utils/document-number.util';
import { UserRoleAssignment } from '../roles/entities/user-role-assignment.entity';
import { User } from '../users/entities/user.entity';
import { Position } from './entities/position.entity';
import { Employee } from './entities/employee.entity';
import { EmployeeDepartmentAssignment } from './entities/employee-department-assignment.entity';
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
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(EmployeeDepartmentAssignment)
    private readonly departmentAssignments: Repository<EmployeeDepartmentAssignment>,
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
    const position = await this.positionRepo.findOne({
      where: { id: employee.positionId },
      relations: ['defaultRole'],
    });
    if (!position?.defaultRoleId) return;

    const isGlobal = position.defaultRole?.level === 'global';
    const outletId = isGlobal ? null : employee.outletId;

    const existing = await this.userRoleAssignmentRepo.findOne({
      where: {
        userId: employee.userId,
        roleId: position.defaultRoleId,
        scopeType: isGlobal ? 'global' : 'outlet',
        outletId: outletId ?? IsNull(),
        outletDepartmentId: IsNull(),
        warehouseId: IsNull(),
      },
    });
    if (existing) return;

    await this.userRoleAssignmentRepo.save(
      this.userRoleAssignmentRepo.create({
        userId: employee.userId,
        roleId: position.defaultRoleId,
        scopeType: isGlobal ? 'global' : 'outlet',
        outletId,
        outletDepartmentId: null,
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
        relations: ['position', 'user'],
        order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit,
      });
      return {
        data: data.map((e) => this.toResponse(e)),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      };
    }
    const [data, total] = await this.employeeRepo.findAndCount({
      where,
      relations: ['position', 'user'],
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
    const e = await this.employeeRepo.findOne({ where: { id }, relations: ['position', 'position.defaultRole', 'user'] });
    if (!e) throw new NotFoundException(`Employee ${id} not found`); return e;
  }

  async findOneResponse(id: number): Promise<EmployeeResponseDto> {
    return this.toResponse(await this.findOne(id));
  }

  async create(dto: CreateEmployeeDto, createdBy: number): Promise<EmployeeResponseDto> {
    await this.syncIdentityToUser(dto.userId, dto.name, dto.email, dto.phone);
    const employee = await this.employeeRepo.save(this.employeeRepo.create({
      ...dto, employeeCode: generateDocumentNumber('EMP', dto.outletId), createdBy,
    }));
    await this.syncRoleFromPosition(employee);
    return this.toResponse(await this.findOne(employee.id));
  }

  async update(id: number, dto: UpdateEmployeeDto): Promise<EmployeeResponseDto> {
    const e = await this.findOne(id);
    await this.syncIdentityToUser(dto.userId !== undefined ? dto.userId : e.userId, dto.name, dto.email, dto.phone);
    Object.assign(e, dto);
    const saved = await this.employeeRepo.save(e);
    await this.syncRoleFromPosition(saved);
    return this.toResponse(await this.findOne(saved.id));
  }

  async remove(id: number): Promise<void> {
    const e = await this.findOne(id); await this.employeeRepo.remove(e);
  }

  private toResponse(employee: Employee): EmployeeResponseDto {
    const identity = employee.user ?? employee;
    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      userId: employee.userId,
      positionId: employee.positionId,
      positionName: employee.position?.name ?? null,
      outletId: employee.outletId,
      // Kept as a compatibility field until the frontend consumes the
      // employee departments endpoint; assignments are now many-to-many.
      departmentId: null,
      name: identity.name,
      email: identity.email,
      phone: identity.phone,
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

  async listDepartments(employeeId: number) {
    await this.findOne(employeeId);
    return this.departmentAssignments.find({
      where: { employeeId },
      relations: { department: true },
      order: { createdAt: 'ASC' },
    });
  }

  async assignDepartment(employeeId: number, departmentId: number, assignedBy: number) {
    const employee = await this.findOne(employeeId);
    const department = await this.employeeRepo.manager.getRepository('outlet_departments').findOne({
      where: { id: departmentId },
    }) as { id: number; outlet_id?: number; outletId?: number } | null;
    if (!department) throw new NotFoundException(`Department ${departmentId} not found`);
    const departmentOutletId = Number(department.outletId ?? department.outlet_id);
    if (departmentOutletId !== employee.outletId) {
      throw new NotFoundException('Department does not belong to this employee\'s outlet');
    }
    const existing = await this.departmentAssignments.findOne({ where: { employeeId, departmentId } });
    if (existing) return existing;
    return this.departmentAssignments.save(
      this.departmentAssignments.create({ employeeId, departmentId, assignedBy }),
    );
  }

  async removeDepartment(employeeId: number, departmentId: number) {
    await this.findOne(employeeId);
    await this.departmentAssignments.delete({ employeeId, departmentId });
  }

  /** Users are the canonical identity record for linked employees. */
  private async syncIdentityToUser(userId: number | null | undefined, name?: string, email?: string, phone?: string): Promise<void> {
    if (!userId) return;
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (name !== undefined) user.name = name;
    if (email !== undefined && email !== '') user.email = email;
    if (phone !== undefined) user.phone = phone || null;
    await this.userRepo.save(user);
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
