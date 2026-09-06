import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { ImportDomainConfig } from './interfaces/import-domain-config.interface';

/**
 * Injection token the array of registered ImportDomainConfigs is provided
 * under. NestJS's DI has no Angular-style `multi: true` provider merging, so
 * the array itself has to be assembled by something — that's
 * `data-import.module.ts`'s job: it imports each domain module (which each
 * export their own importer as a plain provider) and combines them via a
 * `useFactory` bound to this token. That's the one place domain names are
 * unavoidably named outside their own module — the engine's actual logic
 * (this registry, the service, the controller, the parser) stays fully
 * domain-agnostic and only ever sees `ImportDomainConfig`. Adding a new
 * domain later means one new import + one factory-inject argument in
 * data-import.module.ts, nothing in this file.
 */
export const IMPORT_DOMAIN_CONFIG = Symbol('IMPORT_DOMAIN_CONFIG');

/** Looks up a registered ImportDomainConfig by its `domain` slug. */
@Injectable()
export class ImporterRegistry {
  private readonly byDomain: Map<string, ImportDomainConfig>;

  constructor(
    @Optional()
    @Inject(IMPORT_DOMAIN_CONFIG)
    configs: ImportDomainConfig[] = [],
  ) {
    this.byDomain = new Map(configs.map((config) => [config.domain, config]));
  }

  list(): { domain: string; label: string }[] {
    return [...this.byDomain.values()].map(({ domain, label }) => ({ domain, label }));
  }

  get(domain: string): ImportDomainConfig {
    const config = this.byDomain.get(domain);
    if (!config) {
      throw new NotFoundException(`Unknown import domain "${domain}"`);
    }
    return config;
  }
}
