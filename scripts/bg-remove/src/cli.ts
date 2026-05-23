import * as p from "@clack/prompts";
import pc from "picocolors";
import { existsSync, statSync, readdirSync } from "node:fs";
import { rename } from "node:fs/promises";
import { extname, basename, dirname, join, relative, resolve as resolvePath } from "node:path";
import { homedir } from "node:os";
import {
  run,
  resolvedPath,
  defaultOutputPath,
  validateInput,
  type CompressionPreset,
  type OutputFormat,
  type Result,
} from "./remove-bg.ts";

type Args = {
  input?: string;
  output?: string;
  format?: OutputFormat;
  quality?: number;
  compression?: CompressionPreset;
  pngCompressionLevel?: number;
  pngPalette?: boolean;
  webpEffort?: number;
  webpLossless?: boolean;
  flipHorizontal?: boolean;
  restoreTransparent?: boolean;
};

function printHelp(): void {
  console.log(`
${pc.bold("bg-remove")} — AI background removal

${pc.dim("Usage:")}
  bg-remove                         interactive mode
  bg-remove <image>                 remove bg, png output next to source
  bg-remove <image> [options]       non-interactive with flags
  bg-remove --restore-transparent   pick *-transparent files and overwrite originals

${pc.dim("Options:")}
  --output <path>     output file path
  --format <fmt>      png | webp  (default: png)
  --quality <0-100>   compression quality (default: 100)
  --compression <p>   none | quick | balanced | small  (default: balanced)
  --png-level <0-9>   PNG compression level
  --png-palette       quantize PNG palette for smaller files
  --webp-effort <0-6> WebP compression effort
  --webp-lossless     lossless WebP output
  --flip              mirror output left-to-right
  --restore-transparent
                      rename selected *-transparent files back to original names
  --help, -h          show this help

${pc.dim("Examples:")}
  bg-remove photo.jpg
  bg-remove photo.jpg --format webp --compression small
  bg-remove photo.jpg --flip
  bg-remove --restore-transparent
  bg-remove photo.jpg --output ./out/result.png
`);
}

function parseArgs(argv: ReadonlyArray<string>): Args {
  const args = argv.slice(2);
  const out: Args = {};

  for (let i = 0; i < args.length; i++) {
    const a = args[i] as string;
    if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
    if (a === "--output") { const v = args[++i]; if (v !== undefined) out.output = v; continue; }
    if (a === "--format") {
      const v = args[++i];
      if (v !== "png" && v !== "webp") {
        console.error(pc.red(`--format must be png or webp, got "${v}"`));
        process.exit(1);
      }
      out.format = v;
      continue;
    }
    if (a === "--quality") {
      const q = Number(args[++i]);
      if (isNaN(q) || q < 0 || q > 100) {
        console.error(pc.red("--quality must be 0–100"));
        process.exit(1);
      }
      out.quality = q;
      continue;
    }
    if (a === "--compression") {
      const v = args[++i];
      if (v !== "none" && v !== "quick" && v !== "balanced" && v !== "small") {
        console.error(pc.red(`--compression must be none, quick, balanced, or small, got "${v}"`));
        process.exit(1);
      }
      out.compression = v;
      continue;
    }
    if (a === "--png-level") {
      const n = Number(args[++i]);
      if (!Number.isInteger(n) || n < 0 || n > 9) {
        console.error(pc.red("--png-level must be an integer from 0–9"));
        process.exit(1);
      }
      out.pngCompressionLevel = n;
      continue;
    }
    if (a === "--png-palette") { out.pngPalette = true; continue; }
    if (a === "--webp-effort") {
      const n = Number(args[++i]);
      if (!Number.isInteger(n) || n < 0 || n > 6) {
        console.error(pc.red("--webp-effort must be an integer from 0–6"));
        process.exit(1);
      }
      out.webpEffort = n;
      continue;
    }
    if (a === "--webp-lossless") { out.webpLossless = true; continue; }
    if (a === "--flip" || a === "--flip-horizontal") { out.flipHorizontal = true; continue; }
    if (a === "--restore-transparent") { out.restoreTransparent = true; continue; }
    if (!a.startsWith("--")) out.input = a;
  }

  return out;
}

function scanNearbyImages(): { label: string; value: string; hint?: string }[] {
  const seen = new Set<string>();
  const items: { label: string; value: string; hint?: string }[] = [];
  const dirs: string[] = ["."];

  try {
    for (const e of readdirSync(".", { withFileTypes: true })) {
      if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules") {
        dirs.push(e.name);
      }
    }
  } catch {}

  for (const d of ["Pictures", "Downloads", "Desktop"].map(d => join(homedir(), d))) {
    if (existsSync(d)) dirs.push(d);
  }

  const SCAN_LIMIT = 60;
  for (const dir of dirs) {
    if (items.length >= SCAN_LIMIT) break;
    try {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (items.length >= SCAN_LIMIT) break;
        if (!e.isFile()) continue;
        const ext = extname(e.name).toLowerCase();
        if (![".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(ext)) continue;
        const full = resolvePath(process.cwd(), dir, e.name);
        if (seen.has(full)) continue;
        seen.add(full);
        const rel = relative(process.cwd(), full);
        const dirPart = dirname(rel);
        const item: { label: string; value: string; hint?: string } = { label: basename(rel), value: full };
        if (dirPart !== ".") item.hint = dirPart;
        items.push(item);
      }
    } catch {}
  }

  return items;
}

function transparentTargetPath(path: string): string | null {
  const ext = extname(path);
  const base = basename(path, ext);
  if (!base.endsWith("-transparent")) return null;
  return join(dirname(path), `${base.slice(0, "-transparent".length * -1)}${ext}`);
}

function scanTransparentImages(): { label: string; value: string; hint?: string }[] {
  const items = scanNearbyImages()
    .filter(item => transparentTargetPath(item.value) !== null)
    .map(item => {
      const target = transparentTargetPath(item.value);
      if (target) return { ...item, hint: `→ ${relative(process.cwd(), target)}` };
      return item;
    });
  return items;
}

function fileSize(path: string): string {
  try {
    const bytes = statSync(path).size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } catch {
    return "unknown size";
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sizeStats(inputBytes: number, outputBytes: number): string {
  const diff = inputBytes - outputBytes;
  const pct = inputBytes === 0 ? 0 : Math.abs(diff / inputBytes) * 100;
  const direction = diff >= 0 ? "smaller" : "larger";
  return `${formatBytes(inputBytes)} → ${formatBytes(outputBytes)}  ${pct.toFixed(1)}% ${direction}`;
}

function formatHint(fmt: OutputFormat): string {
  return fmt === "png"
    ? "lossless, larger file, best quality"
    : "lossy, smaller file, good for web";
}

function compressionHint(preset: CompressionPreset): string {
  if (preset === "small") return "slowest, smallest output";
  if (preset === "balanced") return "good size with reasonable speed";
  if (preset === "quick") return "faster, less compression";
  return "minimal extra compression";
}

async function interactiveMode(prefill: Args): Promise<void> {
  console.clear();

  p.intro(pc.bgWhite(pc.black(" bg-remove ")));

  // --- FILE SELECTION ---
  const files: string[] = [];

  if (prefill.input) {
    const resolved = resolvedPath(prefill.input);
    const err = validateInput(resolved);
    if (err) { console.error(pc.red(err)); process.exit(1); }
    files.push(resolved);
  } else {
    const manualPath = await p.text({
      message: "Enter image path (optional, leave empty to browse)",
      placeholder: "photo.jpg",
      validate(v) {
        if (!v || !v.trim()) return undefined;
        const r = resolvedPath(v.trim());
        return validateInput(r) ?? undefined;
      },
    });
    if (p.isCancel(manualPath)) { p.cancel("Cancelled"); process.exit(0); }
    if (manualPath.trim()) {
      files.push(resolvedPath(manualPath.trim()));
    }

    const images = scanNearbyImages();
    if (images.length > 0) {
      const picked = await p.multiselect<string>({
        message: "Select images (space to toggle, enter to confirm)",
        options: images,
        required: false,
      });
      if (p.isCancel(picked)) { p.cancel("Cancelled"); process.exit(0); }
      files.push(...(picked as string[]));
    }

    if (files.length === 0) {
      p.cancel("No files selected");
      process.exit(0);
    }
  }

  // preview selected files
  const fileList = files.map(f => {
    const s = fileSize(f);
    const e = extname(f).slice(1).toUpperCase();
    return `${pc.bold(basename(f))}  ${pc.dim(`${e} · ${s}`)}`;
  });
  p.note(fileList.join("\n"), `Selected ${files.length} file${files.length > 1 ? "s" : ""}`);

  // --- FORMAT ---
  const format = await p.select<OutputFormat>({
    message: "Output format",
    initialValue: prefill.format ?? "png",
    options: [
      { value: "png", label: "PNG", hint: "lossless, larger file" },
      { value: "webp", label: "WebP", hint: "lossy, smaller file" },
    ],
  });
  if (p.isCancel(format)) { p.cancel("Cancelled"); process.exit(0); }

  let quality: number | undefined;
  if ((format as string) === "webp") {
    const q = await p.text({
      message: "Quality",
      placeholder: "85",
      initialValue: String(prefill.quality ?? 85),
      validate(v) {
        const n = Number(v);
        if (isNaN(n) || n < 0 || n > 100) return "Enter a number between 0 and 100";
      },
    });
    if (p.isCancel(q)) { p.cancel("Cancelled"); process.exit(0); }
    quality = Number(q);
  }

  const compression = await p.select<CompressionPreset>({
    message: "Compression",
    initialValue: prefill.compression ?? "balanced",
    options: [
      { value: "balanced", label: "Balanced", hint: "recommended" },
      { value: "small", label: "Small", hint: "slowest, smallest output" },
      { value: "quick", label: "Quick", hint: "faster, larger output" },
      { value: "none", label: "None", hint: "minimal extra compression" },
    ],
  });
  if (p.isCancel(compression)) { p.cancel("Cancelled"); process.exit(0); }

  const flipHorizontal = prefill.flipHorizontal ?? await p.confirm({
    message: "Mirror output left-to-right?",
    initialValue: false,
  });
  if (p.isCancel(flipHorizontal)) { p.cancel("Cancelled"); process.exit(0); }

  // --- OUTPUT ---
  const outputs: string[] = files.map(f => defaultOutputPath(f, format as OutputFormat));

  // single file → allow custom output path
  if (files.length === 1) {
    const suggestedOut = outputs[0] as string;
    const custom = await p.text({
      message: "Output path",
      placeholder: suggestedOut,
      initialValue: prefill.output ?? "",
      validate(v) {
        if (!v || !v.trim()) return undefined;
        const dir = resolvedPath(v.trim()).split("/").slice(0, -1).join("/");
        if (dir && !existsSync(dir)) return `Directory does not exist: ${dir}`;
      },
    });
    if (p.isCancel(custom)) { p.cancel("Cancelled"); process.exit(0); }
    outputs[0] = custom.trim() || suggestedOut;
  }

  // --- SUMMARY ---
  const summaryLines = files.map((f, i) => {
    const out = outputs[i] as string;
    return `${pc.dim("input")}   ${f}\n${pc.dim("output")}  ${out}`;
  });
  p.note(
    [
      ...summaryLines,
      `${pc.dim("format")}  ${(format as string).toUpperCase()}${quality !== undefined ? `  quality ${quality}` : ""}  ${pc.dim(formatHint(format as OutputFormat))}`,
      `${pc.dim("compression")}  ${compression as string}  ${pc.dim(compressionHint(compression as CompressionPreset))}`,
      `${pc.dim("mirror")}  ${flipHorizontal ? "yes" : "no"}`,
    ].join("\n\n"),
    `Summary (${files.length} file${files.length > 1 ? "s" : ""})`
  );

  const confirmed = await p.confirm({ message: "Start processing?" });
  if (p.isCancel(confirmed) || !confirmed) { p.cancel("Aborted"); process.exit(0); }

  // --- PROCESS ---
  const results: Result[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i] as string;
    const out = outputs[i] as string;
    const label = files.length > 1 ? `[${i + 1}/${files.length}] ${basename(f)}` : "Removing background";

    const spinner = p.spinner();
    spinner.start(label);

    try {
      const result = await run({
        input: f,
        output: out,
        format: format as OutputFormat,
        compression: compression as CompressionPreset,
        ...(quality !== undefined ? { quality } : {}),
        ...(prefill.pngCompressionLevel !== undefined ? { pngCompressionLevel: prefill.pngCompressionLevel } : {}),
        ...(prefill.pngPalette !== undefined ? { pngPalette: prefill.pngPalette } : {}),
        ...(prefill.webpEffort !== undefined ? { webpEffort: prefill.webpEffort } : {}),
        ...(prefill.webpLossless !== undefined ? { webpLossless: prefill.webpLossless } : {}),
        ...(flipHorizontal ? { flipHorizontal: true } : {}),
      });
      spinner.stop(pc.green("✓"));
      results.push(result);
    } catch (err) {
      spinner.stop(pc.red("✗"));
      p.cancel(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }

  // --- DONE ---
  const outLines = results.map(r =>
    `${pc.green("✓")} ${pc.bold(basename(r.outputPath))}  ${pc.dim(sizeStats(r.inputBytes, r.outputBytes))}`
  );
  p.outro(outLines.join("\n"));
}

async function restoreTransparentMode(): Promise<void> {
  console.clear();
  p.intro(pc.bgWhite(pc.black(" bg-remove restore ")));

  const transparentFiles = scanTransparentImages();
  if (transparentFiles.length === 0) {
    p.cancel("No *-transparent image files found nearby");
    process.exit(0);
  }

  const picked = await p.multiselect<string>({
    message: "Select transparent files to overwrite originals",
    options: transparentFiles,
    required: false,
  });
  if (p.isCancel(picked)) { p.cancel("Cancelled"); process.exit(0); }

  const files = picked as string[];
  if (files.length === 0) {
    p.cancel("No files selected");
    process.exit(0);
  }

  const summary = files.map(file => {
    const target = transparentTargetPath(file);
    return `${pc.dim("from")}  ${file}\n${pc.dim("to")}    ${target ?? ""}${target && existsSync(target) ? pc.dim("  overwrite") : ""}`;
  });
  p.note(summary.join("\n\n"), `Restore ${files.length} file${files.length > 1 ? "s" : ""}`);

  const confirmed = await p.confirm({ message: "Overwrite originals?" });
  if (p.isCancel(confirmed) || !confirmed) { p.cancel("Aborted"); process.exit(0); }

  const restored: string[] = [];
  for (const file of files) {
    const target = transparentTargetPath(file);
    if (!target) continue;
    await rename(file, target);
    restored.push(target);
  }

  p.outro(restored.map(file => `${pc.green("✓")} ${relative(process.cwd(), file)}`).join("\n"));
}

async function directMode(args: Args): Promise<void> {
  if (!args.input) { printHelp(); process.exit(1); }

  const input = resolvedPath(args.input);
  const err = validateInput(input);
  if (err) { console.error(pc.red(err)); process.exit(1); }

  const spinner = p.spinner();
  const fmt = args.format ?? "png";
  const out = args.output ?? defaultOutputPath(input, fmt);

  p.intro(pc.bgWhite(pc.black(" bg-remove ")));
  spinner.start(`Processing ${pc.bold(basename(input))}`);

  try {
    const result = await run({
      input,
      output: out,
      format: fmt,
      ...(args.compression !== undefined ? { compression: args.compression } : {}),
      ...(args.quality !== undefined ? { quality: args.quality } : {}),
      ...(args.pngCompressionLevel !== undefined ? { pngCompressionLevel: args.pngCompressionLevel } : {}),
      ...(args.pngPalette !== undefined ? { pngPalette: args.pngPalette } : {}),
      ...(args.webpEffort !== undefined ? { webpEffort: args.webpEffort } : {}),
      ...(args.webpLossless !== undefined ? { webpLossless: args.webpLossless } : {}),
      ...(args.flipHorizontal ? { flipHorizontal: true } : {}),
    });
    spinner.stop("Done");
    p.outro(
      `${pc.green("✓")} ${pc.bold(basename(result.outputPath))}  ${pc.dim(sizeStats(result.inputBytes, result.outputBytes))}`
    );
  } catch (e) {
    spinner.stop("Failed");
    p.cancel(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (args.restoreTransparent) {
    await restoreTransparentMode();
    return;
  }

  const isInteractive = !args.input || process.argv.includes("--interactive") || process.argv.includes("-i");

  if (isInteractive) {
    if (!args.input) {
      console.clear();
      p.intro(pc.bgWhite(pc.black(" bg-remove ")));
      const mode = await p.select<"remove" | "restore">({
        message: "What do you want to do?",
        initialValue: "remove",
        options: [
          { value: "remove", label: "Remove background", hint: "create transparent output" },
          { value: "restore", label: "Restore names", hint: "rename *-transparent files back to originals" },
        ],
      });
      if (p.isCancel(mode)) { p.cancel("Cancelled"); process.exit(0); }
      if (mode === "restore") {
        await restoreTransparentMode();
        return;
      }
    }
    await interactiveMode(args);
  } else {
    await directMode(args);
  }
}

main().catch((err: unknown) => {
  console.error(pc.red(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
