"use client";

import { getLocationPermissionSteps } from "@/lib/location-permission-help";

/** Numbered, device-aware steps for re-enabling a denied location permission. */
export function LocationPermissionHelp() {
  const steps = getLocationPermissionSteps();
  return (
    <ol className="space-y-1.5">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-1.5">
          <span className="font-semibold">{index + 1}.</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
