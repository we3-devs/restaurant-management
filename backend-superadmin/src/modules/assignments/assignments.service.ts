import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { OrderAssignment } from './entities/order-assignment.entity';
import { TableAssignment } from './entities/table-assignment.entity';
import { AssignOrderDto, AssignTableDto, CompleteOrderAssignmentDto } from './dto/assignments.dto';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(TableAssignment) private readonly tableRepo: Repository<TableAssignment>,
    @InjectRepository(OrderAssignment) private readonly orderRepo: Repository<OrderAssignment>,
  ) {}

  // ---- Table assignments ----
  async assignTable(dto: AssignTableDto, createdBy: number): Promise<TableAssignment> {
    return this.tableRepo.save(this.tableRepo.create({ ...dto, createdBy }));
  }

  /** Internal lookup used by the controller to assert outlet access before mutating. */
  async findTableAssignment(id: number): Promise<TableAssignment> {
    const a = await this.tableRepo.findOne({ where: { id } });
    if (!a) throw new NotFoundException(`Table assignment ${id} not found`);
    return a;
  }

  async unassignTable(id: number): Promise<TableAssignment> {
    const a = await this.findTableAssignment(id);
    a.isActive = false;
    a.unassignedAt = new Date();
    return this.tableRepo.save(a);
  }

  async listTableAssignments(
    outletId?: number,
    accessibleOutletIds: number[] | 'ALL' = 'ALL',
  ): Promise<TableAssignment[]> {
    const where: any = { isActive: true };
    if (outletId) where.outletId = outletId;
    else if (accessibleOutletIds !== 'ALL') where.outletId = In(accessibleOutletIds);
    return this.tableRepo.find({ where, relations: ['employee', 'diningTable', 'session'], order: { assignedAt: 'DESC' } });
  }

  // ---- Order assignments ----
  async assignOrder(dto: AssignOrderDto, createdBy: number): Promise<OrderAssignment> {
    return this.orderRepo.save(this.orderRepo.create({ ...dto, createdBy }));
  }

  /** Internal lookup used by the controller to assert outlet access before mutating. */
  async findOrderAssignment(id: number): Promise<OrderAssignment> {
    const a = await this.orderRepo.findOne({ where: { id } });
    if (!a) throw new NotFoundException(`Order assignment ${id} not found`);
    return a;
  }

  async completeOrder(id: number, dto: CompleteOrderAssignmentDto): Promise<OrderAssignment> {
    const a = await this.findOrderAssignment(id);
    a.completedAt = dto.completedAt ? new Date(dto.completedAt) : new Date();
    a.isActive = false;
    return this.orderRepo.save(a);
  }

  async markServed(id: number): Promise<OrderAssignment> {
    const a = await this.findOrderAssignment(id);
    a.servedAt = new Date();
    return this.orderRepo.save(a);
  }

  async listOrderAssignments(
    outletId?: number,
    accessibleOutletIds: number[] | 'ALL' = 'ALL',
  ): Promise<OrderAssignment[]> {
    const where: any = { isActive: true };
    if (outletId) where.outletId = outletId;
    else if (accessibleOutletIds !== 'ALL') where.outletId = In(accessibleOutletIds);
    return this.orderRepo.find({ where, relations: ['employee', 'order'], order: { assignedAt: 'DESC' } });
  }

  // ---- Staff dashboard ----
  async getStaffDashboard(
    outletId?: number,
    accessibleOutletIds: number[] | 'ALL' = 'ALL',
  ): Promise<Record<string, unknown>> {
    const manager = this.orderRepo.manager;

    const presentQb = manager.createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('attendance', 'a')
      .where('a.clock_out IS NULL')
      .andWhere('a.clock_in::date = CURRENT_DATE');
    const absentQb = manager.createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('attendance', 'a')
      .where('a.clock_in::date = CURRENT_DATE');
    const lateQb = manager.createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('attendance', 'a')
      .where('a.is_late = true')
      .andWhere('a.clock_in::date = CURRENT_DATE');
    if (outletId) {
      presentQb.andWhere('a.outlet_id = :outletId', { outletId });
      absentQb.andWhere('a.outlet_id = :outletId', { outletId });
      lateQb.andWhere('a.outlet_id = :outletId', { outletId });
    } else if (accessibleOutletIds !== 'ALL') {
      presentQb.andWhere('a.outlet_id IN (:...accessibleOutletIds)', { accessibleOutletIds });
      absentQb.andWhere('a.outlet_id IN (:...accessibleOutletIds)', { accessibleOutletIds });
      lateQb.andWhere('a.outlet_id IN (:...accessibleOutletIds)', { accessibleOutletIds });
    }

    const [present, absent, late, tables, orders] = await Promise.all([
      presentQb.getRawOne<{ count: string }>(),
      absentQb.getRawOne<{ count: string }>(),
      lateQb.getRawOne<{ count: string }>(),
      this.listTableAssignments(outletId, accessibleOutletIds),
      this.listOrderAssignments(outletId, accessibleOutletIds),
    ]);

    return {
      presentToday: Number(present?.count ?? 0),
      absentToday: Number(absent?.count ?? 0),
      lateToday: Number(late?.count ?? 0),
      onShiftCount: Number(present?.count ?? 0),
      tablesAssigned: tables.length,
      ordersAssigned: orders.length,
      recentTableAssignments: tables.slice(0, 10),
      recentOrderAssignments: orders.slice(0, 10),
    };
  }

  async getPerformance(employeeId: number, dateFrom?: string, dateTo?: string): Promise<Record<string, unknown>> {
    const manager = this.orderRepo.manager;
    const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60_000);
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : new Date();

    const [orderStats, attendanceRows, workingHours] = await Promise.all([
      manager.createQueryBuilder()
        .select('COUNT(*)', 'ordersServed')
        .addSelect('COALESCE(SUM("order".grand_total), 0)', 'salesGenerated')
        .from('order_assignments', 'oa')
        .innerJoin('orders', 'order', '"order".id = oa.order_id')
        .where('oa.employee_id = :employeeId', { employeeId })
        .andWhere('oa.assigned_at BETWEEN :from AND :to', { from, to })
        .getRawOne<{ ordersServed: string; salesGenerated: string }>(),
      manager.createQueryBuilder()
        .select('COUNT(*)', 'total')
        .addSelect('COUNT(*) FILTER (WHERE status = :late)', 'lateCount')
        .from('attendance', 'a')
        .where('a.employee_id = :employeeId', { employeeId })
        .andWhere('a.clock_in BETWEEN :from AND :to', { from, to })
        .setParameter('late', 'late')
        .getRawOne<{ total: string; lateCount: string }>(),
      manager.createQueryBuilder()
        .select('COALESCE(SUM(working_hours), 0)', 'hours')
        .from('attendance', 'a')
        .where('a.employee_id = :employeeId', { employeeId })
        .andWhere('a.clock_in BETWEEN :from AND :to', { from, to })
        .getRawOne<{ hours: string }>(),
    ]);

    const totalDays = Number(attendanceRows?.total ?? 0);
    return {
      employeeId,
      ordersServed: Number(orderStats?.ordersServed ?? 0),
      salesGenerated: Number(orderStats?.salesGenerated ?? 0),
      tablesServed: 0,
      averageServiceMinutes: 0,
      workingHours: Number(workingHours?.hours ?? 0),
      attendancePercent: totalDays > 0 ? 100 : 0,
      lateCount: Number(attendanceRows?.lateCount ?? 0),
      totalAttendanceDays: totalDays,
    };
  }
}

