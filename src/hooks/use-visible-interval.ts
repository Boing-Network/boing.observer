"use client";

import { useEffect, useRef } from "react";

/**
 * Like setInterval, but pauses while the document is hidden and runs once
 * when the tab becomes visible again (catch-up refresh).
 */
export function useVisibleInterval(callback: () => void, delayMs: number | null): void {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (delayMs == null || delayMs <= 0) return;

    let id: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      saved.current();
    };

    const start = () => {
      if (id != null) return;
      id = setInterval(tick, delayMs);
    };

    const stop = () => {
      if (id == null) return;
      clearInterval(id);
      id = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        stop();
        return;
      }
      saved.current();
      start();
    };

    if (typeof document === "undefined" || document.visibilityState !== "hidden") {
      start();
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [delayMs]);
}
