import { forEachLine, parseLine, readHead, readTail, rawString } from "./jsonl";
import { CODEX_HISTORY, CODEX_INDEX } from "./paths";
import { firstLineOf, projectName, type TPromptAggregate } from "./claude";
import type { TSession } from "./types";

const HEAD_BYTES = 192 * 1024;
const TAIL_BYTES = 64 * 1024;
const MAX_PROMPTS = 50;
const MAX_PROMPT_CHARS = 4000;

export type TCodexScan = {
  sessionId: string | null;
  cwd: string | null;
  branch: string | null;
  version: string | null;
  originator: string | null;
  provider: string | null;
  model: string | null;
  isSubagent: boolean;
  parentThreadId: string | null;
  agentNickname: string | null;
  startedAt: number | null;
  endedAt: number | null;
  firstPrompt: string | null;
};

/** Aggregates `~/.codex/history.jsonl`; its `ts` is epoch seconds. */
export async function scanCodexHistory(): Promise<Record<string, TPromptAggregate>> {
  const bySession: Record<string, TPromptAggregate> = {};

  await forEachLine(CODEX_HISTORY, (line) => {
    const record = parseLine<{ session_id?: string; ts?: number; text?: string }>(line);
    if (!record || typeof record.session_id !== "string") return;

    const ts = typeof record.ts === "number" ? record.ts * 1000 : 0;
    let agg = bySession[record.session_id];
    if (!agg) {
      agg = { prompts: [], count: 0, first: ts, last: ts, cwd: null };
      bySession[record.session_id] = agg;
    }
    agg.count++;
    if (ts > 0) {
      if (agg.first === 0 || ts < agg.first) agg.first = ts;
      if (ts > agg.last) agg.last = ts;
    }
    if (typeof record.text === "string" && agg.prompts.length < MAX_PROMPTS) {
      agg.prompts.push(
        record.text.length > MAX_PROMPT_CHARS
          ? record.text.slice(0, MAX_PROMPT_CHARS)
          : record.text,
      );
    }
  });

  return bySession;
}

/** Maps thread id to the most recently updated `thread_name`. */
export async function scanCodexThreadNames(): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  const updated: Record<string, string> = {};

  await forEachLine(CODEX_INDEX, (line) => {
    const record = parseLine<{ id?: string; thread_name?: string; updated_at?: string }>(line);
    if (!record || typeof record.id !== "string") return;
    if (typeof record.thread_name !== "string" || record.thread_name.length === 0) return;
    const stamp = typeof record.updated_at === "string" ? record.updated_at : "";
    const seen = updated[record.id];
    if (seen !== undefined && seen > stamp) return;
    updated[record.id] = stamp;
    names[record.id] = record.thread_name;
  });

  return names;
}

function extractFirstPrompt(lines: string[]): string | null {
  for (const line of lines) {
    if (line.includes('"type":"user_message"')) {
      const record = parseLine<{ payload?: { message?: string } }>(line);
      const message = record?.payload?.message;
      if (typeof message === "string" && message.trim().length > 0) return message;
    }
    if (line.includes('"UserMessage"')) {
      const record = parseLine<{ payload?: { item?: { content?: unknown } } }>(line);
      const content = record?.payload?.item?.content;
      if (Array.isArray(content)) {
        const text = content
          .map((block: any) => (typeof block?.text === "string" ? block.text : ""))
          .join("\n")
          .trim();
        if (text.length > 0) return text;
      }
    }
  }
  return null;
}

/** Reads only the head and tail of a rollout; never the whole transcript. */
export async function scanCodexRollout(path: string): Promise<TCodexScan> {
  const scan: TCodexScan = {
    sessionId: null,
    cwd: null,
    branch: null,
    version: null,
    originator: null,
    provider: null,
    model: null,
    isSubagent: false,
    parentThreadId: null,
    agentNickname: null,
    startedAt: null,
    endedAt: null,
    firstPrompt: null,
  };

  const head = await readHead(path, HEAD_BYTES);
  if (head.length === 0) return scan;
  const lines = head.split("\n");

  const meta = parseLine<{ timestamp?: string; payload?: Record<string, any> }>(lines[0] ?? "");
  const payload = meta?.payload;
  if (payload) {
    scan.sessionId =
      typeof payload.session_id === "string"
        ? payload.session_id
        : typeof payload.id === "string"
          ? payload.id
          : null;
    scan.cwd = typeof payload.cwd === "string" ? payload.cwd : null;
    scan.originator = typeof payload.originator === "string" ? payload.originator : null;
    scan.version = typeof payload.cli_version === "string" ? payload.cli_version : null;
    scan.provider = typeof payload.model_provider === "string" ? payload.model_provider : null;
    scan.isSubagent = payload.thread_source === "subagent";
    scan.parentThreadId =
      typeof payload.parent_thread_id === "string" ? payload.parent_thread_id : null;
    scan.agentNickname =
      typeof payload.agent_nickname === "string" ? payload.agent_nickname : null;
    scan.branch = typeof payload.git?.branch === "string" ? payload.git.branch : null;
    const stamp = typeof payload.timestamp === "string" ? payload.timestamp : meta?.timestamp;
    const parsed = stamp ? Date.parse(stamp) : NaN;
    if (!Number.isNaN(parsed)) scan.startedAt = parsed;
  }

  for (const line of lines) {
    if (scan.model === null && line.includes('"type":"turn_context"')) {
      const record = parseLine<{ payload?: { model?: string } }>(line);
      if (record?.payload?.model) scan.model = record.payload.model;
    }
  }
  scan.firstPrompt = extractFirstPrompt(lines);

  const tail = await readTail(path, TAIL_BYTES);
  const tailLines = tail.split("\n");
  for (let i = tailLines.length - 1; i >= 0; i--) {
    const iso = rawString(tailLines[i] ?? "", "timestamp");
    if (!iso) continue;
    const ts = Date.parse(iso);
    if (!Number.isNaN(ts)) {
      scan.endedAt = ts;
      break;
    }
  }

  return scan;
}

export function codexSessionFrom(
  path: string,
  scan: TCodexScan,
  history: TPromptAggregate | undefined,
  threadName: string | undefined,
): TSession {
  const id = scan.sessionId ?? rolloutIdFrom(path);
  const cwd = scan.cwd ?? "";
  const prompts = history?.prompts ?? [];
  if (prompts.length === 0 && scan.firstPrompt) prompts.push(scan.firstPrompt);

  const title =
    threadName ??
    scan.agentNickname ??
    firstLineOf(prompts[0]) ??
    firstLineOf(scan.firstPrompt ?? undefined) ??
    "(untitled)";

  const started = scan.startedAt ?? history?.first ?? 0;
  const ended = Math.max(scan.endedAt ?? 0, history?.last ?? 0, started);

  return {
    id,
    tool: "codex",
    title,
    cwd,
    project: projectName(cwd),
    branch: scan.branch,
    startedAt: started,
    endedAt: ended,
    durationMs: ended > started ? ended - started : null,
    costUsd: null,
    linesAdded: null,
    linesRemoved: null,
    models: scan.model ? [scan.model] : [],
    version: scan.version,
    transcript: path,
    isSubagent: scan.isSubagent,
    promptCount: history?.count ?? (scan.firstPrompt ? 1 : 0),
    prompts,
  };
}

export function rolloutIdFrom(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const match = name.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return match?.[1] ?? name.replace(/\.jsonl$/, "");
}
