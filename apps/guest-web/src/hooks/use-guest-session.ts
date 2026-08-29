"use client";

import { useEffect, useState } from "react";

/**
 * Manages guest table session — locks the table after initial QR scan.
 * Prevents guests from manipulating the URL to access other tables.
 */
export function useGuestSession() {
  const [tableCode, setTableCode] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Extract table from URL on mount
    const params = new URLSearchParams(window.location.search);
    const urlTableCode = params.get("table");

    // Check sessionStorage for locked table
    const storedTable = sessionStorage.getItem("guest_table");

    if (storedTable) {
      // Table already locked from QR scan
      setTableCode(storedTable);
      setIsLocked(true);

      // If URL has a different table, replace it
      if (urlTableCode && urlTableCode !== storedTable) {
        window.history.replaceState({}, "", `/menu?table=${storedTable}`);
      }
    } else if (urlTableCode) {
      // New QR scan — lock this table
      sessionStorage.setItem("guest_table", urlTableCode);
      setTableCode(urlTableCode);
      setIsLocked(true);
    }

    setIsReady(true);
  }, []);

  const clear = () => {
    sessionStorage.removeItem("guest_table");
    setTableCode(null);
    setIsLocked(false);
  };

  return {
    tableCode,
    isLocked,
    isReady,
    clear,
  };
}
