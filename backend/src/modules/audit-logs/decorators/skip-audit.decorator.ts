import { SetMetadata } from '@nestjs/common';

export const SKIP_AUDIT_KEY = 'skipAudit';

/**
 * Opts a route out of the global audit interceptor (see AuditInterceptor) —
 * for routes that already record a more specific audit entry themselves
 * (e.g. AuthService#login/#logout, SettingsService#update), or that are too
 * low-signal to be worth an activity-trail row (OTP requests, ws tickets).
 */
export const SkipAudit = () => SetMetadata(SKIP_AUDIT_KEY, true);
