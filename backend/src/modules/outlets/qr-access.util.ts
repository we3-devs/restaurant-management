import { ForbiddenException } from '@nestjs/common';
import type { Outlet } from './entities/outlet.entity';

/** Node/Express report an IPv4 peer as ::ffff:a.b.c.d depending on trust-proxy config; normalize before comparing. */
function normalizeIp(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

export function isIpAllowed(requestIp: string, allowedIp: string | null): boolean {
  if (!allowedIp) return false;
  return normalizeIp(requestIp) === normalizeIp(allowedIp);
}

/** Great-circle distance between two lat/lng points, in meters. */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const EARTH_RADIUS_METERS = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWithinGeofence(
  lat: number,
  lon: number,
  outlet: Pick<Outlet, 'qrAccessLatitude' | 'qrAccessLongitude' | 'qrAccessRadiusMeters'>,
): boolean {
  if (
    outlet.qrAccessLatitude === null ||
    outlet.qrAccessLongitude === null ||
    outlet.qrAccessRadiusMeters === null
  ) {
    return false;
  }
  return (
    haversineDistanceMeters(lat, lon, outlet.qrAccessLatitude, outlet.qrAccessLongitude) <=
    outlet.qrAccessRadiusMeters
  );
}

/**
 * Authoritative gate for quick-order (no-login) QR ordering. Encodes the
 * qrAccessCheckMode branching once so the join endpoint and every order
 * placement re-check can't drift out of sync with each other.
 */
export function assertQrAccess(
  outlet: Pick<
    Outlet,
    'qrAccessCheckMode' | 'qrAccessAllowedIp' | 'qrAccessLatitude' | 'qrAccessLongitude' | 'qrAccessRadiusMeters'
  >,
  ctx: { ip: string; lat?: number; lon?: number },
): void {
  const ipOk = isIpAllowed(ctx.ip, outlet.qrAccessAllowedIp);
  const geoOk = ctx.lat !== undefined && ctx.lon !== undefined && isWithinGeofence(ctx.lat, ctx.lon, outlet);

  switch (outlet.qrAccessCheckMode) {
    case 'ip':
      if (!ipOk) throw new ForbiddenException('This network isn\'t recognized for this table');
      return;
    case 'geofence':
      if (!geoOk) throw new ForbiddenException('You don\'t appear to be at the restaurant');
      return;
    case 'both':
      if (!ipOk || !geoOk) {
        throw new ForbiddenException('You must be on the restaurant\'s Wi-Fi and at the restaurant to continue');
      }
      return;
    case 'either':
    default:
      if (!ipOk && !geoOk) {
        throw new ForbiddenException('You don\'t appear to be at the restaurant');
      }
      return;
  }
}
