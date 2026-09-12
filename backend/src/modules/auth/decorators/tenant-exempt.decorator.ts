import { SetMetadata } from '@nestjs/common';

export const TENANT_EXEMPT_KEY = 'tenant_exempt';
export const TenantExempt = () => SetMetadata(TENANT_EXEMPT_KEY, true);
