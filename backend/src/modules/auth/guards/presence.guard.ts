import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { Attendance } from '../../attendance/entities/attendance.entity';
import { ALLOW_WITHOUT_PRESENCE } from '../decorators/allow-without-presence.decorator';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { PermissionsService } from '../permissions.service';

@Injectable()
export class PresenceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Attendance) private readonly attendanceRepo: Repository<Attendance>,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_WITHOUT_PRESENCE, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user || user.isSuperadmin) return true;
    if ((await this.permissionsService.getRoleSlugs(user.id)).includes('admin')) return true;
    if (!this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()])?.length) return true;
    if (!user.tenantId) return true;
    const [tenant] = await this.attendanceRepo.manager.query(
      'SELECT attendance_required FROM tenants WHERE id = $1',
      [user.tenantId],
    ) as Array<{ attendance_required: boolean }>;
    if (!tenant?.attendance_required) return true;
    const present = await this.attendanceRepo.createQueryBuilder('attendance')
      .innerJoin('attendance.employee', 'employee')
      .where('employee.user_id = :userId', { userId: user.id })
      .andWhere('attendance.clock_out IS NULL')
      .andWhere("attendance.status IN ('present', 'late')")
      .getExists();
    if (!present) throw new ForbiddenException('Clock in by scanning the attendance QR code before accessing work modules');
    return true;
  }
}
