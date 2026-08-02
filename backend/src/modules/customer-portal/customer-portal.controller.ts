import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ForbiddenException } from '@nestjs/common';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Public } from '../auth/decorators/public.decorator';
import { SkipAudit } from '../audit-logs/decorators/skip-audit.decorator';
import { CurrentCustomer } from '../customer-auth/decorators/current-customer.decorator';
import { CustomerJwtAuthGuard } from '../customer-auth/guards/customer-jwt-auth.guard';
import type { CustomerJwtPayload } from '../customer-auth/types/customer-jwt-payload';
import { CustomerPortalService } from './customer-portal.service';
import { ToggleFavoriteDto } from './dto/toggle-favorite.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpsertAddressDto } from './dto/upsert-address.dto';

@ApiTags('customer-portal')
@ApiBearerAuth()
@Public()
@UseGuards(CustomerJwtAuthGuard)
@Controller('customer-portal')
export class CustomerPortalController {
  constructor(private readonly customerPortalService: CustomerPortalService) {}

  private requireCustomerId(customer: CustomerJwtPayload): number {
    if (customer.type !== 'customer' || customer.sub === null) {
      throw new ForbiddenException('Sign in required for this action');
    }
    return customer.sub;
  }

  @Get('profile')
  @ApiOperation({ summary: "Returns the signed-in customer's profile" })
  getProfile(@CurrentCustomer() customer: CustomerJwtPayload) {
    return this.customerPortalService.getProfile(
      this.requireCustomerId(customer),
    );
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Updates profile fields' })
  // CustomerPortalService#updateProfile already records its own entry with oldValues.
  @SkipAudit()
  updateProfile(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.customerPortalService.updateProfile(
      this.requireCustomerId(customer),
      dto,
    );
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Updates dietary preferences and allergies' })
  // CustomerPortalService#updatePreferences already records its own entry.
  @SkipAudit()
  updatePreferences(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.customerPortalService.updatePreferences(
      this.requireCustomerId(customer),
      dto,
    );
  }

  @Get('addresses')
  @ApiOperation({ summary: 'Lists saved addresses' })
  listAddresses(@CurrentCustomer() customer: CustomerJwtPayload) {
    return this.customerPortalService.listAddresses(
      this.requireCustomerId(customer),
    );
  }

  @Post('addresses')
  @ApiOperation({ summary: 'Adds a saved address' })
  addAddress(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Body() dto: UpsertAddressDto,
  ) {
    return this.customerPortalService.addAddress(
      this.requireCustomerId(customer),
      dto,
    );
  }

  @Delete('addresses/:addressId')
  @ApiOperation({ summary: 'Removes a saved address' })
  removeAddress(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Param('addressId') addressId: string,
  ) {
    return this.customerPortalService.removeAddress(
      this.requireCustomerId(customer),
      addressId,
    );
  }

  @Get('favorites')
  @ApiOperation({ summary: 'Lists favorite food ids' })
  listFavorites(@CurrentCustomer() customer: CustomerJwtPayload) {
    return this.customerPortalService.listFavorites(
      this.requireCustomerId(customer),
    );
  }

  @Post('favorites/toggle')
  @ApiOperation({ summary: 'Adds/removes a food from favorites' })
  toggleFavorite(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Body() dto: ToggleFavoriteDto,
  ) {
    return this.customerPortalService.toggleFavorite(
      this.requireCustomerId(customer),
      dto.foodId,
    );
  }

  @Get('orders')
  @ApiOperation({ summary: 'Lists order history' })
  listOrders(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Query() query: PaginationQueryDto,
  ) {
    return this.customerPortalService.listOrders(
      this.requireCustomerId(customer),
      query,
    );
  }

  @Get('orders/:orderId')
  @ApiOperation({ summary: 'Returns a single order with its items' })
  getOrder(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Param('orderId', ParseIntPipe) orderId: number,
  ) {
    return this.customerPortalService.getOrder(
      this.requireCustomerId(customer),
      orderId,
    );
  }

  @Get('orders/:orderId/invoice')
  @ApiOperation({ summary: 'Returns the order plus its payment/refund lines' })
  getInvoice(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Param('orderId', ParseIntPipe) orderId: number,
  ) {
    return this.customerPortalService.getInvoice(
      this.requireCustomerId(customer),
      orderId,
    );
  }

  @Get('loyalty')
  @ApiOperation({ summary: 'Returns the loyalty account balance/tier' })
  getLoyalty(@CurrentCustomer() customer: CustomerJwtPayload) {
    return this.customerPortalService.getLoyalty(
      this.requireCustomerId(customer),
    );
  }

  @Get('loyalty/history')
  @ApiOperation({ summary: 'Lists loyalty point transactions' })
  getLoyaltyHistory(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Query() query: PaginationQueryDto,
  ) {
    return this.customerPortalService.getLoyaltyHistory(
      this.requireCustomerId(customer),
      query,
    );
  }
}
