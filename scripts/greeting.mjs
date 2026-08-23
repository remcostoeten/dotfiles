#!/usr/bin/env bun
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import os from "node:os";

const RESET = "[0m";
const DIM = "[2m";
const BRIGHT = "[1m";
const MAUVE = "[38;5;147m";
const SKY = "[38;5;116m";
const YELLOW = "[38;5;229m";
const PEACH = "[38;5;208m";
const SUBTEXT = "[38;5;217m";
const PANEL_WIDTH = 72;

function sh(command) {
  try {
    return execSync(command, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

function getVisibleLength(value) {
  return value.replace(/\[[0-9;]*m/g, "").length;
}

function panelBorder(left, right) {
  return `${DIM}${left}${"─".repeat(PANEL_WIDTH + 2)}${right}${RESET}`;
}

function panelLine(left, right = "") {
  const padding = " ".repeat(Math.max(1, PANEL_WIDTH - getVisibleLength(left) - getVisibleLength(right)));
  return `${DIM}│${RESET} ${left}${padding}${right} ${DIM}│${RESET}`;
}

function keyLine(key, value) {
  return `${DIM}${key.padEnd(7)}${RESET}${value}`;
}

function greetingForHour(hour) {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatUptime() {
  const seconds = os.uptime();
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function osPrettyName() {
  try {
    const release = readFileSync("/etc/os-release", "utf8");
    const match = release.match(/^PRETTY_NAME="?([^"\n]+)"?/m);
    if (match) return match[1];
  } catch {}
  return os.type();
}

function gitInfo() {
  const inside = sh("git rev-parse --is-inside-work-tree 2>/dev/null");
  if (inside !== "true") return null;
  const branch =
    sh("git symbolic-ref --short HEAD 2>/dev/null") ||
    sh("git describe --tags --exact-match 2>/dev/null") ||
    sh("git rev-parse --short HEAD 2>/dev/null");
  const dirty = sh("git status --porcelain 2>/dev/null");
  return { branch, dirty: dirty.length > 0 };
}

const now = new Date();
const hour = now.getHours();
const greeting = greetingForHour(hour);
const who = os.userInfo().username;
const host = os.hostname().split(".")[0];
const dateStr = now.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });
const timeStr = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
const shell = (process.env.SHELL || "").split("/").pop() || "shell";
const term = process.env.TERM_PROGRAM || process.env.TERM || "";
const cwd = process.cwd().replace(os.homedir(), "~");
const git = gitInfo();

const lines = [panelBorder("╭", "╮")];
lines.push(
  panelLine(
    `${BRIGHT}${MAUVE}${who}@${host}${RESET} ${DIM}·${RESET} ${greeting}`,
    `${DIM}${dateStr} · ${timeStr}${RESET}`,
  ),
);
lines.push(panelBorder("├", "┤"));
lines.push(panelLine(keyLine("os", `${SUBTEXT}${osPrettyName()}${RESET}`)));
lines.push(panelLine(keyLine("shell", `${SUBTEXT}${shell}${RESET}${term ? ` ${DIM}·${RESET} ${SUBTEXT}${term}${RESET}` : ""}`)));
lines.push(panelLine(keyLine("uptime", `${SUBTEXT}${formatUptime()}${RESET}`)));
lines.push(panelLine(keyLine("path", `${SKY}${cwd}${RESET}`)));
if (git) {
  const branchColor = git.dirty ? PEACH : SKY;
  const suffix = git.dirty ? ` ${YELLOW}✗ dirty${RESET}` : ` ${DIM}✓ clean${RESET}`;
  lines.push(panelLine(keyLine("git", `${branchColor}${git.branch}${RESET}${suffix}`)));
}
lines.push(panelBorder("╰", "╯"));

process.stdout.write(`${lines.join("\n")}\n`);
