import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type Redis from 'ioredis';
import { Repository } from 'typeorm';
import { AppConfig } from '../../config/configuration';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DiningTablesService } from '../dining-tables/dining-tables.service';
import { Customer } from '../customers/entities/customer.entity';
import { CustomerJwtPayload } from './types/customer-jwt-payload';

const OTP_TTL_SECONDS = 5 * 60;
const OTP_RESEND_LOCK_SECONDS = 60;
const GUEST_SESSION_EXPIRES_IN = '12h';
const CUSTOMER_SESSION_EXPIRES_IN = '30d';

function otpKey(identifier: string): string {
  return `customer-otp:${identifier}`;
}
function otpLockKey(identifier: string): string {
  return `customer-otp-lock:${identifier}`;
}

@Injectable()
export class CustomerAuthService {
  private readonly logger = new Logger(CustomerAuthService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig>,
    private readonly auditLogsService: AuditLogsService,
    private readonly diningTablesService: DiningTablesService,
  ) {}

  private resolveIdentifier(phone?: string, email?: string): string {
    if (!phone && !email) {
      throw new BadRequestException('phone or email is required');
    }
    return (phone ?? email!).trim().toLowerCase();
  }

  async requestOtp(phone?: string, email?: string): Promise<{ sent: true }> {
    const identifier = this.resolveIdentifier(phone, email);

    const locked = await this.redis.set(
      otpLockKey(identifier),
      '1',
      'EX',
      OTP_RESEND_LOCK_SECONDS,
      'NX',
    );
    if (!locked) {
      throw new BadRequestException(
        'An OTP was already sent recently — please wait before requesting another',
      );
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.redis.set(otpKey(identifier), code, 'EX', OTP_TTL_SECONDS);

    // No SMS/email provider is wired up yet (see settings.enableSms) — until
    // one is configured, the code is delivered via server logs so the flow
    // is fully testable end-to-end in every environment.
    this.logger.log(`OTP for ${identifier}: ${code}`);

    return { sent: true };
  }

  async verifyOtp(
    phone: string | undefined,
    email: string | undefined,
    code: string,
    name?: string,
  ): Promise<{ accessToken: string; customer: Customer } > {
    const identifier = this.resolveIdentifier(phone, email);
    const storedCode = await this.redis.get(otpKey(identifier));
    if (!storedCode || storedCode !== code) {
      throw new UnauthorizedException('Invalid or expired code');
    }
    await this.redis.del(otpKey(identifier));

    const customer = await this.findOrCreateCustomer(phone, email, name);
    customer.lastLoginAt = new Date();
    await this.customersRepository.save(customer);

    await this.auditLogsService.record({
      action: 'login',
      entityType: 'customer',
      entityId: customer.id,
      newValues: { via: phone ? 'phone_otp' : 'email_otp' },
    });

    const payload: CustomerJwtPayload = {
      sub: customer.id,
      type: 'customer',
      phone: customer.phone ?? undefined,
      email: customer.email ?? undefined,
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: CUSTOMER_SESSION_EXPIRES_IN,
    });

    return { accessToken, customer };
  }

  async guestSession(tableId?: number): Promise<{ accessToken: string }> {
    if (tableId !== undefined) {
      await this.diningTablesService.findOne(tableId);
    }
    const payload: CustomerJwtPayload = { sub: null, type: 'guest', tableId };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: GUEST_SESSION_EXPIRES_IN,
    });
    return { accessToken };
  }

  private async findOrCreateCustomer(
    phone: string | undefined,
    email: string | undefined,
    name?: string,
  ): Promise<Customer> {
    const existing = await this.customersRepository.findOne({
      where: phone ? { phone } : { email },
    });
    if (existing) return existing;

    return this.customersRepository.save(
      this.customersRepository.create({
        name: name?.trim() || phone || email || 'Guest',
        phone: phone ?? null,
        email: email ?? null,
      }),
    );
  }
}
