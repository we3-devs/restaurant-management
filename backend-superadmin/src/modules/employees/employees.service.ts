import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, IsNull, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { generateDocumentNumber } from '../../common/utils/document-number.util';
import { UserRoleAssignment } from '../roles/entities/user-role-assignment.entity';
import { User } from '../users/entities/user.entity';
import { Outlet } from '../outlets/entities/outlet.entity';
import { Position } from './entities/position.entity';
import { Employee } from './entities/employee.entity';
import { EmployeeDepartmentAssignment } from './entities/employee-department-assignment.entity';
import { EmployeeOutletAssignment } from './entities/employee-outlet-assignment.entity';
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
    @InjectRepository(EmployeeOutletAssignment)
    private readonly outletAssignments: Repository<EmployeeOutletAssignment>,
  ) {}

  // ---- Positions ----
  async findAllPositions(tenantId?: number): Promise<PositionResponseDto[]> {
    const positions = await this.positionRepo.find({ where: { isActive: true, ...(tenantId !== undefined ? { tenantId } : {}) }, order: { name: 'ASC' }, relations: ['defaultRole'] });
    return positions.map((p) => this.toPositionResponse(p));
  }
  async findPosition(id: number): Promise<Position> {
    const p = await this.positionRepo.findOne({ where: { id }, relations: ['defaultRole'] }); if (!p) throw new NotFoundException(`Position ${id} not found`); return p;
  }
  async findPositionResponse(id: number): Promise<PositionResponseDto> {
    return this.toPositionResponse(await this.findPosition(id));
  }
  async createPosition(dto: CreatePositionDto, tenantId?: number): Promise<PositionResponseDto> {
    const saved = await this.positionRepo.save(this.positionRepo.create({ ...dto, tenantId: tenantId ?? null }));
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
    if (!employee.userId) return;

    // Roles are derived exclusively from the employee's position. Remove any
    // previous direct/position-derived assignments before applying the current
    // position, so changing position cannot leave stale access behind.
    await this.userRoleAssignmentRepo.update(
      { userId: employee.userId, isActive: true },
      { isActive: false },
    );

    if (!employee.positionId) return;
    const position = await this.positionRepo.findOne({
      where: { id: employee.positionId },
      relations: ['defaultRole'],
    });
    if (!position?.defaultRoleId) return;

    const isGlobal = position.defaultRole?.level === 'global';
    const outletIds = isGlobal ? [null] : await this.getOutletIds(employee.id);
    for (const outletId of outletIds) {
      const existing = await this.userRoleAssignmentRepo.findOne({ where: { userId: employee.userId, roleId: position.defaultRoleId, scopeType: isGlobal ? 'global' : 'outlet', outletId: outletId ?? IsNull(), outletDepartmentId: IsNull(), warehouseId: IsNull() } });
      if (!existing) await this.userRoleAssignmentRepo.save(this.userRoleAssignmentRepo.create({ userId: employee.userId, roleId: position.defaultRoleId, scopeType: isGlobal ? 'global' : 'outlet', outletId, outletDepartmentId: null }));
    }
  }

  // ---- Employees ----
  async findAll(
    query: ListEmployeesQueryDto,
    accessibleOutletIds: number[] | 'ALL' = 'ALL',
    tenantId?: number,
  ): Promise<PaginatedResponse<EmployeeResponseDto>> {
    const { page, limit, search, outletId, positionId, employmentStatus } = query;
    const qb = this.employeeRepo.createQueryBuilder('employee')
      .leftJoinAndSelect('employee.position', 'position')
      .leftJoinAndSelect('employee.user', 'user');
    if (outletId !== undefined) qb.innerJoin('employee_outlet_assignments', 'employee_filter_outlet', 'employee_filter_outlet.employee_id = employee.id AND employee_filter_outlet.outlet_id = :outletId AND employee_filter_outlet.is_active = true', { outletId });
    else if (accessibleOutletIds !== 'ALL') qb.innerJoin('employee_outlet_assignments', 'employee_filter_outlet', 'employee_filter_outlet.employee_id = employee.id AND employee_filter_outlet.outlet_id IN (:...accessibleOutletIds) AND employee_filter_outlet.is_active = true', { accessibleOutletIds: accessibleOutletIds.length ? accessibleOutletIds : [0] });
    if (tenantId !== undefined) qb.andWhere('EXISTS (SELECT 1 FROM employee_outlet_assignments employee_tenant_assignment INNER JOIN outlets employee_tenant_outlet ON employee_tenant_outlet.id = employee_tenant_assignment.outlet_id WHERE employee_tenant_assignment.employee_id = employee.id AND employee_tenant_assignment.is_active = true AND employee_tenant_outlet.tenant_id = :employeeTenantId)', { employeeTenantId: tenantId });
    if (positionId) qb.andWhere('employee.position_id = :positionId', { positionId });
    if (employmentStatus) qb.andWhere('employee.employment_status = :employmentStatus', { employmentStatus });
    if (search) qb.andWhere('(employee.name ILIKE :search OR employee.employee_code ILIKE :search OR employee.email ILIKE :search)', { search: `%${search}%` });
    qb.orderBy('employee.created_at', 'DESC').skip((page - 1) * limit).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return {
      data: await Promise.all(data.map((e) => this.toResponse(e))),
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
    await this.syncUserTenantToOutlet(dto.userId, dto.outletId);
    await this.syncIdentityToUser(dto.userId, dto.name, dto.email, dto.phone);
    const { outletId, ...employeeInput } = dto;
    const employee = await this.employeeRepo.save(this.employeeRepo.create({
      ...employeeInput, employeeCode: generateDocumentNumber('EMP', outletId), createdBy,
    }));
    await this.assignOutlet(employee.id, outletId, createdBy);
    return this.toResponse(await this.findOne(employee.id));
  }

  async update(id: number, dto: UpdateEmployeeDto): Promise<EmployeeResponseDto> {
    const e = await this.findOne(id);
    if (dto.outletId !== undefined) await this.syncUserTenantToOutlet(dto.userId !== undefined ? dto.userId : e.userId, dto.outletId);
    await this.syncIdentityToUser(dto.userId !== undefined ? dto.userId : e.userId, dto.name, dto.email, dto.phone);
    const { outletId, ...employeeInput } = dto;
    Object.assign(e, employeeInput);
    const saved = await this.employeeRepo.save(e);
    if (outletId !== undefined) await this.assignOutlet(saved.id, outletId, 0);
    return this.toResponse(await this.findOne(saved.id));
  }

  async remove(id: number): Promise<void> {
    const e = await this.findOne(id); await this.employeeRepo.remove(e);
  }

  async listOutlets(employeeId: number) {
    await this.findOne(employeeId);
    return this.outletAssignments.find({ where: { employeeId, isActive: true }, relations: { outlet: true }, order: { createdAt: 'ASC' } });
  }

  async assignOutlet(employeeId: number, outletId: number, assignedBy: number) {
    const employee = await this.findOne(employeeId);
    const outlet = await this.employeeRepo.manager.getRepository(Outlet).findOne({ where: { id: outletId, tenantId: employee.user?.tenantId ?? undefined } });
    if (!outlet) throw new NotFoundException(`Outlet ${outletId} not found in the employee's tenant`);
    const existing = await this.outletAssignments.findOne({ where: { employeeId, outletId } });
    if (existing) { existing.isActive = true; existing.assignedBy = assignedBy; return this.outletAssignments.save(existing); }
    return this.outletAssignments.save(this.outletAssignments.create({ employeeId, outletId, assignedBy, isActive: true }));
  }

  async removeOutlet(employeeId: number, outletId: number) {
    const employee = await this.findOne(employeeId);
    if ((await this.getOutletIds(employeeId)).length <= 1) throw new ConflictException('An employee must retain at least one outlet');
    await this.outletAssignments.update({ employeeId, outletId }, { isActive: false });
  }

  async getOutletIds(employeeId: number): Promise<number[]> {
    const rows = await this.outletAssignments.find({ where: { employeeId, isActive: true }, select: { outletId: true }, order: { createdAt: 'ASC' } });
    return rows.map((row) => row.outletId);
  }

  private async toResponse(employee: Employee): Promise<EmployeeResponseDto> {
    const identity = employee.user ?? employee;
    const outletIds = await this.getOutletIds(employee.id);
    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      userId: employee.userId,
      positionId: employee.positionId,
      positionName: employee.position?.name ?? null,
      outletIds,
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
    if (!(await this.getOutletIds(employeeId)).includes(departmentOutletId)) {
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

  /** Keep a linked non-superadmin login inside the tenant that owns its outlet. */
  private async syncUserTenantToOutlet(userId: number | null | undefined, outletId: number): Promise<void> {
    if (!userId) return;
    const [user, outlet] = await Promise.all([
      this.userRepo.findOne({ where: { id: userId } }),
      this.employeeRepo.manager.getRepository(Outlet).findOne({ where: { id: outletId } }),
    ]);
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (!outlet) throw new NotFoundException(`Outlet ${outletId} not found`);
    if (!user.isSuperadmin && user.tenantId !== outlet.tenantId) {
      user.tenantId = outlet.tenantId;
      await this.userRepo.save(user);
    }
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
