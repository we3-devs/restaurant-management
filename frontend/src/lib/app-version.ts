/**
 * Bump this alongside `CACHE_VERSION` in public/sw.js on any deploy that
 * changes staff-PWA code — sw.js caches JS chunks cache-first, so without a
 * version bump (which flushes the old cache on activate) installed PWA
 * clients keep running stale code indefinitely. Shown on the staff profile
 * page so a stale device is visible at a glance instead of discovered the
 * hard way.
 */
export const APP_VERSION = "2"
