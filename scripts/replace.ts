#!/usr/bin/env bun

import { spawnSync } from "child_process";
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import { dirname, extname, join, resolve } from "path";
import { homedir } from "os";

// ─── types ────────────────────────────────────────────────────────────────────

type ClipSource = "wl-paste" | "xclip" | "xsel" | "pbpaste";
type ClipResult = { text: string; source: ClipSource };
type Color = "reset" | "dim" | "bold" | "red" | "green" | "yellow" | "cyan" | "white" | "magenta";

// ─── color ────────────────────────────────────────────────────────────────────

const ANSI: Record<Color, string> = {
  reset:   "\x1b[0m",
  dim:     "\x1b[2m",
  bold:    "\x1b[1m",
  red:     "\x1b[31m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  cyan:    "\x1b[36m",
  white:   "\x1b[97m",
  magenta: "\x1b[35m",
};

function c(color: Color, text: string): string {
  return `${ANSI[color]}${text}${ANSI.reset}`;
}

function dim(text: string): string {
  return c("dim", text);
}

// ─── output ───────────────────────────────────────────────────────────────────

function out(line: string): void {
  process.stdout.write(`${line}\n`);
}

function err(line: string): void {
  process.stderr.write(`${c("red", "✗")} ${line}\n`);
}

function die(msg: string): never {
  err(msg);
  process.exit(1);
}

// ─── clipboard ────────────────────────────────────────────────────────────────

function commandExists(bin: string): boolean {
  const result = spawnSync("sh", ["-lc", `command -v "$1" >/dev/null 2>&1`, "sh", bin], {
    stdio: "ignore",
  });
  return result.status === 0;
}

function readClip(): ClipResult {
  const candidates: Array<{ bin: string; args: string[]; source: ClipSource; env?: string }> = [
    { bin: "wl-paste", args: ["--no-newline"], source: "wl-paste", env: "WAYLAND_DISPLAY" },
    { bin: "xclip", args: ["-selection", "clipboard", "-o"], source: "xclip", env: "DISPLAY" },
    { bin: "xsel", args: ["--clipboard", "--output"], source: "xsel", env: "DISPLAY" },
    { bin: "pbpaste", args: [], source: "pbpaste" },
  ];
  const failures: string[] = [];

  for (const { bin, args, source, env } of candidates) {
    if (env && !process.env[env]) continue;
    if (!commandExists(bin)) continue;

    const result = spawnSync(bin, args, { encoding: "utf8" });
    const stderr = result.stderr.trim();

    if (result.status === 0 && stderr === "") {
      return { text: result.stdout, source };
    }

    if (stderr) {
      failures.push(`${bin}: ${stderr}`);
      continue;
    }

    failures.push(`${bin}: exited with status ${result.status ?? "unknown"}`);
  }

  if (failures.length > 0) {
    die(`clipboard read failed\n${failures.map(message => `  ${message}`).join("\n")}`);
  }

  if (process.env.WAYLAND_DISPLAY && !commandExists("wl-paste")) {
    die("wayland session detected but wl-paste is missing — install wl-clipboard");
  }

  die("no clipboard tool found — install wl-clipboard, xclip, xsel, or pbpaste");
}

// ─── history ──────────────────────────────────────────────────────────────────

const STORE = resolve(homedir(), ".dotfiles", "replaces");

function backupDir(absPath: string): string {
  const stripped = absPath.startsWith("/") ? absPath.slice(1) : absPath;
  return resolve(STORE, stripped);
}

function stampName(ext: string): string {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "T")
    .slice(0, 23) + ext;
}

function saveBackup(absPath: string, content: string): string {
  const dir = backupDir(absPath);
  mkdirSync(dir, { recursive: true });
  const name = stampName(extname(absPath) || ".bak");
  const dest = resolve(dir, name);
  writeFileSync(dest, content, "utf8");
  return dest;
}

function loadHistory(absPath: string): string[] {
  const dir = backupDir(absPath);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => !f.startsWith("."))
    .sort()
    .reverse();
}

function nthBackup(absPath: string, n: number): string {
  const entries = loadHistory(absPath);
  if (entries.length === 0) die(`no history found for ${absPath}`);
  const entry = entries[n - 1];
  if (!entry) die(`history entry ${n} does not exist (${entries.length} total)`);
  return resolve(backupDir(absPath), entry);
}

function formatBackupStamp(name: string): string {
  const match = name.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})/);
  if (!match) return name;
  const [, date, hour, minute, second, ms] = match;
  return `${date} ${hour}:${minute}:${second}.${ms}`;
}

// ─── count ────────────────────────────────────────────────────────────────────

function lineCount(text: string): number {
  return text === "" ? 0 : text.split("\n").length;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n !== 1 ? "s" : ""}`;
}

// ─── files ────────────────────────────────────────────────────────────────────

function validateTarget(absPath: string): void {
  try {
    const stat = statSync(absPath);
    if (stat.isDirectory()) die(`target is a directory: ${absPath}`);
  } catch {
    die(`file does not exist: ${absPath}`);
  }

  try {
    accessSync(absPath, constants.R_OK | constants.W_OK);
  } catch {
    die(`file is not readable and writable: ${absPath}`);
  }

  try {
    accessSync(dirname(absPath), constants.W_OK);
  } catch {
    die(`parent directory is not writable: ${dirname(absPath)}`);
  }
}

function atomicWrite(absPath: string, content: string): void {
  const tempDir = mkdtempSync(join(dirname(absPath), ".replace-"));
  const tempFile = join(tempDir, "next");

  try {
    writeFileSync(tempFile, content, "utf8");
    renameSync(tempFile, absPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

// ─── commands ─────────────────────────────────────────────────────────────────

function cmdReplace(absPath: string): void {
  validateTarget(absPath);

  let prev: string;
  try {
    prev = readFileSync(absPath, "utf8");
  } catch {
    die(`cannot read file: ${absPath}`);
  }

  const { text: next, source } = readClip();
  const backup = saveBackup(absPath, prev);
  atomicWrite(absPath, next);

  out(`${c("green", "✓ replaced")}  ${c("white", absPath)}`);
  out(`  ${dim(plural(lineCount(prev), "line"))} ${dim("→")} ${c("cyan", plural(lineCount(next), "line"))}`);
  out(`  ${dim("clipboard →")} ${dim(source)}`);
  out(`  ${dim("backup →")} ${dim(backup)}`);
}

function cmdHistory(absPath: string): void {
  const entries = loadHistory(absPath);
  if (entries.length === 0) {
    out(`${c("yellow", "no history")} for ${c("white", absPath)}`);
    return;
  }

  out(`${c("cyan", "history")} ${dim("·")} ${c("white", absPath)}\n`);
  entries.forEach((name, i) => {
    const idx = c("magenta", `[${i + 1}]`);
    const stamp = formatBackupStamp(name);
    out(`  ${idx}  ${dim(stamp)}  ${dim("→")} ${name}`);
  });
  out("");
  out(`  ${dim("restore with:")} replace ${absPath} --history ${c("yellow", "N")}`);
}

function cmdHistoryRestore(absPath: string, n: number): void {
  validateTarget(absPath);

  const backupPath = nthBackup(absPath, n);
  let content: string;
  try {
    content = readFileSync(backupPath, "utf8");
  } catch {
    die(`cannot read backup: ${backupPath}`);
  }

  let current: string;
  try {
    current = readFileSync(absPath, "utf8");
  } catch {
    die(`cannot read file: ${absPath}`);
  }

  saveBackup(absPath, current);
  atomicWrite(absPath, content);

  out(`${c("green", "✓ restored")}  ${c("white", absPath)}`);
  out(`  ${dim("from backup")} ${dim("[")}${c("magenta", String(n))}${dim("]")}`);
  out(`  ${dim(plural(lineCount(current), "line"))} ${dim("→")} ${c("cyan", plural(lineCount(content), "line"))}`);
}

function cmdRevert(absPath: string): void {
  cmdHistoryRestore(absPath, 1);
}

// ─── help ─────────────────────────────────────────────────────────────────────

function showHelp(): void {
  const S = " ";
  const pad = "  ";

  out("");
  out(`${pad}${c("white", c("bold", "replace"))} ${dim("·")} clipboard → file, with history`);
  out("");
  out(`${pad}${c("cyan", "usage")}`);
  out(`${pad}${S.repeat(2)}replace ${c("yellow", "<file>")}                    replace file with clipboard contents`);
  out(`${pad}${S.repeat(2)}replace ${c("yellow", "<file>")} --history           list saved backups`);
  out(`${pad}${S.repeat(2)}replace ${c("yellow", "<file>")} --history ${c("magenta", "N")}         restore Nth backup ${dim("(1 = most recent)")}`);
  out(`${pad}${S.repeat(2)}replace ${c("yellow", "<file>")} --revert ${dim("/")} -r       restore most recent backup`);
  out(`${pad}${S.repeat(2)}replace -h ${dim("/")} --help                 show this menu`);
  out("");
  out(`${pad}${c("cyan", "backups")}`);
  out(`${pad}${S.repeat(2)}stored in ${c("white", "~/.dotfiles/replaces/<abs-path-to-file>/")}`);
  out(`${pad}${S.repeat(2)}each backup is timestamped and never overwritten`);
  out(`${pad}${S.repeat(2)}reverting also creates a backup of the current state`);
  out("");
  out(`${pad}${c("cyan", "clipboard")}`);
  out(`${pad}${S.repeat(2)}prefers ${c("white", "wl-paste")} ${dim("(wayland)")}  →  falls back to ${c("white", "xclip")}, ${c("white", "xsel")}, or ${c("white", "pbpaste")}`);
  out("");
}

// ─── main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "-h" || args[0] === "--help") {
    showHelp();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const [rawPath, flag, flagArg] = args;
  const absPath = resolve(rawPath as string);

  if (!flag) {
    cmdReplace(absPath);
    return;
  }

  if (flag === "--revert" || flag === "-r") {
    cmdRevert(absPath);
    return;
  }

  if (flag === "--history") {
    if (!flagArg) {
      cmdHistory(absPath);
      return;
    }
    const n = parseInt(flagArg, 10);
    if (Number.isNaN(n) || n < 1) die(`invalid history index: ${flagArg}`);
    cmdHistoryRestore(absPath, n);
    return;
  }

  die(`unknown flag: ${flag}\nrun replace --help for usage`);
}

main();
