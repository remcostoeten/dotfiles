import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "@/src/cli";
import { pruneCollapsedIds, resolveEpic, setEpicVisibility } from "@/src/domain/epic-visibility";
import { DEFAULT_CONFIG, type Task } from "@/src/domain/task";
import { UserInputError } from "@/src/domain/user-input-error";
import { expandVisibilityAliases } from "@/src/domain/visibility-alias";
import { getTodoPaths, TodoStore } from "@/src/storage/todo-store";

function createTask(id: string, description: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    description,
    status: "pending",
    priority: "none",
    createdAt: 0,
    updatedAt: 0,
    reminderOffsets: [],
    notificationsSent: { reminders: [], overdue: false },
    ...extra,
  };
}

describe("alias expansion", () => {
  test.each([
    [["-tr"], ["toggle", "reset"]],
    [["--t", "--r"], ["toggle", "reset"]],
    [["-oa"], ["open", "all"]],
    [["--o", "--a"], ["open", "all"]],
    [["-ca"], ["close", "all"]],
    [["--c", "--a"], ["close", "all"]],
    [["-ta"], ["toggle", "all"]],
    [["-t", "joram"], ["toggle", "joram"]],
    [["--t", "36"], ["toggle", "36"]],
    [["-o", "client work"], ["open", "client work"]],
    [["-c", "#36"], ["close", "#36"]],
    [["-tr", "-h"], ["toggle", "reset", "-h"]],
    [["-oa", "--help"], ["open", "all", "--help"]],
    [["-ca", "help"], ["close", "all", "help"]],
    [["-ta", "reset", "--help"], ["toggle", "all", "reset", "--help"]],
  ])("%p expands to %p", (args, expected) => {
    expect(expandVisibilityAliases(args)).toEqual(expected);
  });

  test.each([["-t"], ["--t"], ["-o"], ["--o"], ["-c"], ["--c"], ["-a"], ["--a"], ["-r"], ["--r"]])(
    "%p alone is not a complete command",
    (flag) => {
      expect(expandVisibilityAliases([flag])).toBeUndefined();
    },
  );

  test.each([[["-i"]], [["--interactive"]], [["-h"]], [["--help"]], [["help"]], [["add", "buy milk"]], [["-to"]], [["-tt"]], [["-x"]], [["-oa", "--limit"]]])(
    "%p is left untouched",
    (args) => {
      expect(expandVisibilityAliases(args)).toBeUndefined();
    },
  );
});

describe("visibility state", () => {
  const epics = [createTask("1", "rjl", { kind: "epic" }), createTask("2", "ai", { kind: "epic" })];

  test("close adds, open removes, toggle inverts", () => {
    expect([...setEpicVisibility(new Set(), ["1"], "close")]).toEqual(["1"]);
    expect([...setEpicVisibility(new Set(["1"]), ["1"], "close")]).toEqual(["1"]);
    expect([...setEpicVisibility(new Set(["1"]), ["1"], "open")]).toEqual([]);
    expect([...setEpicVisibility(new Set(), ["1"], "open")]).toEqual([]);
    expect([...setEpicVisibility(new Set(["1"]), ["1", "2"], "toggle")]).toEqual(["2"]);
  });

  test("stale ids are dropped when state is written", () => {
    expect([...pruneCollapsedIds(new Set(["1", "99"]), epics)]).toEqual(["1"]);
  });
});

describe("epic resolution", () => {
  const tasks = [
    createTask("1", "rjl", { kind: "epic" }),
    createTask("2", "navigation performance", { parentId: "1" }),
    createTask("3", "client work", { kind: "epic" }),
    createTask("7", "loose todo"),
  ];

  test.each([["rjl", "1"], ["1", "1"], ["#1", "1"], ["client work", "3"], ["CLIENT WORK", "3"]])("%p resolves to #%s", (target, id) => {
    expect(resolveEpic(tasks, target).id).toBe(id);
  });

  test("unknown name and unknown id report an epic-specific error", () => {
    expect(() => resolveEpic(tasks, "joram2")).toThrow(new UserInputError("Epic not found: joram2"));
    expect(() => resolveEpic(tasks, "999")).toThrow(new UserInputError("Epic #999 not found"));
    expect(() => resolveEpic(tasks, "#999")).toThrow(new UserInputError("Epic #999 not found"));
  });

  test("a normal todo is rejected instead of falling back to its parent", () => {
    expect(() => resolveEpic(tasks, "2")).toThrow(new UserInputError("Todo #2 is not an epic."));
    expect(() => resolveEpic(tasks, "7")).toThrow(new UserInputError("Todo #7 is not an epic."));
  });
});

describe("commands", () => {
  let dataDirectory = "";
  let store: TodoStore;
  let output = "";
  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;
  const originalDataDir = process.env.DOTFILES_DATA_DIR;

  beforeEach(async () => {
    dataDirectory = await mkdtemp(join(tmpdir(), "dotfiles-todo-visibility-"));
    process.env.DOTFILES_DATA_DIR = dataDirectory;
    store = new TodoStore(getTodoPaths(dataDirectory));
    await store.saveConfig({ ...DEFAULT_CONFIG, showNotificationsOnStartup: false, autocorrect: false });
    output = "";
    const capture = (chunk: string | Uint8Array): boolean => {
      output += chunk.toString();
      return true;
    };
    process.stdout.write = capture as typeof process.stdout.write;
    process.stderr.write = capture as typeof process.stderr.write;
    process.exitCode = undefined;
  });

  afterEach(async () => {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
    process.exitCode = undefined;
    if (originalDataDir === undefined) delete process.env.DOTFILES_DATA_DIR;
    else process.env.DOTFILES_DATA_DIR = originalDataDir;
    await rm(dataDirectory, { force: true, recursive: true });
  });

  function plain(): string {
    return output.replace(/\[[0-9;]*m/g, "");
  }

  async function seed(): Promise<void> {
    await run(["epic", "rjl"]);
    await run(["sub", "1", "navigation"]);
    await run(["epic", "joram"]);
    await run(["sub", "3", "turboturbo"]);
    await run(["sub", "3", "showcase"]);
    await run(["add", "cadeaukaart"]);
    output = "";
  }

  async function collapsed(): Promise<string[]> {
    return [...(await store.loadCollapsedEpicIds())];
  }

  test("a new epic defaults to open and renders exactly as before", async () => {
    await seed();
    await run(["shell-display", "--all"]);
    const rendered = plain();
    expect(rendered).toContain("rjl [0/1]");
    expect(rendered).toContain("└─ navigation");
    expect(rendered).toContain("joram [0/2]");
    expect(rendered).toContain("├─ turboturbo");
    expect(await collapsed()).toEqual([]);
  });

  test("a collapsed epic hides its children and counts subtickets", async () => {
    await seed();
    await run(["close", "joram"]);
    expect(plain()).toContain("Closed epic: joram");
    output = "";

    await run(["shell-display", "--all"]);
    const rendered = plain();
    expect(rendered).toContain("joram ● 2 subtickets");
    expect(rendered).not.toContain("turboturbo");
    expect(rendered).not.toContain("showcase");
    expect(rendered).toContain("rjl [0/1]");
    expect(rendered).toContain("cadeaukaart");
  });

  test("subticket count is singular for one child and zero for an empty epic", async () => {
    await seed();
    await run(["epic", "misc"]);
    await run(["close", "rjl"]);
    await run(["close", "misc"]);
    output = "";

    await run(["shell-display", "--all"]);
    expect(plain()).toContain("rjl ● 1 subticket");
    expect(plain()).toContain("misc ● 0 subtickets");
  });

  test("collapse state persists across runs and survives a rename", async () => {
    await seed();
    await run(["close", "1"]);
    expect(await collapsed()).toEqual(["1"]);

    await run(["edit", "1", "rjl renamed"]);
    output = "";
    await run(["shell-display", "--all"]);
    expect(plain()).toContain("rjl renamed ● 1 subticket");
    expect(await collapsed()).toEqual(["1"]);
  });

  test("open and close are idempotent", async () => {
    await seed();
    await run(["close", "joram"]);
    await run(["close", "joram"]);
    expect(await collapsed()).toEqual(["3"]);
    await run(["open", "joram"]);
    await run(["open", "joram"]);
    expect(await collapsed()).toEqual([]);
  });

  test("toggle inverts one epic", async () => {
    await seed();
    await run(["toggle", "#3"]);
    expect(await collapsed()).toEqual(["3"]);
    expect(plain()).toContain("Closed epic: joram");
    output = "";
    await run(["toggle", "3"]);
    expect(await collapsed()).toEqual([]);
    expect(plain()).toContain("Opened epic: joram");
  });

  test("toggle all inverts every epic independently", async () => {
    await seed();
    await run(["close", "rjl"]);
    output = "";
    await run(["toggle", "all"]);
    expect(plain()).toContain("Toggled 2 epics");
    expect(await collapsed()).toEqual(["3"]);
  });

  test("open all, close all and toggle reset", async () => {
    await seed();
    await run(["close", "all"]);
    expect(await collapsed()).toEqual(["1", "3"]);
    await run(["open", "all"]);
    expect(await collapsed()).toEqual([]);

    await run(["close", "all"]);
    await run(["toggle", "reset"]);
    expect(await collapsed()).toEqual([]);
    expect(JSON.parse(await Bun.file(getTodoPaths(dataDirectory).configFile).text()).collapsedEpicIds).toEqual([]);
  });

  test("stale state for a deleted epic never breaks rendering", async () => {
    await seed();
    await run(["close", "joram"]);
    await run(["rm", "3"]);
    output = "";

    await run(["shell-display", "--all"]);
    expect(plain()).toContain("rjl [0/1]");
    expect(plain()).not.toContain("Unknown command");

    await run(["close", "rjl"]);
    expect(await collapsed()).toEqual(["1"]);
  });

  test("epic names with spaces keep the existing quoting convention", async () => {
    await run(["epic", "client work"]);
    await run(["sub", "1", "do stuff"]);
    output = "";
    await run(["close", "client work"]);
    expect(plain()).toContain("Closed epic: client work");
    expect(await collapsed()).toEqual(["1"]);
  });

  test.each([
    [["-ca"], ["1", "3"]],
    [["--c", "--a"], ["1", "3"]],
    [["close", "all"], ["1", "3"]],
    [["-t", "joram"], ["3"]],
    [["--t", "3"], ["3"]],
    [["-c", "#3"], ["3"]],
  ])("%p resolves to the same internal command", async (args, expected) => {
    await seed();
    await run(args);
    expect(await collapsed()).toEqual(expected);
  });

  test.each([[["-tr"]], [["--t", "--r"]], [["toggle", "reset"]]])("%p resets the stored state", async (args) => {
    await seed();
    await run(["close", "all"]);
    await run(args);
    expect(await collapsed()).toEqual([]);
  });

  test.each([[["-oa"]], [["--o", "--a"]], [["open", "all"]]])("%p expands every epic", async (args) => {
    await seed();
    await run(["close", "all"]);
    output = "";
    await run(args);
    expect(plain()).toContain("Opened all epics");
    expect(await collapsed()).toEqual([]);
  });

  test.each([[["-t"]], [["-o"]], [["-c"]], [["-a"]], [["-r"]]])("%p keeps its existing meaning: an added task", async (args) => {
    await run(args);
    const tasks = await store.loadTasks();
    expect(tasks.map((task) => task.description)).toEqual([args[0] as string]);
  });

  test.each([[["--t"]], [["--o"]], [["--c"]], [["--a"]], [["--r"]]])("%p stays an unknown command", async (args) => {
    await run(args);
    expect(plain()).toContain("Unknown command:");
  });

  test("-i and --interactive are not captured by the alias parser", async () => {
    expect(expandVisibilityAliases(["-i"])).toBeUndefined();
    expect(expandVisibilityAliases(["--interactive"])).toBeUndefined();
  });

  test("unknown targets and non-epics do not mutate state", async () => {
    await seed();
    await run(["close", "all"]);
    output = "";

    await run(["close", "joram2"]);
    await run(["open", "999"]);
    await run(["toggle", "2"]);
    expect(plain()).toContain("Epic not found: joram2");
    expect(plain()).toContain("Epic #999 not found");
    expect(plain()).toContain("Todo #2 is not an epic.");
    expect(await collapsed()).toEqual(["1", "3"]);
  });

  test("all and reset together are rejected without mutating", async () => {
    await seed();
    await run(["-ta", "reset", "--help"]);
    expect(plain()).toContain("mutually exclusive");
    expect(await collapsed()).toEqual([]);
  });

  test("reset is only available on toggle", async () => {
    await seed();
    await run(["close", "reset"]);
    expect(plain()).toContain("only available as 'todo toggle reset'");
    expect(await collapsed()).toEqual([]);
  });

  test.each([[["help"]], [["--help"]], [["-h"]]])("global help %p lists the epic visibility API", async (args) => {
    await run(args);
    const rendered = plain();
    expect(rendered).toContain("EPIC VISIBILITY");
    expect(rendered).toContain("ALIASES");
    expect(rendered).toContain("-tr");
    expect(rendered).toContain("-oa");
    expect(rendered).toContain("-ca");
  });

  test.each([
    [["toggle", "help"], "todo toggle  ·"],
    [["toggle", "--help"], "todo toggle  ·"],
    [["toggle", "-h"], "todo toggle  ·"],
    [["open", "help"], "todo open  ·"],
    [["open", "--help"], "todo open  ·"],
    [["open", "-h"], "todo open  ·"],
    [["close", "help"], "todo close  ·"],
    [["close", "--help"], "todo close  ·"],
    [["close", "-h"], "todo close  ·"],
    [["toggle", "all", "help"], "todo toggle all  ·"],
    [["toggle", "all", "--help"], "todo toggle all  ·"],
    [["toggle", "all", "-h"], "todo toggle all  ·"],
    [["toggle", "reset", "help"], "todo toggle reset  ·"],
    [["toggle", "reset", "--help"], "todo toggle reset  ·"],
    [["toggle", "reset", "-h"], "todo toggle reset  ·"],
    [["open", "all", "help"], "todo open all  ·"],
    [["open", "all", "--help"], "todo open all  ·"],
    [["open", "all", "-h"], "todo open all  ·"],
    [["close", "all", "help"], "todo close all  ·"],
    [["close", "all", "--help"], "todo close all  ·"],
    [["close", "all", "-h"], "todo close all  ·"],
    [["--t", "--r", "-h"], "todo toggle reset  ·"],
    [["-tr", "--help"], "todo toggle reset  ·"],
    [["--o", "--a", "-h"], "todo open all  ·"],
    [["-oa", "--help"], "todo open all  ·"],
    [["--c", "--a", "-h"], "todo close all  ·"],
    [["-ca", "--help"], "todo close all  ·"],
    [["-ca", "help"], "todo close all  ·"],
  ])("%p shows contextual help without mutating", async (args, expected) => {
    await seed();
    await run(args);
    expect(plain()).toContain(expected);
    expect(await collapsed()).toEqual([]);
    expect(plain()).not.toContain("Unknown command");
  });
});
