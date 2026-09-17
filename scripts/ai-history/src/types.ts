export type TTool = "claude" | "codex";

export type TSession = {
  id: string;
  tool: TTool;
  title: string;
  cwd: string;
  project: string;
  branch: string | null;
  startedAt: number;
  endedAt: number;
  durationMs: number | null;
  costUsd: number | null;
  linesAdded: number | null;
  linesRemoved: number | null;
  models: string[];
  version: string | null;
  transcript: string | null;
  isSubagent: boolean;
  promptCount: number;
  prompts: string[];
};

export type TTranscriptEntry = {
  kind: "user" | "assistant" | "thinking" | "tool" | "result" | "meta";
  label: string;
  text: string;
  timestamp: number | null;
};
