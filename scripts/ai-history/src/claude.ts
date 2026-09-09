import { basename } from "node:path";
import { forEachLine, parseLine, rawString } from "./jsonl";
import { CLAUDE_HISTORY } from "./paths";
import type { TSession } from "./types";

const MAX_PROMPTS = 50;
const MAX_PROMPT_CHARS = 4000;

export type TPromptAggregate = {
  prompts: string[];
  count: number;
  first: number;
  last: number;
  cwd: string | null;
};

export type TClaudeScan = {
  sessionId: string | null;
  title: string | null;
  cwd: string | null;
  branch: string | null;
  version: string | null;
  isSidechain: boolean;
  firstTs: number | null;
  lastTs: number | null;
  costUsd: number | null;
  durationMs: number | null;
  startTime: number | null;
  linesAdded: number | null;
  linesRemoved: number | null;
  models: string[];
  prompts: string[];
  promptCount: number;
};

function clip(text: string): string {
  return text.length > MAX_PROMPT_CHARS ? text.slice(0, MAX_PROMPT_CHARS) : text;
}

export function blockText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const type = (block as any).type;
    if (type === "text" && typeof (block as any).text === "string") {
      parts.push((block as any).text);
    }
  }
  return parts.join("\n");
}

/** Aggregates `~/.claude/history.jsonl` into per-session prompt summaries. */
export async function scanClaudeHistory(): Promise<Record<string, TPromptAggregate>> {
  const bySession: Record<string, TPromptAggregate> = {};

  await forEachLine(CLAUDE_HISTORY, (line) => {
    const record = parseLine<{
      display?: string;
      timestamp?: number;
      project?: string;
      sessionId?: string;
    }>(line);
    if (!record || typeof record.sessionId !== "string") return;

    const ts = typeof record.timestamp === "number" ? record.timestamp : 0;
    let agg = bySession[record.sessionId];
    if (!agg) {
      agg = { prompts: [], count: 0, first: ts, last: ts, cwd: null };
      bySession[record.sessionId] = agg;
    }
    agg.count++;
    if (ts > 0) {
      if (agg.first === 0 || ts < agg.first) agg.first = ts;
      if (ts > agg.last) agg.last = ts;
    }
    if (typeof record.project === "string" && record.project.length > 0) {
      agg.cwd = record.project;
    }
    if (typeof record.display === "string" && agg.prompts.length < MAX_PROMPTS) {
      agg.prompts.push(clip(record.display));
    }
  });

  return bySession;
}

/**
 * Scans one Claude transcript, parsing only the lines that carry session-level
 * metadata and cheaply extracting the rest from the raw text.
 */
export async function scanClaudeTranscript(path: string): Promise<TClaudeScan> {
  const scan: TClaudeScan = {
    sessionId: null,
    title: null,
    cwd: null,
    branch: null,
    version: null,
    isSidechain: false,
    firstTs: null,
    lastTs: null,
    costUsd: null,
    durationMs: null,
    startTime: null,
    linesAdded: null,
    linesRemoved: null,
    models: [],
    prompts: [],
    promptCount: 0,
  };
  let summaryTitle: string | null = null;

  await forEachLine(path, (line) => {
    const iso = rawString(line, "timestamp");
    if (iso) {
      const ts = Date.parse(iso);
      if (!Number.isNaN(ts)) {
        if (scan.firstTs === null || ts < scan.firstTs) scan.firstTs = ts;
        if (scan.lastTs === null || ts > scan.lastTs) scan.lastTs = ts;
      }
    }
    if (scan.cwd === null) scan.cwd = rawString(line, "cwd");
    if (scan.branch === null) scan.branch = rawString(line, "gitBranch");
    if (scan.version === null) scan.version = rawString(line, "version");
    if (scan.sessionId === null) scan.sessionId = rawString(line, "sessionId");
    if (!scan.isSidechain && line.includes('"isSidechain":true')) {
      scan.isSidechain = true;
    }

    if (line.includes('"type":"ai-title"')) {
      const record = parseLine<{ aiTitle?: string }>(line);
      if (record && typeof record.aiTitle === "string" && record.aiTitle.length > 0) {
        scan.title = record.aiTitle;
      }
      return;
    }

    if (line.includes('"type":"cost-state"')) {
      const record = parseLine<{
        totalCostUSD?: number;
        totalDuration?: number;
        totalLinesAdded?: number;
        totalLinesRemoved?: number;
        startTime?: number;
        modelUsage?: Record<string, unknown>;
      }>(line);
      if (!record) return;
      if (typeof record.totalCostUSD === "number") scan.costUsd = record.totalCostUSD;
      if (typeof record.totalDuration === "number") scan.durationMs = record.totalDuration;
      if (typeof record.totalLinesAdded === "number") scan.linesAdded = record.totalLinesAdded;
      if (typeof record.totalLinesRemoved === "number") {
        scan.linesRemoved = record.totalLinesRemoved;
      }
      if (typeof record.startTime === "number") scan.startTime = record.startTime;
      if (record.modelUsage && typeof record.modelUsage === "object") {
        scan.models = Object.keys(record.modelUsage);
      }
      return;
    }

    if (line.includes('"type":"summary"')) {
      const record = parseLine<{ summary?: string }>(line);
      if (record && typeof record.summary === "string") summaryTitle = record.summary;
      return;
    }

    if (line.includes('"promptSource":"typed"')) {
      const record = parseLine<{ message?: { content?: unknown } }>(line);
      if (!record) return;
      const text = blockText(record.message?.content).trim();
      if (text.length === 0) return;
      scan.promptCount++;
      if (scan.prompts.length < MAX_PROMPTS) scan.prompts.push(clip(text));
    }
  });

  if (scan.title === null && summaryTitle !== null) scan.title = summaryTitle;
  return scan;
}

export function claudeSessionFrom(
  path: string,
  scan: TClaudeScan,
  history: TPromptAggregate | undefined,
): TSession {
  const id = scan.sessionId ?? basename(path).replace(/\.jsonl$/, "");
  const cwd = scan.cwd ?? history?.cwd ?? "";
  const prompts = scan.prompts.length > 0 ? scan.prompts : (history?.prompts ?? []);
  const title = scan.title ?? firstLineOf(prompts[0]) ?? "(untitled)";
  const started = scan.startTime ?? scan.firstTs ?? history?.first ?? 0;
  const ended = Math.max(scan.lastTs ?? 0, history?.last ?? 0, started);

  return {
    id,
    tool: "claude",
    title,
    cwd,
    project: projectName(cwd),
    branch: scan.branch,
    startedAt: started,
    endedAt: ended,
    durationMs: scan.durationMs ?? (ended > started ? ended - started : null),
    costUsd: scan.costUsd,
    linesAdded: scan.linesAdded,
    linesRemoved: scan.linesRemoved,
    models: scan.models,
    version: scan.version,
    transcript: path,
    isSubagent: scan.isSidechain,
    promptCount: scan.promptCount || (history?.count ?? prompts.length),
    prompts,
  };
}

export function claudeSessionFromHistory(id: string, agg: TPromptAggregate): TSession {
  const cwd = agg.cwd ?? "";
  return {
    id,
    tool: "claude",
    title: firstLineOf(agg.prompts[0]) ?? "(untitled)",
    cwd,
    project: projectName(cwd),
    branch: null,
    startedAt: agg.first,
    endedAt: agg.last,
    durationMs: agg.last > agg.first ? agg.last - agg.first : null,
    costUsd: null,
    linesAdded: null,
    linesRemoved: null,
    models: [],
    version: null,
    transcript: null,
    isSubagent: false,
    promptCount: agg.count,
    prompts: agg.prompts,
  };
}

export function projectName(cwd: string): string {
  if (!cwd) return "-";
  const trimmed = cwd.replace(/\/+$/, "");
  const name = trimmed.slice(trimmed.lastIndexOf("/") + 1);
  return name.length > 0 ? name : trimmed || "-";
}

export function firstLineOf(text: string | undefined): string | null {
  if (!text) return null;
  const stripped = text.replace(/<\/?(command|local)-[a-z-]+>/g, " ");
  const line = stripped.split("\n").find((candidate) => candidate.trim().length > 0);
  if (!line) return null;
  const clean = line.trim().replace(/\s+/g, " ");
  if (clean.length === 0) return null;
  return clean.length > 120 ? `${clean.slice(0, 119)}…` : clean;
}
