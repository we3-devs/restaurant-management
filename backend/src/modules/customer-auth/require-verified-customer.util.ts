import { UnauthorizedException } from '@nestjs/common';
import type { Outlet } from '../outlets/entities/outlet.entity';
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

/**
 * Resolves a purchasing identity for order placement: a verified customer's
 * id, or — only when the table's outlet is currently configured for
 * quick_order — null for an anonymous guest JWT. Always re-derives the
 * outlet's current mode from the DB rather than trusting the JWT's `type`
 * alone, so a stale guest token from an outlet later switched back to
 * 'login' can't keep ordering anonymously.
 */
export function resolveOrderingIdentity(
  customer: CustomerJwtPayload,
  outlet: Pick<Outlet, 'qrOrderingMode'>,
  action = 'to continue',
): number | null {
  if (outlet.qrOrderingMode === 'login') {
    return requireVerifiedCustomerId(customer, action);
  }
  if (customer.type === 'customer' && customer.sub !== null) {
    return customer.sub;
  }
  if (customer.type === 'guest') {
    return null;
  }
  throw new UnauthorizedException(`Sign-in is required ${action}`);
}
