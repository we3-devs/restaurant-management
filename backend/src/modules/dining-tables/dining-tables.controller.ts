import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PoolMetrics } from '../../common/instrumentation/pool-metrics';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { DiningTablesService } from './dining-tables.service';
import { CreateDiningTableDto } from './dto/create-dining-table.dto';
import { ListDiningTablesQueryDto } from './dto/list-dining-tables-query.dto';
import { UpdateDiningTableDto } from './dto/update-dining-table.dto';

@ApiTags('dining-tables')
@ApiBearerAuth()
@Controller('dining-tables')
export class DiningTablesController {
  private readonly logger = new Logger(DiningTablesController.name);

  constructor(
    private readonly diningTablesService: DiningTablesService,
    private readonly poolMetrics: PoolMetrics,
  ) {}

  @Get('lookup')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Resolves a table by its code for the guest QR service page (no auth) — returns only the fields guests need',
  })
  async findByCode(@Query('code') code: string) {
    const table = await this.diningTablesService.findByCode(code);
    // Trim to a minimal public shape — the full entity carries layout/status
    // internals that a guest endpoint should not expose.
    return {
      id: table.id,
      outletId: table.outletId,
      name: table.name,
      code: table.code,
    };
  }

  @Get()
  @RequirePermissions('dining-tables.view')
  @ApiOperation({
    summary:
      'Lists dining tables (paginated, optional search + outletId/diningAreaId/status filters)',
  })
  async findAll(@Query() query: ListDiningTablesQueryDto) {
    const start = Date.now();

    const result = await this.diningTablesService.findAll(query);

    const duration = Date.now() - start;
    this.logger.log(
      `[PERF:dining-tables/findAll] outletId=${query.outletId} total=${duration}ms`
    );

    return result;
  }

  @Get(':id')
  @RequirePermissions('dining-tables.view')
  @ApiOperation({ summary: 'Gets a dining table' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.diningTablesService.findOne(id);
  }

  @Post()
  @RequirePermissions('dining-tables.manage')
  @ApiOperation({ summary: 'Creates a dining table' })
  create(@Body() dto: CreateDiningTableDto) {
    return this.diningTablesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('dining-tables.manage')
  @ApiOperation({
    summary: 'Updates a dining table (outletId/diningAreaId are immutable)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDiningTableDto,
  ) {
    return this.diningTablesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('dining-tables.manage')
  @ApiOperation({ summary: 'Deletes a dining table (no soft delete)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.diningTablesService.remove(id);
  }
}
