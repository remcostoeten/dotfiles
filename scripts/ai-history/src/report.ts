import {
  bold,
  cyan,
  dayKey,
  dim,
  formatCost,
  formatDuration,
  formatLines,
  formatTime,
  magenta,
  pad,
  padStart,
  truncate,
  yellow,
} from "./format";
import type { TSession } from "./types";

export function renderRow(session: TSession, width: number): string {
  const glyph = session.tool === "claude" ? magenta("●") : cyan("◆");
  const when = formatTime(session.endedAt);
  const duration = formatDuration(session.durationMs);
  const cost = formatCost(session.costUsd);
  const lines = formatLines(session.linesAdded, session.linesRemoved);
  const marker = session.transcript ? " " : dim("·");

  const linesWidth = 12;
  const costWidth = 8;
  const durationWidth = 6;
  const projectWidth = 16;
  const timeWidth = 11;

  const showLines = width >= 92;
  const showCost = width >= 78;
  const showDuration = width >= 68;
  const showProject = width >= 46;

  const fixed =
    2 +
    1 +
    (showProject ? projectWidth + 1 : 0) +
    timeWidth +
    1 +
    (showDuration ? durationWidth + 1 : 0) +
    (showCost ? costWidth + 1 : 0) +
    (showLines ? linesWidth : 0);
  const titleWidth = Math.max(10, width - fixed - 1);

  const cells: string[] = [
    `${glyph}${marker}`,
    padStart(dim(when), timeWidth),
  ];
  if (showProject) cells.push(pad(yellow(truncate(session.project, projectWidth)), projectWidth));
  cells.push(pad(truncate(session.title, titleWidth), titleWidth));
  if (showDuration) cells.push(padStart(dim(duration), durationWidth));
  if (showCost) cells.push(padStart(cost ? cyan(cost) : "", costWidth));
  if (showLines) cells.push(padStart(dim(lines), linesWidth));

  return cells.join(" ");
}

export function printList(sessions: TSession[], width: number): void {
  const out: string[] = [];
  for (const session of sessions) out.push(renderRow(session, width));
  process.stdout.write(`${out.join("\n")}\n`);
}

export function toJson(sessions: TSession[]): string {
  return JSON.stringify(
    sessions.map((session) => ({
      id: session.id,
      tool: session.tool,
      title: session.title,
      cwd: session.cwd,
      project: session.project,
      branch: session.branch,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      startedAtIso: session.startedAt ? new Date(session.startedAt).toISOString() : null,
      endedAtIso: session.endedAt ? new Date(session.endedAt).toISOString() : null,
      durationMs: session.durationMs,
      costUsd: session.costUsd,
      linesAdded: session.linesAdded,
      linesRemoved: session.linesRemoved,
      models: session.models,
      version: session.version,
      transcript: session.transcript,
      hasTranscript: session.transcript !== null,
      isSubagent: session.isSubagent,
      promptCount: session.promptCount,
    })),
    null,
    2,
  );
}

/**
 * Emits `value<TAB>description` lines for shell completion. Values are ranked
 * by how often they appear, so the projects worked in most come first.
 */
export function printCompletions(sessions: TSession[], what: string): void {
  if (what === "tools") {
    process.stdout.write("claude\tClaude Code sessions\ncodex\tCodex sessions\n");
    return;
  }

  const counts: Record<string, number> = {};
  for (const session of sessions) {
    if (session.isSubagent) continue;
    const value = what === "branches" ? session.branch : session.project;
    if (!value || value === "-") continue;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i.test(value)) continue;
    counts[value] = (counts[value] ?? 0) + 1;
  }

  const rows = Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => `${value}\t${count} session${count === 1 ? "" : "s"}`);

  process.stdout.write(rows.length > 0 ? `${rows.join("\n")}\n` : "");
}

type TBucket = {
  sessions: number;
  cost: number;
  hasCost: boolean;
  duration: number;
  added: number;
  removed: number;
};

function bucket(): TBucket {
  return { sessions: 0, cost: 0, hasCost: false, duration: 0, added: 0, removed: 0 };
}

function accumulate(target: TBucket, session: TSession): void {
  target.sessions++;
  if (session.costUsd !== null) {
    target.cost += session.costUsd;
    target.hasCost = true;
  }
  target.duration += session.durationMs ?? 0;
  target.added += session.linesAdded ?? 0;
  target.removed += session.linesRemoved ?? 0;
}

function bucketCost(stats: TBucket): string {
  return stats.hasCost ? formatCost(stats.cost) : "—";
}

export function printStats(sessions: TSession[]): void {
  const byTool: Record<string, TBucket> = {};
  const byProject: Record<string, TBucket> = {};
  const byDay: Record<string, number> = {};
  const byModel: Record<string, number> = {};
  const total = bucket();

  for (const session of sessions) {
    accumulate(total, session);
    accumulate((byTool[session.tool] ??= bucket()), session);
    accumulate((byProject[session.project] ??= bucket()), session);
    if (session.endedAt) byDay[dayKey(session.endedAt)] = (byDay[dayKey(session.endedAt)] ?? 0) + 1;
    for (const model of session.models) byModel[model] = (byModel[model] ?? 0) + 1;
  }

  const out: string[] = [];
  out.push(bold("Totals"));
  out.push(
    `  ${total.sessions} sessions · ${formatCost(total.cost)} · ${formatDuration(total.duration)} · +${total.added}/-${total.removed}`,
  );

  out.push("");
  out.push(bold("By tool"));
  for (const [tool, stats] of Object.entries(byTool).sort((a, b) => b[1].sessions - a[1].sessions)) {
    out.push(
      `  ${pad(tool, 8)} ${padStart(String(stats.sessions), 5)}  ${padStart(bucketCost(stats), 9)}  ${padStart(formatDuration(stats.duration), 7)}  +${stats.added}/-${stats.removed}`,
    );
  }

  out.push("");
  out.push(bold("By project"));
  const projects = Object.entries(byProject)
    .sort((a, b) => b[1].sessions - a[1].sessions)
    .slice(0, 25);
  for (const [project, stats] of projects) {
    out.push(
      `  ${pad(truncate(project, 26), 26)} ${padStart(String(stats.sessions), 5)}  ${padStart(bucketCost(stats), 9)}  ${padStart(formatDuration(stats.duration), 7)}  +${stats.added}/-${stats.removed}`,
    );
  }

  out.push("");
  out.push(bold("Busiest days"));
  const days = Object.entries(byDay)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [day, count] of days) out.push(`  ${day}  ${padStart(String(count), 4)} sessions`);

  out.push("");
  out.push(bold("Model mix"));
  const models = Object.entries(byModel).sort((a, b) => b[1] - a[1]);
  if (models.length === 0) out.push(dim("  none recorded"));
  for (const [model, count] of models) {
    out.push(`  ${pad(truncate(model, 32), 32)} ${padStart(String(count), 5)}`);
  }

  process.stdout.write(`${out.join("\n")}\n`);
}
