import { homedir } from "node:os";
import { join } from "node:path";

const HOME = homedir();

export const CLAUDE_HOME = join(HOME, ".claude");
export const CLAUDE_HISTORY = join(CLAUDE_HOME, "history.jsonl");
export const CLAUDE_PROJECTS = join(CLAUDE_HOME, "projects");

export const CODEX_HOME = join(HOME, ".codex");
export const CODEX_HISTORY = join(CODEX_HOME, "history.jsonl");
export const CODEX_SESSIONS = join(CODEX_HOME, "sessions");
export const CODEX_ARCHIVED = join(CODEX_HOME, "archived_sessions");
export const CODEX_INDEX = join(CODEX_HOME, "session_index.jsonl");

export const CACHE_DIR = join(HOME, ".cache", "ai-history");
export const CACHE_FILE = join(CACHE_DIR, "index.json");
