import { DEFAULT_CONFIG, type PanelBoards } from "./task";
import { UnknownTokenError } from "./unknown-token-error";

export const PANEL_BOARDS: PanelBoards[] = ["active", "all"];

/** Parses a user supplied panel-boards value. */
export function parsePanelBoards(value: string): PanelBoards {
  const normalized = value.trim().toLowerCase();
  const boards = PANEL_BOARDS.find((candidate) => candidate === normalized);
  if (boards === undefined) {
    throw new UnknownTokenError(`Unknown value for panel-boards: ${value}`, value, PANEL_BOARDS, "value");
  }
  return boards;
}

/** Falls back to the default when a stored config value was hand edited into something unusable. */
export function normalizePanelBoards(value: unknown): PanelBoards {
  return PANEL_BOARDS.find((candidate) => candidate === value) ?? DEFAULT_CONFIG.panelBoards;
}
