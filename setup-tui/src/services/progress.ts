import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";

export type ProgressState = {
  packages: Record<string, "pending" | "installing" | "success" | "failed">;
  timestamp: number;
  completed: string[];
  failed: string[];
};

const progressDir = join(process.env.HOME || "", ".dotfiles", "setup");
const progressFile = join(progressDir, "progress.json");

function ensureDir(): void {
  if (!existsSync(progressDir)) {
    mkdirSync(progressDir, { recursive: true });
  }
}

export function save(state: ProgressState): void {
  ensureDir();
  const tempFile = `${progressFile}.tmp`;
  writeFileSync(tempFile, JSON.stringify(state, null, 2));
  writeFileSync(progressFile, readFileSync(tempFile));
  unlinkSync(tempFile);
}

export function load(): ProgressState | null {
  if (!existsSync(progressFile)) {
    return null;
  }
  
  try {
    const content = readFileSync(progressFile, "utf-8");
    return JSON.parse(content) as ProgressState;
  } catch {
    return null;
  }
}

export function clear(): void {
  if (existsSync(progressFile)) {
    unlinkSync(progressFile);
  }
}

export function canResume(): boolean {
  const state = load();
  if (!state) return false;
  
  const hasPending = Object.values(state.packages).some(
    status => status === "pending" || status === "installing"
  );
  
  return hasPending;
}

export function createInitial(packageIds: string[]): ProgressState {
  const packages: Record<string, "pending"> = {};
  packageIds.forEach(id => {
    packages[id] = "pending";
  });
  
  return {
    packages,
    timestamp: Date.now(),
    completed: [],
    failed: [],
  };
}
