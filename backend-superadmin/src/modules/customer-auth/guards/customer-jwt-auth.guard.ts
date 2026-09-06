import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guards customer-portal / QR-ordering routes. Distinct from the staff
 * JwtAuthGuard (which is wired globally via APP_GUARD and checks the 'jwt'
 * passport strategy against the `users` table) — customer routes must be
 * marked @Public() to bypass that global guard, then apply this guard
 * explicitly, which validates against the separate 'jwt-customer' strategy.
 */
@Injectable()
export class CustomerJwtAuthGuard extends AuthGuard('jwt-customer') {}
