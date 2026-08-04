import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfig } from '../../config/configuration';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DiningTablesService } from '../dining-tables/dining-tables.service';
import { Customer } from '../customers/entities/customer.entity';
import { SmsService } from '../notifications/channels/sms.service';
import { CustomerJwtPayload } from './types/customer-jwt-payload';

const OTP_TTL_SECONDS = 5 * 60;
const OTP_RESEND_LOCK_SECONDS = 60;
const OTP_MAX_VERIFY_ATTEMPTS = 5;
const OTP_CLEANUP_INTERVAL_MS = 10 * 60_000;
const GUEST_SESSION_EXPIRES_IN = '12h';
const CUSTOMER_SESSION_EXPIRES_IN = '30d';

/**
 * Postgres-backed replacement for the old Redis OTP flow (`SET NX EX`
 * resend-lock, `SET EX` code, `INCR`+`EXPIRE` attempts). One row per
 * identifier in `customer_otps`; every operation below is a single
 * statement so concurrent requests for the same identifier can't race —
 * see each method's comment for the specific atomicity guarantee.
 */
@Injectable()
export class CustomerAuthService {
  private readonly logger = new Logger(CustomerAuthService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig>,
    private readonly auditLogsService: AuditLogsService,
    private readonly diningTablesService: DiningTablesService,
    private readonly smsService: SmsService,
  ) {}

  @Interval(OTP_CLEANUP_INTERVAL_MS)
  async cleanupExpiredOtps(): Promise<void> {
    try {
      await this.customersRepository.manager.query(
        `DELETE FROM customer_otps WHERE expires_at < now()`,
      );
    } catch (err) {
      this.logger.warn(`customer_otps cleanup failed: ${(err as Error).message}`);
    }
  }

  private resolveIdentifier(phone?: string, email?: string): string {
    if (!phone && !email) {
      throw new BadRequestException('phone or email is required');
    }
    return (phone ?? email!).trim().toLowerCase();
  }

  async requestOtp(
    phone?: string,
    email?: string,
  ): Promise<{ sent: true; devCode?: string }> {
    const identifier = this.resolveIdentifier(phone, email);
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Single conditional upsert: replaces SET NX EX (resend lock) + SET EX
    // (code) + DEL (reset attempts) as one atomic statement. The WHERE
    // clause only lets the write through if there's no row yet or its lock
    // has expired — same guarantee SET NX gave (0 rows back = still
    // locked), just expressed as an UPSERT that Postgres serializes against
    // concurrent callers for the same identifier.
    const rows = await this.customersRepository.manager.query(
      `INSERT INTO customer_otps (identifier, code, expires_at, attempts, lock_until)
       VALUES ($1, $2, now() + make_interval(secs => $3), 0, now() + make_interval(secs => $4))
       ON CONFLICT (identifier) DO UPDATE SET
         code = EXCLUDED.code,
         expires_at = EXCLUDED.expires_at,
         attempts = 0,
         lock_until = EXCLUDED.lock_until
       WHERE customer_otps.lock_until IS NULL OR customer_otps.lock_until < now()
       RETURNING identifier`,
      [identifier, code, OTP_TTL_SECONDS, OTP_RESEND_LOCK_SECONDS],
    );
    if (rows.length === 0) {
      throw new BadRequestException(
        'An OTP was already sent recently — please wait before requesting another',
      );
    }

    if (phone && this.smsService.isConfigured) {
      await this.smsService.send(phone, `Your verification code is ${code}`);
    } else {
      // Email OTP and any environment without Twilio configured falls back
      // to server logs so the flow stays testable everywhere.
      this.logger.log(`OTP for ${identifier}: ${code}`);
    }

    // TEMPORARY: surfaces the code straight in the API response (including
    // production) so the frontend can show it without depending on SMS
    // actually being deliverable — see SmsService.isConfigured above. This
    // is a real security tradeoff: anyone who can reach the API sees the
    // code without touching the phone, which defeats the "verified phone
    // number ties an order to a real person" anti-abuse purpose the OTP
    // otherwise serves (see GuestAuthGate's comment). Remove once real SMS
    // delivery is confirmed working end-to-end.
    return { sent: true, devCode: code };
  }

  async verifyOtp(
    phone: string | undefined,
    email: string | undefined,
    code: string,
    name?: string,
  ): Promise<{ accessToken: string; customer: Customer } > {
    const identifier = this.resolveIdentifier(phone, email);

    // Atomic increment (replaces INCR+EXPIRE) — the row's own expires_at is
    // the TTL now, no separate expiry needed on the counter.
    // TypeORM's raw query() returns [rows, affectedCount] for DELETE/UPDATE
    // (unlike INSERT, which returns rows directly) — confirmed empirically,
    // not documented consistently. Destructure, don't just check .length.
    const [attemptRows]: [{ attempts: number }[], number] =
      await this.customersRepository.manager.query(
        `UPDATE customer_otps SET attempts = attempts + 1 WHERE identifier = $1 RETURNING attempts`,
        [identifier],
      );
    if (attemptRows.length === 0) {
      throw new UnauthorizedException('Invalid or expired code');
    }
    if (attemptRows[0].attempts > OTP_MAX_VERIFY_ATTEMPTS) {
      throw new UnauthorizedException(
        'Too many incorrect attempts — request a new code',
      );
    }

    // Atomic consume: a wrong code affects 0 rows and leaves the row (and
    // attempt count) intact for the next try; a correct code both verifies
    // and deletes in one statement, so of two concurrent requests with the
    // right code, only the first to reach Postgres finds the row still
    // there — the second gets 0 rows back, same as a wrong code.
    const [consumed]: [unknown[], number] = await this.customersRepository.manager.query(
      `DELETE FROM customer_otps WHERE identifier = $1 AND code = $2 AND expires_at > now() RETURNING identifier`,
      [identifier, code],
    );
    if (consumed.length === 0) {
      throw new UnauthorizedException('Invalid or expired code');
    }

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
