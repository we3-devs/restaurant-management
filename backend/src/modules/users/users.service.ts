import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { ILike, In, IsNull, QueryFailedError, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { AppConfig } from '../../config/configuration';
import { UserRoleAssignment } from '../roles/entities/user-role-assignment.entity';
import { RolesService } from '../roles/roles.service';
import { CreateRoleAssignmentDto } from './dto/create-role-assignment.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { RoleAssignmentResponseDto } from './dto/role-assignment-response.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { User } from './entities/user.entity';
import { Employee } from '../employees/entities/employee.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @InjectRepository(UserRoleAssignment)
    private readonly assignmentsRepository: Repository<UserRoleAssignment>,
    private readonly rolesService: RolesService,
    private readonly configService: ConfigService<AppConfig>,
    @InjectRepository(Employee) private readonly employeesRepository: Repository<Employee>,
  ) {}

  async findAll(
    query: ListUsersQueryDto,
  ): Promise<PaginatedResponse<UserResponseDto>> {
    const { page, limit, search } = query;
    const [users, total] = await this.usersRepository.findAndCount({
      // Superadmin accounts are control-plane accounts and must not appear in
      // the ordinary staff user directory.
      where: search
        ? [
            { isSuperadmin: false, name: ILike(`%${search}%`) },
            { isSuperadmin: false, email: ILike(`%${search}%`) },
          ]
        : { isSuperadmin: false },
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const activeUserIds = await this.getActiveUserIds(
      users.map((user) => user.id),
    );
    const employees = await this.employeesRepository.find({
      where: { userId: In(users.map((user) => user.id)) },
    });
    const employeeByUserId = new Map(employees.map((employee) => [employee.userId, employee]));

    return {
      data: users.map((user) =>
        this.toResponse(user, activeUserIds.has(user.id), employeeByUserId.get(user.id)),
      ),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findOne(id: number): Promise<UserResponseDto> {
    const user = await this.getUserOrThrow(id);
    const activeUserIds = await this.getActiveUserIds([id]);
    const employee = await this.employeesRepository.findOne({ where: { userId: id } });
    return this.toResponse(user, activeUserIds.has(id), employee ?? undefined);
  }

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const saltRounds = this.configService.get('bcrypt', {
      infer: true,
    })!.saltRounds;
    const password = await bcrypt.hash(dto.password, saltRounds);

    const user = this.usersRepository.create({
      name: dto.name,
      email: dto.email,
      password,
      isSuperadmin: false,
    });

    try {
      const saved = await this.usersRepository.save(user);
      await this.syncLinkedEmployees(saved);
      return this.toResponse(saved, false);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(`Email "${dto.email}" is already in use`);
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.getUserOrThrow(id);
    Object.assign(user, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.phone !== undefined && { phone: dto.phone || null }),
    });

    try {
      const saved = await this.usersRepository.save(user);
      await this.syncLinkedEmployees(saved);
      const activeUserIds = await this.getActiveUserIds([id]);
      const employee = await this.employeesRepository.findOne({ where: { userId: id } });
      return this.toResponse(saved, activeUserIds.has(id), employee ?? undefined);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(`Email "${dto.email}" is already in use`);
      }
      throw error;
    }
  }

  async resetPassword(id: number, newPassword: string): Promise<void> {
    const user = await this.getUserOrThrowWithPassword(id);
    const saltRounds = this.configService.get('bcrypt', { infer: true })!.saltRounds;
    user.password = await bcrypt.hash(newPassword, saltRounds);
    await this.usersRepository.save(user);
  }

  async setSuperadmin(id: number, isSuperadmin: boolean): Promise<UserResponseDto> {
    const user = await this.getUserOrThrow(id);
    user.isSuperadmin = isSuperadmin;
    const saved = await this.usersRepository.save(user);
    const activeUserIds = await this.getActiveUserIds([id]);
    const employee = await this.employeesRepository.findOne({ where: { userId: id } });
    return this.toResponse(saved, activeUserIds.has(id), employee ?? undefined);
  }

  /**
   * "Deactivating" a user means revoking every one of their role
   * assignments — `users` has no is_active/deleted_at column, so this is
   * how PermissionsGuard ends up denying them everything. Login stays
   * possible; that's a deliberate trade-off, not a gap.
   */
  async deactivate(id: number): Promise<void> {
    await this.getUserOrThrow(id);
    await this.assignmentsRepository.update(
      { userId: id, isActive: true },
      { isActive: false },
    );
  }

  async listRoleAssignments(
    userId: number,
  ): Promise<RoleAssignmentResponseDto[]> {
    await this.getUserOrThrow(userId);
    const assignments = await this.assignmentsRepository.find({
      where: { userId },
      relations: { role: true },
      order: { createdAt: 'DESC' },
    });

    return assignments.map((assignment) => ({
      id: assignment.id,
      roleId: assignment.roleId,
      roleName: assignment.role.name,
      roleSlug: assignment.role.slug,
      scopeType: assignment.scopeType,
      isActive: assignment.isActive,
      createdAt: assignment.createdAt,
    }));
  }

  /** Find-or-reactivate: re-assigning an already-assigned (possibly revoked) role updates the existing row instead of duplicating it. */
  async assignRole(
    userId: number,
    dto: CreateRoleAssignmentDto,
  ): Promise<void> {
    await this.getUserOrThrow(userId);
    await this.rolesService.findOne(dto.roleId); // validates roleId, 404s if missing

    const existing = await this.assignmentsRepository.findOne({
      where: {
        userId,
        roleId: dto.roleId,
        scopeType: 'global',
        outletId: IsNull(),
        outletDepartmentId: IsNull(),
        warehouseId: IsNull(),
      },
    });

    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        await this.assignmentsRepository.save(existing);
      }
      return;
    }

    await this.assignmentsRepository.save(
      this.assignmentsRepository.create({
        userId,
        roleId: dto.roleId,
        scopeType: 'global',
        isActive: true,
      }),
    );
  }

  async revokeRoleAssignment(
    userId: number,
    assignmentId: number,
  ): Promise<void> {
    const assignment = await this.assignmentsRepository.findOne({
      where: { id: assignmentId, userId },
    });
    if (!assignment) {
      throw new NotFoundException(
        `Role assignment ${assignmentId} not found for user ${userId}`,
      );
    }
    assignment.isActive = false;
    await this.assignmentsRepository.save(assignment);
  }

  private async getUserOrThrow(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  private async getUserOrThrowWithPassword(id: number): Promise<User> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id })
      .getOne();
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  private async getActiveUserIds(userIds: number[]): Promise<Set<number>> {
    if (userIds.length === 0) {
      return new Set();
    }

    const rows = await this.assignmentsRepository.manager
      .createQueryBuilder()
      .select('DISTINCT ura.user_id', 'userId')
      .from('user_role_assignments', 'ura')
      .where('ura.user_id IN (:...userIds)', { userIds })
      .andWhere('ura.is_active = true')
      .andWhere('(ura.starts_at IS NULL OR ura.starts_at <= now())')
      .andWhere('(ura.ends_at IS NULL OR ura.ends_at > now())')
      .getRawMany<{ userId: string }>();

    return new Set(rows.map((row) => parseInt(row.userId, 10)));
  }

  private toResponse(user: User, isActive: boolean, employee?: Employee): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      employeeId: employee?.id ?? null,
      outletId: employee?.outletId ?? null,
      // Department membership is now many-to-many. Keep this legacy response
      // field null until clients consume employee department assignments.
      departmentId: null,
      isSuperadmin: user.isSuperadmin,
      isActive,
      createdAt: user.createdAt,
    };
  }

  /** Keep legacy employee columns aligned; linked employee reads use User as their source of truth. */
  private async syncLinkedEmployees(user: User): Promise<void> {
    await this.employeesRepository.createQueryBuilder().update(Employee)
      .set({ name: user.name, email: user.email, phone: user.phone })
      .where('user_id = :userId', { userId: user.id }).execute();
  }
}
