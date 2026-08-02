import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { CustomerAuthService } from './customer-auth.service';
import { CurrentCustomer } from './decorators/current-customer.decorator';
import { GuestSessionDto } from './dto/guest-session.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CustomerJwtAuthGuard } from './guards/customer-jwt-auth.guard';
import type { CustomerJwtPayload } from './types/customer-jwt-payload';

@ApiTags('customer-auth')
@Controller('customer-auth')
export class CustomerAuthController {
  constructor(private readonly customerAuthService: CustomerAuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sends a one-time code to a phone number or email' })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.customerAuthService.requestOtp(dto.phone, dto.email);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verifies a one-time code and returns a customer session token',
  })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.customerAuthService.verifyOtp(
      dto.phone,
      dto.email,
      dto.code,
      dto.name,
    );
  }

  @Public()
  @Post('guest')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Issues a short-lived guest session token (no customer identity), used for QR-ordering without sign-in',
  })
  guestSession(@Body() dto: GuestSessionDto) {
    return this.customerAuthService.guestSession(dto.tableId);
  }

  // Public() is required here even though CustomerJwtAuthGuard enforces the
  // real check — without it, the globally-registered staff JwtAuthGuard
  // (APP_GUARD) runs first and tries to validate the customer JWT as a
  // staff one, looks up payload.sub in `users`, finds nothing (it's a
  // customer id), and rejects with "User no longer exists" before this
  // route's own guard ever runs. Same pattern as this controller's other
  // routes and CustomerPortalController.
  @Public()
  @Get('me')
  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  @ApiOperation({ summary: 'Returns the current customer/guest session claims' })
  me(@CurrentCustomer() customer: CustomerJwtPayload) {
    return customer;
  }
}
