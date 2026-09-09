import { forEachLine, parseLine } from "./jsonl";
import { blockText } from "./claude";
import type { TSession, TTranscriptEntry } from "./types";

function toolSummary(name: string, input: unknown): string {
  if (!input || typeof input !== "object") return name;
  const bag = input as Record<string, unknown>;
  const raw =
    bag.command ??
    bag.cmd ??
    bag.file_path ??
    bag.path ??
    bag.pattern ??
    bag.url ??
    bag.prompt ??
    bag.query;
  const candidate = Array.isArray(raw) ? raw.join(" ") : raw;
  if (typeof candidate !== "string") return name;
  const clean = candidate.replace(/\s+/g, " ").trim();
  return `${name}: ${clean}`;
}

function resultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const bag = block as Record<string, unknown>;
    if (bag.type === "tool_result") {
      parts.push(typeof bag.content === "string" ? bag.content : blockText(bag.content));
    } else if (bag.type === "text" && typeof bag.text === "string") {
      parts.push(bag.text);
    }
  }
  return parts.join("\n");
}

async function loadClaude(path: string): Promise<TTranscriptEntry[]> {
  const entries: TTranscriptEntry[] = [];

  await forEachLine(path, (line) => {
    const record = parseLine<any>(line);
    if (!record) return;
    const timestamp =
      typeof record.timestamp === "string" ? Date.parse(record.timestamp) || null : null;

    if (record.type === "user") {
      const content = record.message?.content;
      const text = blockText(content).trim();
      if (text.length > 0) {
        entries.push({ kind: "user", label: "You", text, timestamp });
        return;
      }
      const result = resultText(content).trim();
      if (result.length > 0) {
        entries.push({ kind: "result", label: "result", text: result, timestamp });
      }
      return;
    }

    if (record.type === "assistant") {
      const content = record.message?.content;
      if (!Array.isArray(content)) return;
      for (const block of content) {
        if (!block || typeof block !== "object") continue;
        const bag = block as Record<string, any>;
        if (bag.type === "text" && typeof bag.text === "string" && bag.text.trim()) {
          entries.push({ kind: "assistant", label: "Claude", text: bag.text, timestamp });
        } else if (bag.type === "thinking" && typeof bag.thinking === "string") {
          entries.push({ kind: "thinking", label: "thinking", text: bag.thinking, timestamp });
        } else if (bag.type === "tool_use") {
          entries.push({
            kind: "tool",
            label: toolSummary(String(bag.name ?? "tool"), bag.input),
            text: JSON.stringify(bag.input ?? {}, null, 2),
            timestamp,
          });
        }
      }
    }
  });

  return entries;
}

async function loadCodex(path: string): Promise<TTranscriptEntry[]> {
  const entries: TTranscriptEntry[] = [];

  await forEachLine(path, (line) => {
    const record = parseLine<any>(line);
    if (!record) return;
    const timestamp =
      typeof record.timestamp === "string" ? Date.parse(record.timestamp) || null : null;
    const payload = record.payload;
    if (!payload) return;

    if (record.type === "event_msg") {
      if (payload.type === "user_message" && typeof payload.message === "string") {
        entries.push({ kind: "user", label: "You", text: payload.message, timestamp });
        return;
      }
      if (payload.type === "agent_message" && typeof payload.message === "string") {
        entries.push({ kind: "assistant", label: "Codex", text: payload.message, timestamp });
        return;
      }
      if (payload.type !== "item_completed" || !payload.item) return;

      const item = payload.item;
      const text = Array.isArray(item.content)
        ? item.content.map((b: any) => (typeof b?.text === "string" ? b.text : "")).join("\n")
        : "";

      if (item.type === "UserMessage") {
        entries.push({ kind: "user", label: "You", text, timestamp });
      } else if (item.type === "AgentMessage") {
        entries.push({ kind: "assistant", label: "Codex", text, timestamp });
      } else if (item.type === "Reasoning") {
        entries.push({ kind: "thinking", label: "thinking", text, timestamp });
      } else if (item.type === "CommandExecution") {
        const command = Array.isArray(item.command) ? item.command.join(" ") : String(item.command);
        entries.push({
          kind: "tool",
          label: `exec: ${command.replace(/\s+/g, " ").trim()}`,
          text: command,
          timestamp,
        });
      } else if (item.type === "Plan") {
        entries.push({ kind: "meta", label: "plan", text: JSON.stringify(item, null, 2), timestamp });
      }
      return;
    }

    if (record.type === "response_item") {
      if (payload.type === "message") {
        if (payload.role === "developer" || payload.role === "system") return;
        const text = Array.isArray(payload.content)
          ? payload.content
              .map((b: any) => (typeof b?.text === "string" ? b.text : ""))
              .join("\n")
              .trim()
          : "";
        if (text.length === 0) return;
        entries.push({
          kind: payload.role === "assistant" ? "assistant" : "user",
          label: payload.role === "assistant" ? "Codex" : "You",
          text,
          timestamp,
        });
        return;
      }
      if (payload.type === "custom_tool_call" || payload.type === "function_call") {
        const raw = typeof payload.input === "string" ? payload.input : (payload.arguments ?? "");
        entries.push({
          kind: "tool",
          label: toolSummary(String(payload.name ?? "tool"), safeParse(raw)),
          text: String(raw),
          timestamp,
        });
      }
    }
  });

  return entries;
}

function safeParse(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return { command: raw };
  }
}

export async function loadTranscript(session: TSession): Promise<TTranscriptEntry[]> {
  if (!session.transcript) return [];
  return session.tool === "claude"
    ? loadClaude(session.transcript)
    : loadCodex(session.transcript);
}
