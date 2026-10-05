import { describe, expect, test } from "bun:test";
import { findMatches, findMatchingLines, stepMatch } from "@/src/domain/help-search";
import { builtInPlugins } from "@/src/plugins/builtins";
import { PluginRegistry } from "@/src/plugins/registry";
import { clipVisible, getVisibleWidth, highlightVisibleRanges, stripAnsi } from "@/src/presentation/ansi-text";
import { HelpBrowser, type HelpTerminal } from "@/src/presentation/help-browser";
import { buildHelpDocument, type HelpLine } from "@/src/presentation/help-document";

const ESCAPE = "\u001B";
const GREEN = `${ESCAPE}[32m`;
const RESET = `${ESCAPE}[0m`;

describe("ansi text", () => {
  test("strip and measure ignore escapes", () => {
    expect(stripAnsi(`${GREEN}todo${RESET} add`)).toBe("todo add");
    expect(getVisibleWidth(`${GREEN}todo${RESET} add`)).toBe(8);
  });

  test("clipping counts visible characters and keeps the escapes it passed", () => {
    const clipped = clipVisible(`${GREEN}todo add task${RESET}`, 7);
    expect(stripAnsi(clipped)).toBe("todo ad");
    expect(clipped.startsWith(GREEN)).toBe(true);
    expect(clipVisible("short", 40)).toBe("short");
    expect(clipVisible("short", 0)).toBe("");
  });

  test("highlighting wraps visible columns without dropping surrounding colors", () => {
    const highlighted = highlightVisibleRanges(`${GREEN}todo add${RESET}`, [{ start: 5, end: 8 }], "<on>", "<off>");
    expect(stripAnsi(highlighted)).toBe("todo <on>add<off>");
    expect(highlighted).toContain(GREEN);
    expect(highlighted).toContain(RESET);
  });

  test("a range can carry its own codes", () => {
    const highlighted = highlightVisibleRanges("aXbXc", [{ start: 1, end: 2 }, { start: 3, end: 4, on: "<cur>", off: "</cur>" }], "<on>", "<off>");
    expect(highlighted).toBe("a<on>X<off>b<cur>X</cur>c");
  });
});

describe("help search", () => {
  const lines = ["todo add task", "todo done <id>", "add another add"];

  test("finds every occurrence, case-insensitively, in document order", () => {
    expect(findMatches(lines, "ADD")).toEqual([
      { line: 0, start: 5, end: 8 },
      { line: 2, start: 0, end: 3 },
      { line: 2, start: 12, end: 15 },
    ]);
    expect(findMatches(lines, "   ")).toEqual([]);
  });

  test("matching lines are unique", () => {
    expect(findMatchingLines(lines, "add")).toEqual([0, 2]);
  });

  test("stepping wraps in both directions and reports nothing to step through", () => {
    expect(stepMatch(0, 3, 1)).toBe(1);
    expect(stepMatch(2, 3, 1)).toBe(0);
    expect(stepMatch(0, 3, -1)).toBe(2);
    expect(stepMatch(-1, 3, 1)).toBe(0);
    expect(stepMatch(-1, 0, 1)).toBe(-1);
  });
});

describe("help document", () => {
  const registry = new PluginRegistry();
  for (const plugin of builtInPlugins) registry.use(plugin);
  const document = buildHelpDocument(registry.listCommands(), false);
  const text = document.map((line) => line.plain).join("\n");

  test("holds the overview and every command's own help", () => {
    expect(text).toContain("USAGE");
    expect(text).toContain("EPIC VISIBILITY");
    expect(text).toContain("todo add  ·");
    expect(text).toContain("todo toggle  ·");
    expect(text).toContain("--due <time>");
  });

  test("plain text carries no escapes and blank runs are collapsed", () => {
    expect(text).not.toContain(ESCAPE);
    expect(text).not.toContain("\n\n\n");
  });
});

describe("help browser", () => {
  const terminal: HelpTerminal = { write: () => {}, columns: 100, rows: 20 };
  const BODY_HEIGHT = 16;

  function createDocument(): HelpLine[] {
    const lines = ["OVERVIEW", "", "  todo add <description>", "  todo done <id>"];
    for (let index = 0; index < 40; index += 1) lines.push(`  filler line ${index}`);
    lines.push("  todo snooze <id> <time>", "  add one more due date");
    return lines.map((text) => ({ text, plain: text }));
  }

  function createBrowser(): HelpBrowser {
    return new HelpBrowser(createDocument(), terminal);
  }

  function frame(browser: HelpBrowser): string[] {
    return browser.render().split("\n").map(stripAnsi);
  }

  function header(browser: HelpBrowser): string {
    return frame(browser).slice(0, 3).join("\n");
  }

  function body(browser: HelpBrowser): string[] {
    return frame(browser).slice(3, 3 + BODY_HEIGHT);
  }

  function type(browser: HelpBrowser, text: string): void {
    for (const character of text) browser.handleKey({ sequence: character, name: character });
  }

  test("the sticky bar and footer frame a scrolling body", () => {
    const browser = createBrowser();
    expect(header(browser)).toContain("todo help");
    expect(header(browser)).toContain("/ to search");
    expect(body(browser)[0]).toBe("OVERVIEW");
    expect(frame(browser)).toHaveLength(3 + BODY_HEIGHT + 1);
    expect(frame(browser).at(-1)).toContain("q quit");
  });

  test("j, k and the arrow keys scroll one line at a time", () => {
    const browser = createBrowser();
    browser.handleKey({ sequence: "j", name: "j" });
    expect(body(browser)[0]).toBe("");
    browser.handleKey({ name: "down" });
    expect(body(browser)[0]).toBe("  todo add <description>");
    browser.handleKey({ sequence: "k", name: "k" });
    browser.handleKey({ name: "up" });
    expect(body(browser)[0]).toBe("OVERVIEW");
    expect(header(browser)).toContain("todo help");
  });

  test("paging, g and G move in larger steps and stay in range", () => {
    const browser = createBrowser();
    browser.handleKey({ ctrl: true, name: "d" });
    expect(body(browser)[0]).toBe("  filler line 4");
    browser.handleKey({ ctrl: true, name: "u" });
    expect(body(browser)[0]).toBe("OVERVIEW");
    browser.handleKey({ sequence: "G", name: "g" });
    expect(body(browser).at(-1)).toBe("  add one more due date");
    browser.handleKey({ sequence: "g", name: "g" });
    expect(body(browser)[0]).toBe("OVERVIEW");
    browser.handleKey({ name: "pageup" });
    expect(body(browser)[0]).toBe("OVERVIEW");
  });

  test("/ focuses the search bar and typing filters the body live", () => {
    const browser = createBrowser();
    browser.handleKey({ sequence: "/", name: "/" });
    expect(header(browser)).toContain("type to filter");

    type(browser, "<id>");
    expect(header(browser)).toContain("/ <id>");
    expect(header(browser)).toContain("2 matching lines");
    expect(body(browser).filter((line) => line.length > 0)).toEqual(["  todo done <id>", "  todo snooze <id> <time>"]);

    browser.handleKey({ name: "backspace" });
    expect(header(browser)).toContain("/ <id");
    expect(header(browser)).toContain("2 matching lines");
  });

  test("Enter restores the full document, jumps to the first match and counts them", () => {
    const browser = createBrowser();
    browser.handleKey({ sequence: "/", name: "/" });
    type(browser, "todo");
    browser.handleKey({ name: "return" });

    expect(header(browser)).toContain("1/3 matches");
    expect(header(browser)).toContain("n next · N previous");
    expect(body(browser)).toContain("  filler line 0");
    expect(body(browser)).toContain("  todo add <description>");
  });

  test("n and N step through the matches and wrap around", () => {
    const browser = createBrowser();
    browser.handleKey({ sequence: "/", name: "/" });
    type(browser, "todo");
    browser.handleKey({ name: "return" });

    browser.handleKey({ sequence: "n", name: "n" });
    expect(header(browser)).toContain("2/3 matches");
    browser.handleKey({ sequence: "n", name: "n" });
    expect(header(browser)).toContain("3/3 matches");
    expect(body(browser)).toContain("  todo snooze <id> <time>");
    browser.handleKey({ sequence: "n", name: "n" });
    expect(header(browser)).toContain("1/3 matches");
    browser.handleKey({ sequence: "N", name: "n" });
    expect(header(browser)).toContain("3/3 matches");
  });

  test("the current match is styled apart from the other matches", () => {
    const browser = createBrowser();
    browser.handleKey({ sequence: "/", name: "/" });
    type(browser, "todo");
    browser.handleKey({ name: "return" });

    const rendered = browser.render();
    expect(rendered).toContain(`${ESCAPE}[48;5;208m`);
    expect(rendered).toContain(`${ESCAPE}[48;5;238m`);
  });

  test("a query with no matches reports zero without moving the view", () => {
    const browser = createBrowser();
    browser.handleKey({ sequence: "j", name: "j" });
    browser.handleKey({ sequence: "/", name: "/" });
    type(browser, "nothinghere");
    browser.handleKey({ name: "return" });

    expect(header(browser)).toContain("0/0 matches");
    expect(body(browser)[0]).toBe("");
    browser.handleKey({ sequence: "n", name: "n" });
    expect(header(browser)).toContain("0/0 matches");
  });

  test("letters that are commands in browse mode are plain text while searching", () => {
    const browser = createBrowser();
    browser.handleKey({ sequence: "/", name: "/" });
    type(browser, "njgq");
    expect(header(browser)).toContain("/ njgq");
    expect(browser.closed).toBe(false);
  });

  test("Escape cancels the search, then clears a committed query", () => {
    const browser = createBrowser();
    browser.handleKey({ sequence: "j", name: "j" });
    browser.handleKey({ sequence: "/", name: "/" });
    type(browser, "todo");
    browser.handleKey({ name: "escape" });
    expect(body(browser)[0]).toBe("");
    expect(header(browser)).toContain("/ to search");

    browser.handleKey({ sequence: "/", name: "/" });
    type(browser, "todo");
    browser.handleKey({ name: "return" });
    browser.handleKey({ name: "escape" });
    expect(header(browser)).toContain("/ to search");
    expect(browser.closed).toBe(false);
  });

  test("q, Escape without a query and Ctrl+C close the browser", () => {
    const quit = createBrowser();
    quit.handleKey({ sequence: "q", name: "q" });
    expect(quit.closed).toBe(true);

    const escaped = createBrowser();
    escaped.handleKey({ name: "escape" });
    expect(escaped.closed).toBe(true);

    const interrupted = createBrowser();
    interrupted.handleKey({ ctrl: true, name: "c" });
    expect(interrupted.closed).toBe(true);
  });

  test("a tiny terminal still renders a usable frame", () => {
    const small = new HelpBrowser(createDocument(), { write: () => {}, columns: 20, rows: 6 });
    const lines = small.render().split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(5);
    for (const line of lines) expect(getVisibleWidth(line)).toBeLessThanOrEqual(40);
  });
});
