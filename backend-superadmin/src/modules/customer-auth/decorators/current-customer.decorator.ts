import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { CustomerJwtPayload } from '../types/customer-jwt-payload';

/**
 * The verified customer/guest JWT payload — see CustomerJwtAuthGuard.
 * Passport's AuthGuard always assigns the strategy's validate() return
 * value to `request.user` (not a custom property), regardless of strategy
 * name — hence reading `request.user` here rather than `request.customer`.
 */
export const CurrentCustomer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CustomerJwtPayload => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as unknown as CustomerJwtPayload;
  },
);
