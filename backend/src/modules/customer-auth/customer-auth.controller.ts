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
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sends a one-time code to a phone number or email' })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.customerAuthService.requestOtp(dto.phone, dto.email);
  }

  @Public()
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

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  @ApiOperation({ summary: 'Returns the current customer/guest session claims' })
  me(@CurrentCustomer() customer: CustomerJwtPayload) {
    return customer;
  }
}
