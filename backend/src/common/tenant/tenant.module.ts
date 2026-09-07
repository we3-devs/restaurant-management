import { Global, Module } from '@nestjs/common';
import { TenantContext } from './tenant-context';

/**
 * Provides the request-scoped tenant context to every feature module that
 * applies tenant filters to its repositories.
 */
@Global()
@Module({
  providers: [TenantContext],
  exports: [TenantContext],
})
export class TenantModule {}
