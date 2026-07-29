const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** Parses simple durations like "15m", "7d", "1h" (as used by JWT_*_EXPIRES_IN) into milliseconds. */
export function parseDurationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) {
    throw new Error(
      `Invalid duration format: "${duration}". Expected e.g. "15m", "7d".`,
    );
  }
  const [, amount, unit] = match;
  return parseInt(amount, 10) * UNIT_MS[unit];
}
