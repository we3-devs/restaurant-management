import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { OpenTableSessionDto } from '../table-sessions/dto/open-table-session.dto';
import { User } from '../users/entities/user.entity';
import { OrdersService } from './orders.service';

/**
 * Lives in OrdersModule (not TableSessionsModule) even though its route is
 * under /table-sessions — OrdersModule already has a plain (non-circular)
 * dependency on TableSessionsModule, so OrdersService can drive both
 * inserts in one transaction without introducing a reverse
 * TableSessions -> Orders module edge. Nest allows multiple controllers to
 * share a path prefix across modules as long as routes don't collide.
 */
@ApiTags('table-sessions')
@ApiBearerAuth()
@Controller('table-sessions')
export class TableSessionOpenController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('open')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('table-sessions.manage', 'orders.manage')
  @ApiOperation({
    summary:
      'Opens a table session and creates its first order atomically in one transaction, returning both — replaces the old create-session-then-create-order two-request flow so the client never renders an intermediate "no order yet" state.',
  })
  open(@Body() dto: OpenTableSessionDto, @CurrentUser() user: User) {
    return this.ordersService.openTableWithOrder(dto, user.id);
  }
}
