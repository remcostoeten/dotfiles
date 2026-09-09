import { readdir, stat, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { noop } from "./noop";
import {
  CACHE_DIR,
  CACHE_FILE,
  CLAUDE_HISTORY,
  CLAUDE_PROJECTS,
  CODEX_ARCHIVED,
  CODEX_HISTORY,
  CODEX_INDEX,
  CODEX_SESSIONS,
} from "./paths";
import {
  claudeSessionFrom,
  claudeSessionFromHistory,
  scanClaudeHistory,
  scanClaudeTranscript,
  type TPromptAggregate,
} from "./claude";
import { codexSessionFrom, scanCodexHistory, scanCodexRollout, scanCodexThreadNames } from "./codex";
import type { TSession } from "./types";

const CACHE_VERSION = 4;

type TCachedFile = { key: string; session: TSession };

type TCache = {
  version: number;
  claudeHistoryKey: string;
  claudeHistory: Record<string, TPromptAggregate>;
  codexHistoryKey: string;
  codexHistory: Record<string, TPromptAggregate>;
  codexNamesKey: string;
  codexNames: Record<string, string>;
  files: Record<string, TCachedFile>;
};

export type TBuildStats = {
  claudeTranscripts: number;
  codexRollouts: number;
  claudePrompts: number;
  codexThreadNames: number;
  parsed: number;
  cached: number;
  elapsedMs: number;
};

export type TBuildResult = { sessions: TSession[]; stats: TBuildStats };

function emptyCache(): TCache {
  return {
    version: CACHE_VERSION,
    claudeHistoryKey: "",
    claudeHistory: {},
    codexHistoryKey: "",
    codexHistory: {},
    codexNamesKey: "",
    codexNames: {},
    files: {},
  };
}

async function fileKey(path: string): Promise<string | null> {
  try {
    const info = await stat(path);
    return `${Math.round(info.mtimeMs)}:${info.size}`;
  } catch {
    noop();
    return null;
  }
}

async function readCache(): Promise<TCache> {
  try {
    const raw = await Bun.file(CACHE_FILE).text();
    const parsed = JSON.parse(raw) as TCache;
    if (parsed.version !== CACHE_VERSION) return emptyCache();
    return parsed;
  } catch {
    noop();
    return emptyCache();
  }
}

async function writeCache(cache: TCache): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await Bun.write(CACHE_FILE, JSON.stringify(cache));
  } catch {
    noop();
  }
}

async function listClaudeTranscripts(): Promise<string[]> {
  const out: string[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    let entries: Array<{ name: string; isDirectory: () => boolean }> = [];
    try {
      entries = (await readdir(dir, { withFileTypes: true })) as any;
    } catch {
      noop();
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "memory" || entry.name.startsWith("wf_")) continue;
        if (depth < 3) await walk(full, depth + 1);
      } else if (entry.name.endsWith(".jsonl")) {
        out.push(full);
      }
    }
  }

  await walk(CLAUDE_PROJECTS, 0);
  return out;
}

function parentSessionIdOf(path: string): string | null {
  const parts = path.split("/");
  const at = parts.lastIndexOf("subagents");
  return at > 0 ? (parts[at - 1] ?? null) : null;
}

async function listCodexRollouts(): Promise<string[]> {
  const out: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: Array<{ name: string; isDirectory: () => boolean }> = [];
    try {
      entries = (await readdir(dir, { withFileTypes: true })) as any;
    } catch {
      noop();
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.startsWith("rollout-") && entry.name.endsWith(".jsonl")) out.push(full);
    }
  }

  await walk(CODEX_SESSIONS);
  await walk(CODEX_ARCHIVED);
  return out;
}

async function mapLimit<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index]!);
    }
  });
  await Promise.all(runners);
}

export async function buildIndex(force: boolean): Promise<TBuildResult> {
  const startedAt = Date.now();
  const cache = force ? emptyCache() : await readCache();
  const nextFiles: Record<string, TCachedFile> = {};
  let parsed = 0;
  let cached = 0;

  const claudeHistoryKey = (await fileKey(CLAUDE_HISTORY)) ?? "";
  if (claudeHistoryKey !== cache.claudeHistoryKey || force) {
    cache.claudeHistory = await scanClaudeHistory();
    cache.claudeHistoryKey = claudeHistoryKey;
  }

  const codexHistoryKey = (await fileKey(CODEX_HISTORY)) ?? "";
  if (codexHistoryKey !== cache.codexHistoryKey || force) {
    cache.codexHistory = await scanCodexHistory();
    cache.codexHistoryKey = codexHistoryKey;
  }

  const codexNamesKey = (await fileKey(CODEX_INDEX)) ?? "";
  if (codexNamesKey !== cache.codexNamesKey || force) {
    cache.codexNames = await scanCodexThreadNames();
    cache.codexNamesKey = codexNamesKey;
  }

  const sessions: TSession[] = [];
  const claudeSeen = new Set<string>();

  const claudeFiles = await listClaudeTranscripts();
  await mapLimit(claudeFiles, 24, async (path) => {
    const key = await fileKey(path);
    if (key === null) return;
    const hit = cache.files[path];
    if (hit && hit.key === key) {
      cached++;
      nextFiles[path] = hit;
      return;
    }
    parsed++;
    const scan = await scanClaudeTranscript(path);
    const session = claudeSessionFrom(path, scan, cache.claudeHistory[scan.sessionId ?? ""]);
    nextFiles[path] = { key, session };
  });

  const claudeById: Record<string, TSession> = {};
  const claudeChildren: Array<{ session: TSession; parentId: string }> = [];

  for (const path of claudeFiles) {
    const hit = nextFiles[path];
    if (!hit) continue;
    const session = hit.session;
    const history = cache.claudeHistory[session.id];
    if (history) {
      if (session.prompts.length === 0) session.prompts = history.prompts;
      if (session.promptCount === 0) session.promptCount = history.count;
      if (history.last > session.endedAt) session.endedAt = history.last;
    }

    const parentId = parentSessionIdOf(path);
    if (parentId) {
      session.isSubagent = true;
      claudeChildren.push({ session, parentId });
    } else {
      claudeById[session.id] = session;
      claudeSeen.add(session.id);
    }
    sessions.push(session);
  }

  for (const { session, parentId } of claudeChildren) {
    const parent = claudeById[parentId];
    if (!parent) continue;
    if (!session.cwd) {
      session.cwd = parent.cwd;
      session.project = parent.project;
    }
    if (!session.branch) session.branch = parent.branch;
    if (session.title === "(untitled)") session.title = `↳ ${parent.title}`;
  }

  for (const [id, agg] of Object.entries(cache.claudeHistory)) {
    if (claudeSeen.has(id)) continue;
    sessions.push(claudeSessionFromHistory(id, agg));
  }

  const codexFiles = await listCodexRollouts();
  await mapLimit(codexFiles, 24, async (path) => {
    const key = await fileKey(path);
    if (key === null) return;
    const hit = cache.files[path];
    if (hit && hit.key === key) {
      cached++;
      nextFiles[path] = hit;
      return;
    }
    parsed++;
    const scan = await scanCodexRollout(path);
    const id = scan.sessionId ?? "";
    const session = codexSessionFrom(path, scan, cache.codexHistory[id], cache.codexNames[id]);
    nextFiles[path] = { key, session };
  });

  for (const path of codexFiles) {
    const hit = nextFiles[path];
    if (!hit) continue;
    const session = hit.session;
    const history = cache.codexHistory[session.id];
    if (history) {
      if (session.prompts.length === 0) session.prompts = history.prompts;
      if (session.promptCount === 0) session.promptCount = history.count;
      if (history.last > session.endedAt) session.endedAt = history.last;
    }
    sessions.push(session);
  }

  cache.files = nextFiles;
  await writeCache(cache);

  sessions.sort((a, b) => b.endedAt - a.endedAt || b.startedAt - a.startedAt);

  return {
    sessions,
    stats: {
      claudeTranscripts: claudeFiles.length,
      codexRollouts: codexFiles.length,
      claudePrompts: Object.values(cache.claudeHistory).reduce((sum, a) => sum + a.count, 0),
      codexThreadNames: Object.keys(cache.codexNames).length,
      parsed,
      cached,
      elapsedMs: Date.now() - startedAt,
    },
  };
}
