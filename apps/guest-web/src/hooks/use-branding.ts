"use client";

import { useQuery } from "@tanstack/react-query";
import { EMPTY_BRANDING, type Branding } from "@rms/api-client/branding";
import { getJson } from "@/lib/api";

/**
 * Client-side branding for the menu header.
 *
 * Has its own implementation rather than reusing @rms/api-client's hook: that
 * one routes through the staff apps' same-origin /api/backend proxy, which
 * guest-web doesn't have — it calls the backend directly.
 */
export function useBranding(): Branding {
  const { data } = useQuery<Branding>({
    queryKey: ["branding"],
    queryFn: () => getJson("/settings/branding/public"),
    staleTime: 30 * 1000,
  });

  return data ?? EMPTY_BRANDING;
}
