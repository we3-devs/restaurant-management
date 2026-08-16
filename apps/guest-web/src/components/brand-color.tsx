"use client";

import { useEffect } from "react";
import { applyBrandColor } from "@rms/api-client/apply-brand-color";
import { useBranding } from "@/hooks/use-branding";

/**
 * Guest-web's counterpart to @rms/api-client's BrandColor. Same effect, but
 * bound to the local branding hook, which fetches the backend directly instead
 * of via the staff apps' /api/backend proxy.
 */
export function BrandColor() {
  const { primaryColor } = useBranding();

  useEffect(() => {
    applyBrandColor(primaryColor);
  }, [primaryColor]);

  return null;
}
