"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

/**
 * Manages guest table session — locks the table after initial QR scan.
 * Prevents guests from manipulating the URL to access other tables.
 */
export function useGuestSession() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTableCode = searchParams.get("table");

  const [tableCode, setTableCode] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    // On first load, check sessionStorage for locked table
    const storedTable = sessionStorage.getItem("guest_table");

    if (storedTable) {
      // Table already locked from QR scan
      setTableCode(storedTable);
      setIsLocked(true);

      // If URL has a different table, redirect to the locked one
      if (urlTableCode && urlTableCode !== storedTable) {
        router.replace(`/menu?table=${storedTable}`);
      }
    } else if (urlTableCode) {
      // New QR scan — lock this table
      sessionStorage.setItem("guest_table", urlTableCode);
      setTableCode(urlTableCode);
      setIsLocked(true);
    }
  }, [urlTableCode, router]);

  const clear = () => {
    sessionStorage.removeItem("guest_table");
    setTableCode(null);
    setIsLocked(false);
  };

  return {
    tableCode,
    isLocked,
    clear,
  };
}
