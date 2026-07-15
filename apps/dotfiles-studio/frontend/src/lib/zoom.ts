import { useEffect, useState } from "react";

const STORAGE_KEY = "dotfiles-studio:zoom";
const MIN = 0.6;
const MAX = 2.2;
const STEP = 0.1;

function clamp(level: number): number {
  return Math.min(MAX, Math.max(MIN, Math.round(level * 100) / 100));
}

function readStored(): number {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? Number.parseFloat(raw) : NaN;
  return Number.isFinite(parsed) ? clamp(parsed) : 1;
}

/**
 * Scales the whole UI with Ctrl +/- (and Ctrl+scroll), Ctrl+0 to reset.
 * Uses the CSS `zoom` property rather than a transform so layout reflows
 * instead of being visually squashed, and persists the level across launches.
 */
export function useZoom(): number {
  const [zoom, setZoom] = useState(readStored);

  useEffect(() => {
    document.body.style.setProperty("zoom", String(zoom));
    window.localStorage.setItem(STORAGE_KEY, String(zoom));
  }, [zoom]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;

      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setZoom((z) => clamp(z + STEP));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setZoom((z) => clamp(z - STEP));
      } else if (e.key === "0") {
        e.preventDefault();
        setZoom(1);
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => clamp(z + (e.deltaY < 0 ? STEP : -STEP)));
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("wheel", onWheel);
    };
  }, []);

  return zoom;
}
