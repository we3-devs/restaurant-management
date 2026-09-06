import { SetMetadata } from '@nestjs/common';

export const ALLOW_WITHOUT_PRESENCE = 'allowWithoutPresence';
export const AllowWithoutPresence = () => SetMetadata(ALLOW_WITHOUT_PRESENCE, true);
