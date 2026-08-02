import { UnauthorizedException } from '@nestjs/common';
import type { CustomerJwtPayload } from './types/customer-jwt-payload';

/**
 * Throws unless the presented customer session is a real, OTP-verified
 * customer (not the anonymous 12h guest-session type) — any guest action
 * that should be tracked against a real, phone-verified person (ordering,
 * calling staff, ...) must go through this first.
 */
export function requireVerifiedCustomerId(
  customer: CustomerJwtPayload,
  action = 'to continue',
): number {
  if (customer.type !== 'customer' || customer.sub === null) {
    throw new UnauthorizedException(`Phone verification is required ${action}`);
  }
  return customer.sub;
}
