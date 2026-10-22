import { emitKeypressEvents } from "node:readline";
import { buildArchiveEntries, filterArchive, parseArchiveArgs, restoreArchiveEntries, type ArchiveEntry, type ArchiveFilter, type ArchiveKind } from "../domain/archive";
import type { Task, TaskId } from "../domain/task";
import { UserInputError } from "../domain/user-input-error";
import { formatShortDate } from "../presentation/due-format";
import { clipVisible } from "../presentation/ansi-text";
import type { TodoStore } from "../storage/todo-store";
import type { ParsedInput } from "../command-spec/parsed-input";
import type { CommandContext, CommandSpec } from "../command-spec/types";

const DIM = "\u001B[2m";
const GREEN = "\u001B[32m";
const RED = "\u001B[38;5;203m";
const MAUVE = "\u001B[38;5;147m";
const SELECTED = "\u001B[48;5;60m";
const RESET = "\u001B[0m";

export const archiveCommand: CommandSpec = {
  name: "archive",
  aliases: ["removed", "trash"],
  summary: "List completed and removed tasks, newest first.",
  group: "View",
  args: [{ name: "text", kind: "text", variadic: true, optional: true, description: "Only entries whose description contains this" }],
  flags: [
    { name: "removed", aliases: ["deleted"], description: "Only removed tasks" },
    { name: "done", aliases: ["completed"], description: "Only completed tasks" },
    { name: "since", value: "due-time", description: "Newer than: 7d, 12h, 2w (ago) or a date" },
    { name: "until", value: "due-time", description: "Older than: 7d, 12h, 2w (ago) or a date" },
    { name: "interactive", short: "i", description: "Open the restore picker" },
  ],
  details: [
    "`todo rm` never deletes: removed tasks are kept in ~/.dotfiles/todo/removed.json as r<n>.",
    "Completed tasks are listed as #<id>. Restoring a removed task recreates it with a fresh ID; restoring a completed one reopens it.",
    "Dates accept 7d/12h/2w (ago) or any due-date form (yesterday, 16/08/2026).",
    "-i opens a picker: type to filter, Tab cycles all/removed/done, Space marks, Enter restores, Ctrl+T restores under a chosen parent.",
  ],
  examples: [
    { command: "todo archive --removed --since 7d" },
    { command: "todo archive groceries" },
    { command: "todo archive restore r3 r4", note: "recreate two removed tasks" },
    { command: "todo archive restore r3 --to 12", note: "recreate under task #12" },
    { command: "todo archive -i" },
  ],
  subcommands: [
    {
      name: "restore",
      summary: "Bring archived tasks back.",
      args: [{ name: "ref", kind: "archive-ref", variadic: true, description: "r<n> for removed tasks, #<id> or <id> for completed ones" }],
      flags: [{ name: "to", value: "parent-id", description: "Restore under this task, or top for the top level" }],
      details: ["Removed tasks come back with fresh IDs; completed ones reopen with their own ID. Find refs with `todo archive`."],
      examples: [
        { command: "todo archive restore r3" },
        { command: "todo archive restore r3,r4 #12", note: "two removed tasks and a completed one" },
        { command: "todo archive restore r3 --to 12", note: "under task #12" },
        { command: "todo archive restore r3 --to top", note: "at the top level" },
      ],
      async run(input, { store, stdout }) {
        const to = input.value("to");
        const parentId = to === undefined ? undefined : to === "top" || to === "root" || to === "-" ? null : to;
        const refs = input.args("ref").flatMap((ref) => ref.split(",").filter((part) => part.length > 0));
        const restored = await applyRestore(store, refs, parentId);
        stdout.write(`${GREEN}Restored ${restored.length} task(s): ${restored.map((task) => `#${task.id}`).join(", ")}${RESET}\n`);
      },
    },
  ],
  run: runArchive,
};

async function runArchive(input: ParsedInput, { store, stdout }: CommandContext): Promise<void> {
  const { filter, interactive } = parseArchiveArgs(toArchiveArgs(input));
  if (interactive) {
    if (!process.stdin.isTTY) throw new UserInputError("todo archive -i needs a terminal");
    await runArchivePicker(store, filter);
    return;
  }

  const entries = filterArchive(buildArchiveEntries(await store.loadTasks(), await store.loadRemoved()), filter);
  if (entries.length === 0) {
    stdout.write(`${DIM}No archived tasks found${RESET}\n`);
    return;
  }
  for (const entry of entries) stdout.write(`${formatArchiveEntry(entry)}\n`);
}

function toArchiveArgs(input: ParsedInput): string[] {
  const args = [...input.args("text")];
  if (input.flag("removed")) args.push("--removed");
  if (input.flag("done")) args.push("--done");
  if (input.flag("interactive")) args.push("-i");
  for (const name of ["since", "until"] as const) {
    const value = input.value(name);
    if (value !== undefined) args.push(`--${name}`, value);
  }
  return args;
}

async function applyRestore(store: TodoStore, refs: ReadonlyArray<string>, parentId: TaskId | null | undefined): Promise<Task[]> {
  const result = restoreArchiveEntries(await store.loadTasks(), await store.loadRemoved(), refs, parentId);
  await store.saveTasks(result.tasks);
  await store.saveRemoved(result.removed);
  return result.restored;
}

function formatArchiveEntry(entry: ArchiveEntry, now = Date.now()): string {
  const badge = entry.kind === "removed" ? `${RED}removed${RESET}` : `${GREEN}done   ${RESET}`;
  return `${MAUVE}${entry.ref.padEnd(5)}${RESET} ${badge} ${DIM}${formatShortDate(entry.at, now).padEnd(11)}${RESET} ${entry.task.description}`;
}

interface PickerKey {
  ctrl?: boolean;
  name?: string;
  sequence?: string;
}

const KIND_CYCLE: ReadonlyArray<ArchiveKind | undefined> = [undefined, "removed", "done"];

/** Keyboard picker over the archive; a second stage picks the parent when re-assigning. */
class ArchivePicker {
  query: string;
  kind: ArchiveKind | undefined;
  index = 0;
  marked = new Set<string>();
  message = "";
  parentStage: { candidates: Task[]; query: string; index: number } | undefined;
  closed = false;

  constructor(private entries: ArchiveEntry[], private readonly baseFilter: ArchiveFilter, private readonly pendingTasks: () => Task[]) {
    this.query = baseFilter.query ?? "";
    this.kind = baseFilter.kind;
  }

  get visible(): ArchiveEntry[] {
    return filterArchive(this.entries, { ...this.baseFilter, kind: this.kind, query: this.query });
  }

  get parentMatches(): Task[] {
    const stage = this.parentStage;
    if (stage === undefined) return [];
    const needle = stage.query.toLowerCase();
    return stage.candidates.filter((task) => needle.length === 0 || task.description.toLowerCase().includes(needle) || task.id === needle.replace(/^#/, ""));
  }

  replaceEntries(entries: ArchiveEntry[]): void {
    this.entries = entries;
    this.marked.clear();
    this.index = Math.min(this.index, Math.max(0, this.visible.length - 1));
  }

  /** Returns the refs and target parent to restore when a restore was confirmed. */
  handleKey(character: string | undefined, key: PickerKey): { refs: string[]; parentId?: TaskId | null } | undefined {
    if (key.name === "escape" || (key.ctrl && key.name === "c")) {
      if (this.parentStage !== undefined) this.parentStage = undefined;
      else this.closed = true;
      return undefined;
    }
    return this.parentStage === undefined ? this.handleListKey(character, key) : this.handleParentKey(character, key);
  }

  private selectedRefs(): string[] {
    if (this.marked.size > 0) return [...this.marked];
    const current = this.visible[this.index];
    return current === undefined ? [] : [current.ref];
  }

  private handleListKey(character: string | undefined, key: PickerKey): { refs: string[]; parentId?: TaskId | null } | undefined {
    const count = this.visible.length;
    if (key.name === "up") this.index = Math.max(0, this.index - 1);
    else if (key.name === "down") this.index = Math.min(Math.max(0, count - 1), this.index + 1);
    else if (key.name === "tab") {
      this.kind = KIND_CYCLE[(KIND_CYCLE.indexOf(this.kind) + 1) % KIND_CYCLE.length];
      this.index = 0;
    } else if (key.name === "space") {
      const current = this.visible[this.index];
      if (current !== undefined) {
        if (this.marked.has(current.ref)) this.marked.delete(current.ref);
        else this.marked.add(current.ref);
        this.index = Math.min(Math.max(0, count - 1), this.index + 1);
      }
    } else if (key.name === "return") {
      const refs = this.selectedRefs();
      if (refs.length > 0) return { refs };
    } else if (key.ctrl && key.name === "t") {
      if (this.selectedRefs().length > 0) this.parentStage = { candidates: this.pendingTasks(), query: "", index: 0 };
    } else if (key.name === "backspace") {
      this.query = this.query.slice(0, -1);
      this.index = 0;
    } else if (character !== undefined && !key.ctrl && character.length === 1 && character >= " ") {
      this.query += character;
      this.index = 0;
    }
    return undefined;
  }

  private handleParentKey(character: string | undefined, key: PickerKey): { refs: string[]; parentId?: TaskId | null } | undefined {
    const stage = this.parentStage;
    if (stage === undefined) return undefined;
    const options = this.parentMatches.length + 1;
    if (key.name === "up") stage.index = Math.max(0, stage.index - 1);
    else if (key.name === "down") stage.index = Math.min(options - 1, stage.index + 1);
    else if (key.name === "return") {
      const parent = stage.index === 0 ? null : this.parentMatches[stage.index - 1]?.id ?? null;
      this.parentStage = undefined;
      return { refs: this.selectedRefs(), parentId: parent };
    } else if (key.name === "backspace") {
      stage.query = stage.query.slice(0, -1);
      stage.index = 0;
    } else if (character !== undefined && !key.ctrl && character.length === 1 && character >= " ") {
      stage.query += character;
      stage.index = 0;
    }
    return undefined;
  }

  render(width: number, height: number): string {
    const lines: string[] = [];
    const listHeight = Math.max(3, height - 5);
    if (this.parentStage !== undefined) {
      lines.push(`${MAUVE}restore ${this.selectedRefs().join(" ")} under…${RESET}  ${DIM}filter:${RESET} ${this.parentStage.query}▏`);
      const options = ["(top level)", ...this.parentMatches.map((task) => `#${task.id} ${task.description}`)];
      const start = Math.max(0, this.parentStage.index - listHeight + 1);
      options.slice(start, start + listHeight).forEach((option, offset) => {
        lines.push(start + offset === this.parentStage?.index ? `${SELECTED}${clipVisible(`› ${option}`, width)}${RESET}` : clipVisible(`  ${option}`, width));
      });
      lines.push(`${DIM}↑↓ choose · Enter restore here · Esc back${RESET}`);
      return lines.join("\n");
    }

    const visible = this.visible;
    const kindLabel = this.kind ?? "all";
    lines.push(`${MAUVE}todo archive${RESET} ${DIM}· ${kindLabel} · ${visible.length} match(es)${RESET}  ${DIM}filter:${RESET} ${this.query}▏`);
    if (visible.length === 0) lines.push(`${DIM}  nothing matches${RESET}`);
    const start = Math.max(0, this.index - listHeight + 1);
    visible.slice(start, start + listHeight).forEach((entry, offset) => {
      const mark = this.marked.has(entry.ref) ? `${GREEN}●${RESET}` : " ";
      const line = clipVisible(`${mark} ${formatArchiveEntry(entry)}`, width);
      lines.push(start + offset === this.index ? `${SELECTED}${line}${RESET}` : line);
    });
    if (this.message.length > 0) lines.push(`${GREEN}${this.message}${RESET}`);
    lines.push(`${DIM}type to filter · Tab all/removed/done · Space mark · Enter restore · Ctrl+T restore under… · Esc quit${RESET}`);
    return lines.join("\n");
  }
}

async function runArchivePicker(store: TodoStore, filter: ArchiveFilter): Promise<void> {
  const terminal = process.stdout;
  let tasks = await store.loadTasks();
  const load = async (): Promise<ArchiveEntry[]> => buildArchiveEntries(tasks, await store.loadRemoved());
  const picker = new ArchivePicker(await load(), filter, () => tasks.filter((task) => task.status === "pending"));
  const wasRaw = process.stdin.isRaw;
  const draw = (): void => {
    const output = picker.render(terminal.columns ?? 80, terminal.rows ?? 24);
    terminal.write(`\u001B[H${output.split("\n").join("\u001B[K\n")}\u001B[K\u001B[J`);
  };

  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  terminal.write("\u001B[?1049h\u001B[?25l");

  await new Promise<void>((resolve) => {
    let busy = false;
    const handleKeypress = (character: string | undefined, key: PickerKey | undefined): void => {
      if (busy) return;
      const request = picker.handleKey(character, key ?? {});
      if (picker.closed) {
        process.stdin.off("keypress", handleKeypress);
        process.stdout.off("resize", draw);
        resolve();
        return;
      }
      if (request === undefined) {
        draw();
        return;
      }
      busy = true;
      applyRestore(store, request.refs, request.parentId)
        .then(async (restored) => {
          tasks = await store.loadTasks();
          picker.replaceEntries(await load());
          picker.message = `Restored ${restored.map((task) => `#${task.id}`).join(", ")}`;
        })
        .catch((error: unknown) => {
          picker.message = error instanceof Error ? error.message : String(error);
        })
        .finally(() => {
          busy = false;
          draw();
        });
    };
    process.stdin.on("keypress", handleKeypress);
    process.stdout.on("resize", draw);
    draw();
  });

  terminal.write("\u001B[?25h\u001B[?1049l");
  if (!wasRaw) process.stdin.setRawMode(false);
  process.stdin.pause();
}
