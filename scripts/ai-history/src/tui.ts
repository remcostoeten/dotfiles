import { spawnSync } from "node:child_process";
import { applyFilters, fuzzyFilter, type TFilters } from "./filter";
import {
  bold,
  cyan,
  dim,
  formatCost,
  formatDate,
  formatDuration,
  formatLines,
  green,
  invert,
  magenta,
  pad,
  resumeCommand,
  shellQuote,
  stripAnsi,
  truncate,
  white,
  yellow,
} from "./format";
import { noop } from "./noop";
import { renderRow } from "./report";
import { loadTranscript } from "./transcript";
import type { TSession, TTranscriptEntry } from "./types";

type TView = "list" | "detail" | "help";

type TState = {
  base: TSession[];
  visible: TSession[];
  query: string;
  searching: boolean;
  cursor: number;
  scroll: number;
  view: TView;
  detail: TTranscriptEntry[] | null;
  detailScroll: number;
  expandTools: boolean;
  status: string;
  armed: boolean;
  quit: boolean;
  handoff: string | null;
};

const HELP_LINES = [
  "  ai-history opens in filter mode: everything you type filters, live.",
  "  esc clears the filter, then drops to browse mode, then quits.",
  "",
  "  navigation            (both modes)",
  "    ↑ ↓ ctrl-p ctrl-n     move            pgup pgdn ctrl-u ctrl-d   page",
  "    enter                 open the detail view",
  "    esc                   detail → list, filter → browse, browse → quit",
  "    ctrl-c                quit from anywhere",
  "",
  "  actions               (both modes)",
  "    ctrl-y                copy the resume command to the clipboard",
  "    ctrl-r                run the resume command — press twice to confirm",
  "    ctrl-o                open the session cwd in $EDITOR",
  "",
  "  browse mode           (after esc; letters become commands)",
  "    / or any letter       back to filter mode",
  "    j k g G               move, top, bottom",
  "    y r o                 copy, resume, editor",
  "    t                     expand / collapse tool calls in the detail view",
  "    q                     quit",
  "    ?                     this help",
];

function write(text: string): void {
  process.stdout.write(text);
}

function enterScreen(): void {
  write("\x1b[?1049h\x1b[?25l");
}

function leaveScreen(): void {
  write("\x1b[?25h\x1b[?1049l");
}

function size(): { rows: number; cols: number } {
  return {
    rows: Math.max(8, process.stdout.rows ?? 24),
    cols: Math.max(30, process.stdout.columns ?? 80),
  };
}

function wrapText(text: string, width: number, indent: string): string[] {
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\t/g, "  ");
    if (line.length === 0) {
      out.push("");
      continue;
    }
    const room = Math.max(8, width - indent.length - 1);
    let rest = line;
    while (rest.length > 0) {
      out.push(indent + rest.slice(0, room));
      rest = rest.slice(room);
    }
  }
  return out;
}

function copyToClipboard(text: string): boolean {
  for (const [command, args] of [
    ["wl-copy", [] as string[]],
    ["xclip", ["-selection", "clipboard"]],
  ] as const) {
    try {
      const result = spawnSync(command, args as string[], { input: text });
      if (result.status === 0 && !result.error) return true;
    } catch {
      noop();
    }
  }
  return false;
}

function recompute(state: TState): void {
  state.visible = fuzzyFilter(state.base, state.query);
  if (state.cursor >= state.visible.length) state.cursor = Math.max(0, state.visible.length - 1);
  if (state.cursor < 0) state.cursor = 0;
}

function detailLines(state: TState, session: TSession, cols: number): string[] {
  const out: string[] = [];
  const label = (key: string, value: string) => `  ${dim(pad(key, 10))} ${value}`;

  out.push(bold(truncate(session.title, cols - 2)));
  out.push("");
  out.push(label("tool", session.tool === "claude" ? magenta("claude") : cyan("codex")));
  out.push(label("id", session.id));
  out.push(label("cwd", truncate(session.cwd || "—", cols - 14)));
  if (session.branch) out.push(label("branch", session.branch));
  if (session.version) out.push(label("version", session.version));
  out.push(label("started", formatDate(session.startedAt)));
  out.push(label("ended", formatDate(session.endedAt)));
  if (session.durationMs) out.push(label("duration", formatDuration(session.durationMs)));
  if (session.costUsd !== null) out.push(label("cost", formatCost(session.costUsd)));
  const lines = formatLines(session.linesAdded, session.linesRemoved);
  if (lines) out.push(label("lines", lines));
  if (session.models.length > 0) out.push(label("models", session.models.join(", ")));
  out.push(label("prompts", String(session.promptCount)));
  out.push(label("resume", resumeCommand(session)));
  if (!session.transcript) {
    out.push("");
    out.push(dim("  no transcript on disk — only the prompt log remains, resume is unavailable"));
  }
  out.push("");
  out.push(dim("─".repeat(Math.max(4, cols - 2))));
  out.push("");

  if (state.detail === null) {
    out.push(dim("  loading transcript…"));
    return out;
  }

  if (state.detail.length === 0 && session.prompts.length > 0) {
    for (const prompt of session.prompts) {
      out.push(green("  ▸ You"));
      out.push(...wrapText(prompt, cols, "    "));
      out.push("");
    }
    return out;
  }

  for (const entry of state.detail) {
    if (entry.kind === "tool") {
      out.push(yellow(`  ⏺ ${truncate(entry.label, cols - 6)}`));
      if (state.expandTools) out.push(...wrapText(entry.text, cols, "      ").slice(0, 40));
      continue;
    }
    if (entry.kind === "result") {
      if (!state.expandTools) continue;
      out.push(...wrapText(entry.text, cols, "      ").slice(0, 20).map(dim));
      continue;
    }
    if (entry.kind === "thinking") {
      if (!state.expandTools) continue;
      out.push(dim("  · thinking"));
      out.push(...wrapText(entry.text, cols, "    ").map(dim));
      out.push("");
      continue;
    }
    if (entry.kind === "meta") {
      out.push(dim(`  ${entry.label}`));
      continue;
    }
    const head = entry.kind === "user" ? green(`  ▸ ${entry.label}`) : white(`  ◂ ${entry.label}`);
    out.push(head);
    out.push(...wrapText(entry.text, cols, "    "));
    out.push("");
  }

  return out;
}

function render(state: TState): void {
  const { rows, cols } = size();
  const body = rows - 2;
  const lines: string[] = [];

  if (state.view === "help") {
    lines.push(bold("  ai-history — keys"));
    lines.push("");
    for (const line of HELP_LINES) lines.push(line);
    lines.push("");
    lines.push(dim("  press any key to go back"));
  } else if (state.view === "detail") {
    const session = state.visible[state.cursor];
    const all = session ? detailLines(state, session, cols) : [dim("  nothing selected")];
    const max = Math.max(0, all.length - body);
    if (state.detailScroll > max) state.detailScroll = max;
    if (state.detailScroll < 0) state.detailScroll = 0;
    lines.push(...all.slice(state.detailScroll, state.detailScroll + body));
  } else {
    if (state.cursor < state.scroll) state.scroll = state.cursor;
    if (state.cursor >= state.scroll + body) state.scroll = state.cursor - body + 1;
    if (state.scroll < 0) state.scroll = 0;

    const slice = state.visible.slice(state.scroll, state.scroll + body);
    slice.forEach((session, offset) => {
      const index = state.scroll + offset;
      const row = renderRow(session, cols - 2);
      lines.push(index === state.cursor ? invert(` ${stripAnsi(row)} `) : ` ${row}`);
    });
    if (state.visible.length === 0) lines.push(dim("  no sessions match"));
  }

  while (lines.length < body) lines.push("");

  const filtering = state.searching && state.view === "list";
  const prompt = filtering ? cyan("/") : dim("/");
  const counter = dim(`${state.visible.length}/${state.base.length}`);
  const hint =
    state.status ||
    dim(
      filtering
        ? "type to filter · enter detail · ctrl-y copy · ctrl-r resume · esc browse"
        : "browse · j k move · enter detail · y copy · r resume · ? help · q quit",
    );
  lines.push(dim("─".repeat(cols)));
  lines.push(truncate(`${prompt}${state.query}${filtering ? "▏" : ""}  ${counter}  ${hint}`, cols));

  write(`\x1b[H\x1b[2J${lines.join("\r\n")}`);
}

function moveCursor(state: TState, delta: number): void {
  if (state.view === "detail") {
    state.detailScroll += delta;
    return;
  }
  state.cursor = Math.min(Math.max(0, state.cursor + delta), Math.max(0, state.visible.length - 1));
}

async function openDetail(state: TState): Promise<void> {
  const session = state.visible[state.cursor];
  if (!session) return;
  state.view = "detail";
  state.detail = null;
  state.detailScroll = 0;
  render(state);
  state.detail = await loadTranscript(session);
  if (state.view === "detail") render(state);
}

function suspendAnd(run: () => void): void {
  process.stdin.setRawMode(false);
  leaveScreen();
  run();
  enterScreen();
  process.stdin.setRawMode(true);
}

function handleAction(state: TState, key: string, wasArmed: boolean): void {
  const session = state.visible[state.cursor];
  if (!session) return;

  if (key === "y") {
    state.status = copyToClipboard(resumeCommand(session))
      ? green(" copied resume command")
      : yellow(" no clipboard tool (wl-copy / xclip) found");
    return;
  }

  if (key === "r") {
    if (!session.transcript) {
      state.status = yellow(" no transcript — this session cannot be resumed");
      return;
    }
    if (!wasArmed) {
      state.armed = true;
      state.status = yellow(` press r again to run: ${resumeCommand(session)}`);
      return;
    }
    state.handoff = resumeCommand(session);
    state.quit = true;
    return;
  }

  if (key === "o") {
    const editor = process.env.EDITOR || process.env.VISUAL;
    if (!editor || !session.cwd) {
      state.status = yellow(" $EDITOR is not set");
      return;
    }
    suspendAnd(() => {
      try {
        spawnSync("/bin/sh", ["-c", `${editor} ${shellQuote(session.cwd)}`], {
          stdio: "inherit",
        });
      } catch {
        noop();
      }
    });
  }
}

function handleKey(state: TState, key: string, onDetail: () => void): void {
  const wasArmed = state.armed;
  state.armed = false;
  state.status = "";

  if (key === "\x03") {
    state.quit = true;
    return;
  }

  if (state.view === "help") {
    state.view = "list";
    return;
  }

  const { rows } = size();
  const page = Math.max(1, rows - 4);

  if (key === "\x1b[A" || key === "\x10") return moveCursor(state, -1);
  if (key === "\x1b[B" || key === "\x0e") return moveCursor(state, 1);
  if (key === "\x1b[5~") return moveCursor(state, -page);
  if (key === "\x1b[6~") return moveCursor(state, page);
  if (key === "\x04") return moveCursor(state, page);
  if (key === "\x15") return moveCursor(state, -page);

  if (key === "\x19") return handleAction(state, "y", wasArmed);
  if (key === "\x12") return handleAction(state, "r", wasArmed);
  if (key === "\x0f") return handleAction(state, "o", wasArmed);

  if (key === "\r" || key === "\n") {
    if (state.view === "list") onDetail();
    return;
  }

  if (key === "\x1b") {
    if (state.view === "detail") {
      state.view = "list";
      state.searching = true;
      return;
    }
    if (state.query.length > 0) {
      state.query = "";
      recompute(state);
      return;
    }
    if (state.searching) {
      state.searching = false;
      return;
    }
    state.quit = true;
    return;
  }

  if (key === "\x7f" || key === "\b") {
    if (state.query.length > 0) {
      state.query = state.query.slice(0, -1);
      recompute(state);
    }
    return;
  }

  if (key === "/") {
    state.searching = true;
    state.view = "list";
    return;
  }

  if (state.searching && state.view === "list") {
    if (key >= " " && key <= "~") {
      state.query += key;
      recompute(state);
    }
    return;
  }

  if (state.view === "detail") {
    if (key === "q") {
      state.view = "list";
      return;
    }
    if (key === "j") return moveCursor(state, 1);
    if (key === "k") return moveCursor(state, -1);
    if (key === " ") return moveCursor(state, page);
    if (key === "g") {
      state.detailScroll = 0;
      return;
    }
    if (key === "G") {
      state.detailScroll = 1_000_000;
      return;
    }
    if (key === "t") {
      state.expandTools = !state.expandTools;
      return;
    }
    if (key === "?") {
      state.view = "help";
      return;
    }
    handleAction(state, key, wasArmed);
    return;
  }

  if (key === "q") {
    state.quit = true;
    return;
  }
  if (key === "?") {
    state.view = "help";
    return;
  }
  if (key === "j") return moveCursor(state, 1);
  if (key === "k") return moveCursor(state, -1);
  if (key === "g") {
    state.cursor = 0;
    return;
  }
  if (key === "G") {
    state.cursor = Math.max(0, state.visible.length - 1);
    return;
  }
  if (key === "y" || key === "r" || key === "o") {
    handleAction(state, key, wasArmed);
    return;
  }
  if (key === "t") {
    state.expandTools = !state.expandTools;
    return;
  }

  if (key >= " " && key <= "~") {
    state.searching = true;
    state.query += key;
    recompute(state);
  }
}

function splitKeys(chunk: string): string[] {
  const keys: string[] = [];
  let i = 0;
  while (i < chunk.length) {
    if (chunk[i] === "\x1b") {
      const match = chunk.slice(i).match(/^\x1b\[[0-9;]*[A-Za-z~]/);
      if (match) {
        keys.push(match[0]);
        i += match[0].length;
        continue;
      }
      keys.push("\x1b");
      i += 1;
      continue;
    }
    keys.push(chunk[i]!);
    i += 1;
  }
  return keys;
}

export async function runTui(all: TSession[], filters: TFilters): Promise<void> {
  const state: TState = {
    base: applyFilters(all, filters),
    visible: [],
    query: "",
    searching: true,
    cursor: 0,
    scroll: 0,
    view: "list",
    detail: null,
    detailScroll: 0,
    expandTools: false,
    status: "",
    armed: false,
    quit: false,
    handoff: null,
  };
  recompute(state);

  if (!process.stdin.isTTY) {
    process.stderr.write("ai-history: interactive mode needs a TTY; use --json or a filter flag\n");
    return;
  }

  enterScreen();
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  render(state);

  const onResize = () => render(state);
  process.stdout.on("resize", onResize);

  await new Promise<void>((resolve) => {
    const finish = () => {
      process.stdin.off("data", onData);
      process.stdout.off("resize", onResize);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      leaveScreen();
      resolve();
    };

    const onData = (chunk: string) => {
      for (const key of splitKeys(chunk)) {
        handleKey(state, key, () => {
          void openDetail(state).then(() => noop());
        });
        if (state.quit) {
          finish();
          return;
        }
      }
      render(state);
    };

    process.stdin.on("data", onData);
  });

  if (state.handoff) {
    process.stdout.write(`${dim("→")} ${state.handoff}\n`);
    spawnSync("/bin/sh", ["-c", state.handoff], { stdio: "inherit" });
  }
}
