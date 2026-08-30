import { SetMetadata } from '@nestjs/common';

export const EXPOSE_RESPONSE_FIELDS = 'exposeResponseFields';

export const ExposeResponseFields = (...fields: string[]) =>
  SetMetadata(EXPOSE_RESPONSE_FIELDS, new Set(fields));
