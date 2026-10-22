import { DEFAULT_CONFIG, type PanelLayout } from "./task";
import { UnknownTokenError } from "./unknown-token-error";

export const PANEL_LAYOUTS: PanelLayout[] = ["auto", "side", "stack"];

/** Parses a user supplied panel layout. */
export function parsePanelLayout(value: string): PanelLayout {
  const normalized = value.trim().toLowerCase();
  const layout = PANEL_LAYOUTS.find((candidate) => candidate === normalized);
  if (layout === undefined) {
    throw new UnknownTokenError(`Unknown value for panel-layout: ${value}`, value, PANEL_LAYOUTS, "value");
  }
  return layout;
}

/** Falls back to the default when a stored config value was hand edited into something unusable. */
export function normalizePanelLayout(value: unknown): PanelLayout {
  return PANEL_LAYOUTS.find((candidate) => candidate === value) ?? DEFAULT_CONFIG.panelLayout;
}
