// src/hooks/use-scroll-trigger.ts
//
// Fires a callback once the user has scrolled past a given fraction of the
// page (or a target element). Used to auto-open the paywall when the reader
// gets ~1/3 of the way down the article.

import { useEffect, useRef } from "react";

type TOptions = {
  // Fraction of scrollable distance (0..1) at which to trigger. Default 1/3.
  threshold?: number;
  // Optional element to measure instead of the whole document.
  targetRef?: React.RefObject<HTMLElement | null>;
  // If false, the hook does nothing (e.g. user already authenticated).
  enabled?: boolean;
  // Fire only once. Default true.
  once?: boolean;
};

export function useScrollTrigger(
  onTrigger: () => void,
  { threshold = 1 / 3, targetRef, enabled = true, once = true }: TOptions = {}
) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    function computeProgress(): number {
      if (targetRef?.current) {
        const el = targetRef.current;
        const rect = el.getBoundingClientRect();
        const viewport = window.innerHeight || document.documentElement.clientHeight;
        const total = rect.height - viewport;
        if (total <= 0) return 1; // shorter than the viewport — count as read
        const scrolled = -rect.top;
        return Math.min(Math.max(scrolled / total, 0), 1);
      }

      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const total = doc.scrollHeight - window.innerHeight;
      if (total <= 0) return 0;
      return Math.min(Math.max(scrollTop / total, 0), 1);
    }

    function onScroll() {
      if (firedRef.current && once) return;
      if (computeProgress() >= threshold) {
        firedRef.current = true;
        onTrigger();
        if (once) {
          window.removeEventListener("scroll", onScroll);
        }
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    // Check immediately in case the page is already scrolled / very short.
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, [onTrigger, threshold, targetRef, enabled, once]);
}
