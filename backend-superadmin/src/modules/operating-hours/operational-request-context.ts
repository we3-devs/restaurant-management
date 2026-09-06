import { AsyncLocalStorage } from 'node:async_hooks';

export interface OperationalRequestContext {
  userId: number | null;
  isSuperadmin: boolean;
  overrideRequested: boolean;
  method: string;
  path: string;
  overrideAudited: boolean;
}

export const operationalRequestContext = new AsyncLocalStorage<OperationalRequestContext>();
