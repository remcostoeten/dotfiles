import { spawn, spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import * as p from "@clack/prompts";
import { resolvedPath } from "./remove-bg.ts";

type PickOptions = {
  message: string;
  filter?: (path: string) => boolean;
};

type Finder = "fd" | "find";
type ImageFormat = "kitty" | "symbols";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "avif"];
const SKIPPED_DIRS = ["node_modules", "Android", "android-studio", "go", "target", "dist", "build"];
const FALLBACK_LIMIT = 500;

function noop(): void {}

const commandCache = new Map<string, boolean>();

function hasCommand(name: string): boolean {
  let found = commandCache.get(name);
  if (found === undefined) {
    found = spawnSync("sh", ["-c", `command -v ${name}`], { stdio: "ignore" }).status === 0;
    commandCache.set(name, found);
  }
  return found;
}

function imageFormat(): ImageFormat {
  const forced = process.env.BG_REMOVE_PREVIEW;
  if (forced === "kitty" || forced === "symbols") return forced;
  const terminal = `${process.env.TERM ?? ""} ${process.env.TERM_PROGRAM ?? ""}`.toLowerCase();
  const kittyLike = ["kitty", "ghostty", "wezterm"].some((name) => terminal.includes(name));
  return process.env.KITTY_WINDOW_ID || kittyLike ? "kitty" : "symbols";
}

function searchRoots(): string[] {
  const home = homedir();
  const roots = [
    process.cwd(),
    join(home, "Pictures"),
    join(home, "Downloads"),
    join(home, "Desktop"),
    home,
  ];
  return roots.filter((root, index) => existsSync(root) && roots.indexOf(root) === index);
}

function finderCommand(finder: Finder, root: string): string[] {
  if (finder === "fd") {
    const args = ["fd", "--type", "f", "--absolute-path"];
    for (const ext of IMAGE_EXTENSIONS) args.push("-e", ext);
    for (const dir of SKIPPED_DIRS) args.push("--exclude", dir);
    return [...args, ".", root];
  }
  const prune = SKIPPED_DIRS.flatMap((dir, index) =>
    index === 0 ? ["-name", dir] : ["-o", "-name", dir],
  );
  const names = IMAGE_EXTENSIONS.flatMap((ext, index) =>
    index === 0 ? ["-iname", `*.${ext}`] : ["-o", "-iname", `*.${ext}`],
  );
  return [
    "find",
    root,
    "(",
    ...prune,
    ")",
    "-prune",
    "-o",
    "-type",
    "f",
    "(",
    ...names,
    ")",
    "-print",
  ];
}

async function* findImages(filter?: (path: string) => boolean): AsyncGenerator<string> {
  const finder: Finder = hasCommand("fd") ? "fd" : "find";
  const seen = new Set<string>();
  for (const root of searchRoots()) {
    const [command = "find", ...args] = finderCommand(finder, root);
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "ignore"] });
    const lines = createInterface({ input: child.stdout });
    try {
      for await (const line of lines) {
        if (!line || seen.has(line)) continue;
        seen.add(line);
        if (filter && !filter(line)) continue;
        yield line;
      }
    } finally {
      child.kill();
    }
  }
}

function typedPath(query: string): string[] {
  const typed = query.trim();
  if (!typed) return [];
  const path = resolvedPath(typed);
  return existsSync(path) && statSync(path).isFile() ? [path] : [];
}

async function pickWithFzf(options: PickOptions): Promise<string[] | null> {
  const args = [
    "--multi",
    "--delimiter",
    "\t",
    "--with-nth",
    "1",
    "--scheme",
    "path",
    "--print-query",
    "--prompt",
    `${options.message} > `,
    "--header",
    "tab marks, enter confirms, esc cancels, or type a path",
    "--bind",
    "ctrl-a:select-all",
    "--with-shell",
    "sh -c",
  ];
  if (hasCommand("chafa")) {
    const preview = `chafa -f ${imageFormat()} -s \${FZF_PREVIEW_COLUMNS}x\${FZF_PREVIEW_LINES} {2}`;
    args.push("--preview", preview, "--preview-window", "right,55%,border-left");
  }

  const fzf = spawn("fzf", args, { stdio: ["pipe", "pipe", "inherit"] });
  fzf.stdin.on("error", noop);
  let output = "";
  fzf.stdout.setEncoding("utf8");
  fzf.stdout.on("data", (chunk) => {
    output += chunk;
  });
  const closed = new Promise<number>((resolve) => {
    fzf.on("close", (code) => resolve(code ?? 1));
  });

  async function feed(): Promise<void> {
    for await (const path of findImages(options.filter)) {
      if (fzf.exitCode !== null || !fzf.stdin.writable) break;
      fzf.stdin.write(`${displayPath(path)}\t${path}\n`);
    }
    fzf.stdin.end();
  }
  feed().catch(noop);

  const code = await closed;
  if (code === 130 || code === 2) return null;

  const [query = "", ...lines] = output.split("\n");
  const selected = lines.map((line) => line.split("\t")[1] ?? "").filter(Boolean);
  return selected.length > 0 ? selected : typedPath(query);
}

async function pickWithClack(options: PickOptions): Promise<string[] | null> {
  const choices: Array<{ value: string; label: string }> = [];
  for await (const path of findImages(options.filter)) {
    choices.push({ value: path, label: displayPath(path) });
    if (choices.length >= FALLBACK_LIMIT) break;
  }
  if (choices.length === 0) return [];
  const picked = await p.autocompleteMultiselect<string>({
    message: options.message,
    options: choices,
    maxItems: 15,
    required: false,
  });
  return p.isCancel(picked) ? null : picked;
}

/**
 * @name displayPath
 * @description Shortens an absolute path under the home directory to its `~` form.
 *
 * @example
 * displayPath("/home/me/Downloads/a.png") // "~/Downloads/a.png"
 */
export function displayPath(path: string): string {
  const home = homedir();
  if (path === home) return "~";
  return path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}

/**
 * @name pickImages
 * @description Lets the user pick one or more images with fzf (fd scan of the working
 * directory, ~/Pictures, ~/Downloads, ~/Desktop and the rest of home, with chafa previews).
 * A typed path that exists is accepted as-is. Falls back to a clack list without fzf.
 * Resolves to null when the user cancels.
 *
 * @example
 * const files = await pickImages({ message: "Select images" });
 */
export async function pickImages(options: PickOptions): Promise<string[] | null> {
  return hasCommand("fzf") ? pickWithFzf(options) : pickWithClack(options);
}

/**
 * @name printImage
 * @description Renders an image inline in the terminal with chafa, using the kitty
 * graphics protocol on terminals that support it. Does nothing when chafa is missing.
 *
 * @example
 * printImage("/home/me/photo.png")
 */
export function printImage(path: string, columns = 48): void {
  if (!hasCommand("chafa")) return;
  spawnSync("chafa", ["-f", imageFormat(), "-s", `${columns}x${Math.round(columns / 3)}`, path], {
    stdio: "inherit",
  });
}
