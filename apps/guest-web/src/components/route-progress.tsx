"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Local port of @rms/ui/route-progress — guest-web has no @rms/ui dependency,
 * and the bar is small enough to keep self-contained. Same behaviour: a 2px
 * top bar that starts on same-origin <a> clicks / history.pushState and
 * finishes when usePathname changes. Mount once in the root layout.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const prevPathnameRef = useRef(pathname);
  const reduceMotionRef = useRef(false);

  function clearTimers() {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }

  function start() {
    if (rafRef.current !== null) return;
    clearTimers();
    setActive(true);

    if (reduceMotionRef.current) {
      setProgress(80);
      return;
    }

    let p = 0;
    setProgress(0);
    const tick = () => {
      p = p + (80 - p) * 0.06;
      if (p >= 79.5) {
        rafRef.current = null;
        setProgress(80);
        return;
      }
      setProgress(p);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function finish() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setProgress(100);
    const t = setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 250);
    timersRef.current.push(t);
  }

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotionRef.current = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      reduceMotionRef.current = e.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    function isSameOriginDifferentPath(href: string) {
      try {
        const url = new URL(href, window.location.href);
        return (
          url.origin === window.location.origin &&
          url.pathname + url.search !==
            window.location.pathname + window.location.search
        );
      } catch {
        return false;
      }
    }

    function onClick(e: MouseEvent) {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const target = e.target as HTMLElement;
      const anchor = target.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        href.startsWith("#")
      )
        return;
      if (isSameOriginDifferentPath(href)) start();
    }

    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    history.pushState = function patchedPush(...args) {
      const result = originalPush.apply(this, args);
      start();
      return result;
    };
    history.replaceState = function patchedReplace(...args) {
      const result = originalReplace.apply(this, args);
      start();
      return result;
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      history.pushState = originalPush;
      history.replaceState = originalReplace;
    };
  }, []);

  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      finish();
    }
  }, [pathname]);

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(finish, 10_000);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 bg-brand-600 transition-opacity duration-200 ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="h-full bg-brand-600" style={{ width: `${progress}%` }} />
    </div>
  );
}
