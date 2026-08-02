import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { User } from '../users/entities/user.entity';
import { CreateTableSessionDto } from './dto/create-table-session.dto';
import { ListTableSessionsQueryDto } from './dto/list-table-sessions-query.dto';
import { TransferTableSessionDto } from './dto/transfer-table-session.dto';
import { TableSessionsService } from './table-sessions.service';

@ApiTags('table-sessions')
@ApiBearerAuth()
@Controller('table-sessions')
export class TableSessionsController {
  constructor(private readonly tableSessionsService: TableSessionsService) {}

  @Get()
  @RequirePermissions('table-sessions.view')
  @ApiOperation({
    summary:
      'Lists table sessions (paginated, optional outletId/diningTableId/status filters)',
  })
  findAll(@Query() query: ListTableSessionsQueryDto) {
    return this.tableSessionsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('table-sessions.view')
  @ApiOperation({
    summary: 'Gets a table session, with outlet/table names and guest (customer) detail resolved',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tableSessionsService.findOneDetailed(id);
  }

  @Post()
  @RequirePermissions('table-sessions.manage')
  @ApiOperation({
    summary: 'Starts a table session (flips the table status to occupied)',
  })
  create(@Body() dto: CreateTableSessionDto, @CurrentUser() user: User) {
    return this.tableSessionsService.create(dto, user.id);
  }

  @Post(':id/end')
  @RequirePermissions('table-sessions.manage')
  @ApiOperation({
    summary: 'Ends a table session (flips the table status back to available)',
  })
  end(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.tableSessionsService.end(id, user.id);
  }

  @Post(':id/transfer')
  @RequirePermissions('table-sessions.manage')
  @ApiOperation({
    summary:
      'Moves an in-progress session to a different table (same outlet, destination must be free)',
  })
  transfer(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TransferTableSessionDto,
    @CurrentUser() user: User,
  ) {
    return this.tableSessionsService.transfer(id, dto, user.id);
  }
}
