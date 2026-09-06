import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { User } from '../users/entities/user.entity';
import { AdjustLoyaltyPointsDto } from './dto/create-loyalty-adjustment.dto';
import { ListLoyaltyAccountsQueryDto } from './dto/list-loyalty-accounts-query.dto';
import { ListLoyaltyTransactionsQueryDto } from './dto/list-loyalty-transactions-query.dto';
import { LoyaltyService } from './loyalty.service';

@ApiTags('loyalty')
@ApiBearerAuth()
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('accounts')
  @RequirePermissions('loyalty.view')
  @ApiOperation({ summary: 'Lists loyalty accounts (paginated, searchable by customer name/phone)' })
  findAccounts(@Query() query: ListLoyaltyAccountsQueryDto) {
    return this.loyaltyService.findAccounts(query);
  }

  @Get('accounts/:customerId')
  @RequirePermissions('loyalty.view')
  @ApiOperation({ summary: "Gets a customer's loyalty account (auto-created if missing)" })
  getAccountByCustomer(@Param('customerId', ParseIntPipe) customerId: number) {
    return this.loyaltyService.getAccountByCustomer(customerId);
  }

  @Get('transactions')
  @RequirePermissions('loyalty.view')
  @ApiOperation({ summary: 'Lists loyalty transactions (paginated, filterable)' })
  findTransactions(@Query() query: ListLoyaltyTransactionsQueryDto) {
    return this.loyaltyService.findTransactions(query);
  }

  @Post('adjustments')
  @RequirePermissions('loyalty.manage')
  @ApiOperation({ summary: "Manually adjusts a customer's loyalty point balance" })
  createAdjustment(
    @Body() dto: AdjustLoyaltyPointsDto,
    @CurrentUser() user: User,
  ) {
    return this.loyaltyService.adjustPoints(
      dto.customerId,
      dto.delta,
      user.id,
      dto.notes,
    );
  }
}
