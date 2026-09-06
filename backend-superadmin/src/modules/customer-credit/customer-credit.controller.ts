import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { User } from '../users/entities/user.entity';
import { CustomerCreditService } from './customer-credit.service';
import { AdjustCustomerCreditDto } from './dto/adjust-customer-credit.dto';
import { ListCustomerCreditAccountsQueryDto } from './dto/list-customer-credit-accounts-query.dto';
import { ListCustomerCreditTransactionsQueryDto } from './dto/list-customer-credit-transactions-query.dto';
import { SetCustomerCreditLimitDto } from './dto/set-customer-credit-limit.dto';
import { SettleCustomerDebtDto } from './dto/settle-customer-debt.dto';

@ApiTags('customer-credit')
@ApiBearerAuth()
@Controller('customer-credit')
export class CustomerCreditController {
  constructor(private readonly customerCreditService: CustomerCreditService) {}

  @Get('accounts')
  @RequirePermissions('customer-credit.view')
  @ApiOperation({ summary: 'Lists customer credit accounts (paginated, searchable by customer name/phone)' })
  findAccounts(@Query() query: ListCustomerCreditAccountsQueryDto) {
    return this.customerCreditService.findAccounts(query);
  }

  @Get('accounts/:customerId')
  @RequirePermissions('customer-credit.view')
  @ApiOperation({ summary: "Gets a customer's credit account (auto-created if missing)" })
  getAccountByCustomer(@Param('customerId', ParseIntPipe) customerId: number) {
    return this.customerCreditService.getAccountByCustomer(customerId);
  }

  @Get('transactions')
  @RequirePermissions('customer-credit.view')
  @ApiOperation({ summary: 'Lists customer credit transactions (paginated, filterable)' })
  findTransactions(@Query() query: ListCustomerCreditTransactionsQueryDto) {
    return this.customerCreditService.findTransactions(query);
  }

  @Patch('accounts/:customerId/limit')
  @RequirePermissions('customer-credit.manage')
  @ApiOperation({ summary: "Sets a customer's credit limit" })
  setCreditLimit(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Body() dto: SetCustomerCreditLimitDto,
  ) {
    return this.customerCreditService.setCreditLimit(customerId, dto.creditLimit);
  }

  @Post('settlements')
  @RequirePermissions('customer-credit.manage')
  @ApiOperation({ summary: "Records a payment against a customer's outstanding balance" })
  settleDebt(@Body() dto: SettleCustomerDebtDto, @CurrentUser() user: User) {
    return this.customerCreditService.settleDebt(
      dto.customerId,
      dto.amount,
      user.id,
      dto.notes,
    );
  }

  @Post('adjustments')
  @RequirePermissions('customer-credit.manage')
  @ApiOperation({ summary: "Manually adjusts a customer's outstanding balance" })
  createAdjustment(@Body() dto: AdjustCustomerCreditDto, @CurrentUser() user: User) {
    return this.customerCreditService.adjustBalance(
      dto.customerId,
      dto.delta,
      user.id,
      dto.notes,
    );
  }
}
