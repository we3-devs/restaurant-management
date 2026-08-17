import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Shift } from './entities/shift.entity';
import { ShiftAssignment } from './entities/shift-assignment.entity';
import { CreateShiftDto, UpdateShiftDto } from './dto/create-shift.dto';
import { AssignShiftDto } from './dto/assign-shift.dto';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(Shift) private readonly shiftRepo: Repository<Shift>,
    @InjectRepository(ShiftAssignment) private readonly assignmentRepo: Repository<ShiftAssignment>,
  ) {}

  // ---- Shifts ----
  async findAll(
    outletId?: number,
    accessibleOutletIds: number[] | 'ALL' = 'ALL',
  ): Promise<Shift[]> {
    const where: any = {};
    if (outletId) where.outletId = outletId;
    else if (accessibleOutletIds !== 'ALL') where.outletId = In(accessibleOutletIds);
    return this.shiftRepo.find({ where, order: { startTime: 'ASC' } });
  }

  async findOne(id: number): Promise<Shift> {
    const s = await this.shiftRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException(`Shift ${id} not found`); return s;
  }

  async create(dto: CreateShiftDto): Promise<Shift> {
    return this.shiftRepo.save(this.shiftRepo.create(dto));
  }

  async update(id: number, dto: UpdateShiftDto): Promise<Shift> {
    const s = await this.findOne(id); Object.assign(s, dto); return this.shiftRepo.save(s);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id); await this.shiftRepo.delete(id);
  }

  // ---- Shift Assignments ----
  async assignEmployee(dto: AssignShiftDto, createdBy: number): Promise<ShiftAssignment> {
    await this.findOne(dto.shiftId);
    return this.assignmentRepo.save(this.assignmentRepo.create({ ...dto, createdBy }));
  }

  /** Internal lookup used by the controller to resolve an assignment's shift before deleting it. */
  async findAssignment(id: number): Promise<ShiftAssignment> {
    const a = await this.assignmentRepo.findOne({ where: { id } });
    if (!a) throw new NotFoundException(`Shift assignment ${id} not found`);
    return a;
  }

  async unassignEmployee(id: number): Promise<void> {
    await this.assignmentRepo.delete(id);
  }

  async getAssignments(shiftId: number, date?: string): Promise<ShiftAssignment[]> {
    const where: any = { shiftId };
    if (date) where.assignedDate = date;
    return this.assignmentRepo.find({ where, relations: ['employee'] });
  }

  /** All active assignments for a given date, across shifts — used by the shift-reminder job. */
  async getAssignmentsForDate(date: string): Promise<ShiftAssignment[]> {
    return this.assignmentRepo.find({
      where: { assignedDate: date, isActive: true },
      relations: ['employee', 'shift'],
    });
  }
}
