import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SuperadminGuard } from '../auth/guards/superadmin.guard';
import { AssignOutletDto } from './dto/assign-outlet.dto';
import { CreateTenantDto, UpdateTenantDto } from './dto/create-tenant.dto';
import { TenantsService } from './tenants.service';

@ApiTags('superadmin')
@ApiBearerAuth()
@Controller('superadmin')
@UseGuards(SuperadminGuard)
export class TenantsController {
  constructor(private readonly service: TenantsService) {}

  @Get('tenants') list() { return this.service.list(); }
  @Get('outlets') allOutlets() { return this.service.allOutlets(); }
  @Post('tenants') create(@Body() dto: CreateTenantDto) { return this.service.create(dto); }
  @Patch('tenants/:id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTenantDto) { return this.service.update(id, dto); }
  @Get('tenants/:id/outlets') outlets(@Param('id', ParseIntPipe) id: number) { return this.service.outletsForTenant(id); }
  @Patch('outlets/:id/tenant') assign(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignOutletDto) { return this.service.assignOutlet(id, dto.tenantId); }
}
