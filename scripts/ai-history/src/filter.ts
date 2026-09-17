import { parseLine } from "./jsonl";
import { noop } from "./noop";
import type { TSession, TTool } from "./types";

export type TFilters = {
  project: string | null;
  tool: TTool | null;
  since: number | null;
  until: number | null;
  grep: string | null;
  branch: string | null;
  includeSubagents: boolean;
};

export function emptyFilters(): TFilters {
  return {
    project: null,
    tool: null,
    since: null,
    until: null,
    grep: null,
    branch: null,
    includeSubagents: false,
  };
}

/** Parses `3d`, `2w`, `12h`, `30m`, or an ISO-ish date into epoch ms. */
export function parseWhen(expr: string): number | null {
  const relative = expr.trim().match(/^(\d+)\s*([smhdwy])$/i);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2]!.toLowerCase();
    const scale: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
      w: 604_800_000,
      y: 31_536_000_000,
    };
    return Date.now() - amount * (scale[unit] ?? 0);
  }
  const absolute = Date.parse(expr);
  return Number.isNaN(absolute) ? null : absolute;
}

function toRegExp(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, "i");
  } catch {
    noop();
    return null;
  }
}

export function haystackOf(session: TSession): string {
  return `${session.title}\n${session.project}\n${session.cwd}\n${session.branch ?? ""}\n${session.prompts.join("\n")}`;
}

function contentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const bag = block as Record<string, unknown>;
    if (typeof bag.text === "string") parts.push(bag.text);
    else if (bag.type === "tool_use") parts.push(JSON.stringify(bag.input ?? ""));
  }
  return parts.join("\n");
}

/**
 * Returns the part of a record the session itself authored — prompts, replies,
 * and the commands it chose to run. Captured command output and injected
 * context (skill catalogues, AGENTS.md, system prompts) are deliberately left
 * out: they are identical across transcripts and would match everything.
 */
function authoredText(line: string, tool: TTool): string {
  const record = parseLine<any>(line);
  if (!record) return "";

  if (tool === "claude") {
    if (record.type === "assistant") return contentText(record.message?.content);
    if (record.type === "ai-title") return String(record.aiTitle ?? "");
    if (record.type === "last-prompt") return String(record.lastPrompt ?? "");
    return "";
  }

  const payload = record.payload;
  if (!payload) return "";

  if (record.type === "event_msg") {
    if (payload.type === "agent_message" || payload.type === "user_message") {
      return String(payload.message ?? "");
    }
    if (payload.type !== "item_completed") return "";
    const item = payload.item;
    if (!item) return "";
    if (item.type === "CommandExecution") {
      return Array.isArray(item.command) ? item.command.join(" ") : String(item.command ?? "");
    }
    if (item.type === "AgentMessage" || item.type === "UserMessage" || item.type === "Reasoning") {
      return contentText(item.content);
    }
    return "";
  }

  if (record.type === "response_item") {
    if (payload.type === "message") {
      if (payload.role !== "assistant" && payload.role !== "user") return "";
      return contentText(payload.content);
    }
    if (payload.type === "custom_tool_call") return String(payload.input ?? "");
    if (payload.type === "function_call") return String(payload.arguments ?? "");
  }

  return "";
}

/**
 * Scans a transcript for the pattern, but only inside records the session
 * itself produced. Skill catalogues and other injected context appear in every
 * transcript on disk, so matching them would make every search match everything.
 */
async function transcriptMatches(session: TSession, re: RegExp): Promise<boolean> {
  const path = session.transcript;
  if (!path) return false;

  let stream: ReadableStream<Uint8Array>;
  try {
    stream = Bun.file(path).stream();
  } catch {
    noop();
    return false;
  }

  const decoder = new TextDecoder();
  let carry = "";

  try {
    for await (const chunk of stream) {
      const buffer = carry + decoder.decode(chunk as Uint8Array, { stream: true });
      const lastBreak = buffer.lastIndexOf("\n");
      const complete = lastBreak === -1 ? "" : buffer.slice(0, lastBreak);
      carry = lastBreak === -1 ? buffer : buffer.slice(lastBreak + 1);
      if (carry.length > 8_000_000) carry = carry.slice(-8_000_000);
      if (complete.length === 0 || !re.test(complete)) continue;
      for (const line of complete.split("\n")) {
        if (re.test(line) && re.test(authoredText(line, session.tool))) return true;
      }
    }
  } catch {
    noop();
    return false;
  }

  return re.test(carry) && re.test(authoredText(carry, session.tool));
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

/**
 * Re-admits sessions whose transcript body matches the pattern even though
 * their title and prompts do not.
 */
export async function deepGrep(
  candidates: TSession[],
  matched: TSession[],
  pattern: string,
): Promise<TSession[]> {
  const re = toRegExp(pattern) ?? toRegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!re) return matched;

  const already = new Set(matched.map((session) => session.transcript));
  const pending = candidates.filter(
    (session) => session.transcript !== null && !already.has(session.transcript),
  );
  const extra: TSession[] = [];

  await mapLimit(pending, 24, async (session) => {
    if (await transcriptMatches(session, re)) extra.push(session);
  });

  return [...matched, ...extra].sort((a, b) => b.endedAt - a.endedAt);
}

export function applyFilters(sessions: TSession[], filters: TFilters): TSession[] {
  const grepRe = filters.grep ? toRegExp(filters.grep) : null;
  const grepLower = filters.grep?.toLowerCase() ?? null;

  return sessions.filter((session) => {
    if (!filters.includeSubagents && session.isSubagent) return false;
    if (filters.tool && session.tool !== filters.tool) return false;
    if (filters.project && !session.cwd.toLowerCase().includes(filters.project.toLowerCase())) {
      return false;
    }
    if (filters.branch && (session.branch ?? "") !== filters.branch) return false;
    if (filters.since !== null && session.endedAt < filters.since) return false;
    if (filters.until !== null && session.startedAt > filters.until) return false;
    if (grepLower) {
      const hay = haystackOf(session);
      const matched = grepRe ? grepRe.test(hay) : hay.toLowerCase().includes(grepLower);
      if (!matched) return false;
    }
    return true;
  });
}

const MAX_SUBSEQUENCE_SPAN = 3;

/**
 * Scores a subsequence match, rewarding contiguous runs and word boundaries.
 * Returns -1 when the needle is absent, or when its characters are so spread
 * out that the "match" is coincidental rather than something the user typed.
 */
export function fuzzyScore(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  const hay = haystack.toLowerCase();
  const pin = needle.toLowerCase().replace(/\s+/g, "");
  if (pin.length === 0) return 0;

  const direct = hay.indexOf(needle.toLowerCase());
  if (direct !== -1) return 1000 - Math.min(direct, 500);

  let score = 0;
  let at = 0;
  let start = -1;
  let streak = 0;
  for (const char of pin) {
    const found = hay.indexOf(char, at);
    if (found === -1) return -1;
    if (start === -1) start = found;
    if (found === at) streak += 1;
    else streak = 0;
    const boundary = found === 0 || hay[found - 1] === " " || hay[found - 1] === "/";
    score += 1 + streak * 2 + (boundary ? 3 : 0);
    at = found + 1;
  }
  if (at - start > pin.length * MAX_SUBSEQUENCE_SPAN) return -1;
  return score;
}

/**
 * Ranks sessions against a live query. Literal hits in the title win, then the
 * project, then the cwd, then prompt text; a loose subsequence is only ever
 * considered against the title, so a long cwd cannot manufacture a match.
 */
export function fuzzyFilter(sessions: TSession[], query: string): TSession[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) return sessions;
  const needle = trimmed.toLowerCase();

  const scored: Array<{ session: TSession; score: number }> = [];
  for (const session of sessions) {
    let score = -1;
    const title = session.title.toLowerCase();
    const titleAt = title.indexOf(needle);

    if (titleAt !== -1) score = 4000 - Math.min(titleAt, 500);
    else if (session.project.toLowerCase().includes(needle)) score = 3000;
    else if (session.cwd.toLowerCase().includes(needle)) score = 2000;
    else if (session.prompts.some((prompt) => prompt.toLowerCase().includes(needle))) score = 1000;
    else {
      const loose = fuzzyScore(session.title, trimmed);
      if (loose >= 0) score = loose;
    }

    if (score >= 0) scored.push({ session, score });
  }

  scored.sort((a, b) => b.score - a.score || b.session.endedAt - a.session.endedAt);
  return scored.map((entry) => entry.session);
}
