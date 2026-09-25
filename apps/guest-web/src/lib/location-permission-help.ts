/**
 * Once a guest has explicitly denied location for this site, the browser
 * blocks any further getCurrentPosition() call instantly with no dialog —
 * there's no JS API to re-trigger that prompt. The only way out is the
 * browser's own site-settings UI, and most guests have never opened it, so
 * this gives them exact steps instead of a vague "check your settings".
 */
export function getLocationPermissionSteps(): string[] {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isChrome = /Chrome/.test(ua) && !/Edg|OPR/.test(ua);
  const isFirefox = /Firefox/.test(ua);
  const isSafari = /Safari/.test(ua) && !isChrome && !isAndroid;

  if (isIOS && isSafari) {
    return [
      "Open the Settings app on your phone",
      "Scroll down to Safari, then tap Location",
      "Choose \"Allow\" (or \"Ask Next Time\")",
      "Come back to this page and reload it",
    ];
  }
  if (isAndroid && isChrome) {
    return [
      "Tap the icon just left of the address bar at the top",
      "Tap \"Permissions\" (or \"Site settings\")",
      "Tap \"Location\" and choose \"Allow\"",
      "Reload this page and try again",
    ];
  }
  if (isFirefox) {
    return [
      "Tap the lock icon next to the address bar",
      "Turn on the \"Access Your Location\" permission for this site",
      "Reload this page and try again",
    ];
  }
  return [
    "Click the lock or site-info icon next to the address bar",
    "Find \"Location\" in the site's permissions and set it to \"Allow\"",
    "Reload this page and try again",
  ];
}
