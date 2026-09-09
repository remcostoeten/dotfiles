import { findMatches, findMatchingLines, matchesOnLine, stepMatch, type SearchMatch } from "../domain/help-search";
import { clipVisible, getVisibleWidth, highlightVisibleRanges, type VisibleRange } from "./ansi-text";
import type { HelpLine } from "./help-document";

const RESET = "\u001B[0m";
const DIM = "\u001B[2m";
const BOLD = "\u001B[1m";
const ACCENT = "\u001B[38;5;208m";
const HEADING = "\u001B[38;5;147m";
const MATCH_ON = "\u001B[48;5;238m";
const MATCH_OFF = "\u001B[49m";
const CURRENT_ON = "\u001B[48;5;208m\u001B[38;5;232m";
const CURRENT_OFF = "\u001B[49m\u001B[39m";

const HEADER_HEIGHT = 3;
const FOOTER_HEIGHT = 1;

export interface HelpTerminal {
  write(text: string): void;
  readonly columns: number;
  readonly rows: number;
}

export interface HelpKey {
  name?: string;
  sequence?: string;
  ctrl?: boolean;
}

type Mode = "browse" | "search";

/**
 * Keyboard-driven pager for the help text: a sticky search bar, a scrolling body, and `n`/`N` match
 * stepping. Holds no terminal state of its own so it can be driven straight from tests.
 */
export class HelpBrowser {
  private mode: Mode = "browse";
  private offset = 0;
  private savedOffset = 0;
  private query = "";
  private draft = "";
  private matches: SearchMatch[] = [];
  private matchIndex = -1;
  private done = false;

  constructor(private readonly lines: ReadonlyArray<HelpLine>, private readonly terminal: HelpTerminal) {}

  get closed(): boolean {
    return this.done;
  }

  handleKey(key: HelpKey): void {
    if (key.ctrl === true && key.name === "c") {
      this.done = true;
      return;
    }
    if (this.mode === "search") this.handleSearchKey(key);
    else this.handleBrowseKey(key);
  }

  render(): string {
    const width = Math.max(40, this.terminal.columns);
    const body = this.visibleLines();
    const height = this.bodyHeight;
    this.offset = clamp(this.offset, 0, Math.max(0, body.length - height));
    const window = body.slice(this.offset, this.offset + height);

    const lines = [...this.renderHeader(width, body.length)];
    for (const index of window) lines.push(this.renderLine(index, width));
    for (let filler = window.length; filler < height; filler += 1) lines.push("");
    lines.push(this.renderFooter(width));
    return lines.join("\n");
  }

  /** Line indices of the document the body currently shows: filtered while typing, complete otherwise. */
  private visibleLines(): number[] {
    if (this.mode === "search" && this.draft.trim().length > 0) {
      return findMatchingLines(this.lines.map((line) => line.plain), this.draft);
    }
    return this.lines.map((_line, index) => index);
  }

  private get bodyHeight(): number {
    return Math.max(1, Math.max(8, this.terminal.rows) - HEADER_HEIGHT - FOOTER_HEIGHT);
  }

  private handleBrowseKey(key: HelpKey): void {
    const half = Math.max(1, Math.floor(this.bodyHeight / 2));

    if (key.sequence === "/") {
      this.mode = "search";
      this.savedOffset = this.offset;
      this.draft = "";
      this.offset = 0;
      return;
    }
    if (key.sequence === "n" || isEnter(key)) return this.stepToMatch(1);
    if (key.sequence === "N") return this.stepToMatch(-1);
    if (key.sequence === "q" || (key.name === "escape" && this.query.length === 0)) {
      this.done = true;
      return;
    }
    if (key.name === "escape") {
      this.clearSearch();
      return;
    }
    if (key.sequence === "j" || key.name === "down") this.scroll(1);
    else if (key.sequence === "k" || key.name === "up") this.scroll(-1);
    else if (key.ctrl === true && key.name === "d") this.scroll(half);
    else if (key.ctrl === true && key.name === "u") this.scroll(-half);
    else if (key.name === "pagedown" || key.name === "space" || key.sequence === " ") this.scroll(this.bodyHeight);
    else if (key.name === "pageup" || key.sequence === "b") this.scroll(-this.bodyHeight);
    else if (key.sequence === "g" || key.name === "home") this.offset = 0;
    else if (key.sequence === "G" || key.name === "end") this.offset = Number.MAX_SAFE_INTEGER;
  }

  private handleSearchKey(key: HelpKey): void {
    if (isEnter(key)) {
      this.commitSearch();
      return;
    }
    if (key.name === "escape") {
      this.mode = "browse";
      this.draft = "";
      this.offset = this.savedOffset;
      return;
    }
    if (key.name === "backspace") {
      this.draft = this.draft.slice(0, -1);
      this.offset = 0;
      return;
    }
    if (key.ctrl === true && key.name === "u") {
      this.draft = "";
      this.offset = 0;
      return;
    }
    if (key.ctrl !== true && key.sequence !== undefined && key.sequence.length === 1 && key.sequence >= " ") {
      this.draft += key.sequence;
      this.offset = 0;
    }
  }

  private commitSearch(): void {
    this.query = this.draft.trim();
    this.matches = findMatches(this.lines.map((line) => line.plain), this.query);
    this.mode = "browse";
    this.draft = "";
    if (this.matches.length === 0) {
      this.matchIndex = -1;
      this.offset = this.savedOffset;
      return;
    }
    this.matchIndex = 0;
    this.centerOn(this.matches[0]!.line);
  }

  private clearSearch(): void {
    this.query = "";
    this.matches = [];
    this.matchIndex = -1;
  }

  private stepToMatch(direction: 1 | -1): void {
    const next = stepMatch(this.matchIndex, this.matches.length, direction);
    if (next === -1) return;
    this.matchIndex = next;
    this.centerOn(this.matches[next]!.line);
  }

  private centerOn(line: number): void {
    this.offset = Math.max(0, line - Math.floor(this.bodyHeight / 2));
  }

  private scroll(amount: number): void {
    this.offset = Math.max(0, this.offset + amount);
  }

  private renderHeader(width: number, bodyLength: number): string[] {
    const counter = `${HEADING}${this.counterText(bodyLength)}${RESET}`;
    const name = `${ACCENT}${BOLD}✓ todo help${RESET}`;
    const subtitle = `  ${DIM}·  searchable command reference${RESET}`;
    const title = getVisibleWidth(name) + getVisibleWidth(subtitle) + getVisibleWidth(counter) + 6 <= width ? `${name}${subtitle}` : name;
    return [
      clipVisible(padBetween(`  ${title}`, `${counter}  `, width), width),
      clipVisible(`  ${this.renderSearchBar()}`, width),
      `${DIM}${"─".repeat(width)}${RESET}`,
    ];
  }

  private renderSearchBar(): string {
    if (this.mode === "search") return `${HEADING}/${RESET} ${this.draft}${BOLD}▏${RESET}`;
    if (this.query.length > 0) return `${HEADING}/${RESET} ${this.query}   ${DIM}n next · N previous · Esc clear${RESET}`;
    return `${DIM}/ to search · j k ↑ ↓ to scroll${RESET}`;
  }

  private counterText(bodyLength: number): string {
    if (this.mode === "search") {
      if (this.draft.trim().length === 0) return "type to filter";
      return bodyLength === 1 ? "1 matching line" : `${bodyLength} matching lines`;
    }
    if (this.query.length > 0) {
      if (this.matches.length === 0) return `0/0 matches for "${this.query}"`;
      return `${this.matchIndex + 1}/${this.matches.length} matches`;
    }
    const last = Math.min(bodyLength, this.offset + this.bodyHeight);
    return `${last}/${bodyLength} lines`;
  }

  private renderFooter(width: number): string {
    const options = this.mode === "search"
      ? [["Enter search", "Esc cancel", "^u clear"], ["Enter search", "Esc cancel"]]
      : [["j k ↑ ↓ scroll", "^d ^u page", "g G ends", "/ search", "n N matches", "q quit"], ["j k scroll", "/ search", "n N matches", "q quit"], ["/ search", "q quit"]];
    const hints = options.find((candidate) => candidate.join(" · ").length + 2 <= width) ?? options[options.length - 1]!;
    return clipVisible(`${DIM}  ${hints.join(" · ")}${RESET}`, width);
  }

  private renderLine(index: number, width: number): string {
    const line = this.lines[index];
    if (line === undefined) return "";
    const needle = this.mode === "search" ? this.draft : this.query;
    if (needle.trim().length === 0) return clipVisible(line.text, width);

    const current = this.matches[this.matchIndex];
    const ranges: VisibleRange[] = matchesOnLine(findMatches([line.plain], needle), 0).map((match) => ({
      start: match.start,
      end: match.end,
      ...(current !== undefined && current.line === index && current.start === match.start
        ? { on: CURRENT_ON, off: CURRENT_OFF }
        : {}),
    }));
    return clipVisible(highlightVisibleRanges(line.text, ranges, MATCH_ON, MATCH_OFF), width);
  }
}

function isEnter(key: HelpKey): boolean {
  return key.name === "return" || key.name === "enter";
}

function padBetween(left: string, right: string, width: number): string {
  const padding = " ".repeat(Math.max(1, width - getVisibleWidth(left) - getVisibleWidth(right)));
  return `${left}${padding}${right}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}
