import { useEffect, useState } from "react";

/**
 * Manages the application zoom level and keyboard shortcuts.
 *
 * @example
 * function Settings() {
 *   const { decrease, increase, zoom } = useZoom();
 *
 *   return (
 *     <div>
 *       <button onClick={decrease}>-</button>
 *       <span>{Math.round(zoom * 100)}%</span>
 *       <button onClick={increase}>+</button>
 *     </div>
 *   );
 * }
 */
export function useZoom(): UseZoomResult {
  const [zoom, setZoom] = useState(() => readStoredZoom());

  function increase(): void {
    setZoom((currentZoom) => clampZoom(currentZoom + ZOOM_STEP));
  }

  function decrease(): void {
    setZoom((currentZoom) => clampZoom(currentZoom - ZOOM_STEP));
  }

  function reset(): void {
    setZoom(DEFAULT_ZOOM);
  }

  useEffect(() => {
    document.body.style.setProperty("zoom", String(zoom));
    window.localStorage.setItem(STORAGE_KEY, String(zoom));
  }, [zoom]);

  useEffect(() => {
    function applyZoomDelta(delta: number): void {
      setZoom((currentZoom) => clampZoom(currentZoom + delta));
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      if (event.key === "0") {
        event.preventDefault();
        reset();
        return;
      }

      const delta = getKeyboardZoomDelta(event.key);

      if (delta === null) {
        return;
      }

      event.preventDefault();
      applyZoomDelta(delta);
    }

    function handleWheel(event: WheelEvent): void {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      event.preventDefault();
      applyZoomDelta(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheel);
    };
  }, []);

  return { decrease, increase, reset, zoom };
}

const DEFAULT_ZOOM = 1;
const MAX_ZOOM = 2.2;
const MIN_ZOOM = 0.6;
const STORAGE_KEY = "dotfiles-studio:zoom";
const ZOOM_STEP = 0.1;

export type UseZoomResult = {
  decrease: () => void;
  increase: () => void;
  reset: () => void;
  zoom: number;
};

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
}

function readStoredZoom(): number {
  const storedZoom = window.localStorage.getItem(STORAGE_KEY);
  const parsedZoom = Number.parseFloat(storedZoom ?? "");

  return Number.isFinite(parsedZoom) ? clampZoom(parsedZoom) : DEFAULT_ZOOM;
}

function getKeyboardZoomDelta(key: string): number | null {
  if (key === "=" || key === "+") {
    return ZOOM_STEP;
  }

  if (key === "-" || key === "_") {
    return -ZOOM_STEP;
  }

  return null;
}
