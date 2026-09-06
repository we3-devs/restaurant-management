import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { EmploymentStatus } from '../entities/employee.entity';

export class PositionDefaultRoleDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  level: string;
}

export class PositionResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiPropertyOptional({ nullable: true })
  defaultRoleId: number | null;

  @ApiPropertyOptional({ type: PositionDefaultRoleDto, nullable: true })
  defaultRole: PositionDefaultRoleDto | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class EmployeeResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  employeeCode: string;

  @ApiPropertyOptional({ nullable: true })
  userId: number | null;

  @ApiPropertyOptional({ nullable: true })
  positionId: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Flattened from the linked position — no nested role/permissions graph' })
  positionName: string | null;

  @ApiProperty()
  outletId: number;

  @ApiPropertyOptional({ nullable: true })

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  email: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ nullable: true })
  photoUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  joiningDate: string | null;

  @ApiProperty()
  employmentStatus: EmploymentStatus;

  @ApiPropertyOptional({ nullable: true })
  emergencyContactName: string | null;

  @ApiPropertyOptional({ nullable: true })
  emergencyContactPhone: string | null;

  @ApiPropertyOptional({ nullable: true })
  emergencyContactRelation: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  requiresAttendance: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
