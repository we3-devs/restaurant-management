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
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { User } from './entities/user.entity';
import { Employee } from '../employees/entities/employee.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    private readonly configService: ConfigService<AppConfig>,
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
  ) {}

  async findAll(
    query: ListUsersQueryDto,
    tenantId?: number,
  ): Promise<PaginatedResponse<UserResponseDto>> {
    const { page, limit, search } = query;
    const [users, total] = await this.usersRepository.findAndCount({
      // Superadmin accounts are control-plane accounts and must not appear in
      // the ordinary staff user directory.
      where: search
        ? [
            {
              isSuperadmin: false,
              name: ILike(`%${search}%`),
              ...(tenantId !== undefined ? { tenantId } : {}),
            },
            {
              isSuperadmin: false,
              email: ILike(`%${search}%`),
              ...(tenantId !== undefined ? { tenantId } : {}),
            },
          ]
        : {
            isSuperadmin: false,
            ...(tenantId !== undefined ? { tenantId } : {}),
          },
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
    const employeeByUserId = new Map(
      employees.map((employee) => [employee.userId, employee]),
    );

    return {
      data: users.map((user) =>
        this.toResponse(
          user,
          activeUserIds.has(user.id),
          employeeByUserId.get(user.id),
        ),
      ),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findOne(id: number, tenantId?: number): Promise<UserResponseDto> {
    const user = await this.getUserOrThrow(id, tenantId);
    const activeUserIds = await this.getActiveUserIds([id]);
    const employee = await this.employeesRepository.findOne({
      where: { userId: id },
    });
    return this.toResponse(user, activeUserIds.has(id), employee ?? undefined);
  }

  async create(dto: CreateUserDto, tenantId: number): Promise<UserResponseDto> {
    const saltRounds = this.configService.get('bcrypt', {
      infer: true,
    })!.saltRounds;
    const password = await bcrypt.hash(dto.password, saltRounds);

    const user = this.usersRepository.create({
      name: dto.name,
      email: dto.email,
      password,
      isSuperadmin: false,
      tenantId,
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

  async update(
    id: number,
    dto: UpdateUserDto,
    tenantId?: number,
  ): Promise<UserResponseDto> {
    const user = await this.getUserOrThrow(id, tenantId);
    Object.assign(user, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.phone !== undefined && { phone: dto.phone || null }),
    });

    try {
      const saved = await this.usersRepository.save(user);
      await this.syncLinkedEmployees(saved);
      const activeUserIds = await this.getActiveUserIds([id]);
      const employee = await this.employeesRepository.findOne({
        where: { userId: id },
      });
      return this.toResponse(
        saved,
        activeUserIds.has(id),
        employee ?? undefined,
      );
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

  async resetPassword(
    id: number,
    newPassword: string,
    tenantId?: number,
  ): Promise<void> {
    const user = await this.getUserOrThrowWithPassword(id, tenantId);
    const saltRounds = this.configService.get('bcrypt', {
      infer: true,
    })!.saltRounds;
    user.password = await bcrypt.hash(newPassword, saltRounds);
    await this.usersRepository.save(user);
    // A reset password means every existing login must sign in again.
    await this.signOutEverywhere(id);
  }

  /** Deactivating a user disables the linked employee account and ends every session it has. */
  async deactivate(id: number, tenantId?: number): Promise<void> {
    await this.getUserOrThrow(id, tenantId);
    await this.employeesRepository.update(
      { userId: id, isActive: true },
      { isActive: false, employmentStatus: 'inactive' },
    );
    await this.signOutEverywhere(id);
  }

  /** Revokes all of the user's refresh tokens; each device is signed out once its current access token (at most 15 minutes) runs out. */
  private async signOutEverywhere(userId: number): Promise<void> {
    await this.employeesRepository.manager
      .getRepository(RefreshToken)
      .update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  private async getUserOrThrow(id: number, tenantId?: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id, ...(tenantId !== undefined ? { tenantId } : {}) },
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  private async getUserOrThrowWithPassword(
    id: number,
    tenantId?: number,
  ): Promise<User> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id })
      .andWhere(tenantId !== undefined ? 'user.tenant_id = :tenantId' : '1=1', {
        tenantId,
      })
      .getOne();
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  private async getActiveUserIds(userIds: number[]): Promise<Set<number>> {
    if (userIds.length === 0) {
      return new Set();
    }

    const rows = await this.employeesRepository.manager
      .createQueryBuilder()
      .select('DISTINCT employee.user_id', 'userId')
      .from('employees', 'employee')
      .innerJoin(
        'positions',
        'position',
        'position.id = employee.position_id AND position.is_active = true',
      )
      .where('employee.user_id IN (:...userIds)', { userIds })
      .andWhere('employee.is_active = true')
      .andWhere('employee.employment_status = :employmentStatus', {
        employmentStatus: 'active',
      })
      .getRawMany<{ userId: string }>();

    return new Set(rows.map((row) => parseInt(row.userId, 10)));
  }

  private toResponse(
    user: User,
    isActive: boolean,
    employee?: Employee,
  ): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      employeeId: employee?.id ?? null,
      outletId: null,
      // Department membership is now many-to-many. Keep this legacy response
      // field null until clients consume employee department assignments.
      departmentId: null,
      isSuperadmin: user.isSuperadmin,
      isActive: user.isSuperadmin || isActive,
      createdAt: user.createdAt,
    };
  }

  /** Keep legacy employee columns aligned; linked employee reads use User as their source of truth. */
  private async syncLinkedEmployees(user: User): Promise<void> {
    await this.employeesRepository
      .createQueryBuilder()
      .update(Employee)
      .set({ name: user.name, email: user.email, phone: user.phone })
      .where('user_id = :userId', { userId: user.id })
      .execute();
  }
}
