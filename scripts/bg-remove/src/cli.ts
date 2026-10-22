#!/usr/bin/env node
import * as p from "@clack/prompts";
import pc from "picocolors";
import { existsSync, statSync } from "node:fs";
import { rename } from "node:fs/promises";
import { extname, basename, dirname, join, relative } from "node:path";
import { pickImages, printImage, displayPath } from "./picker.ts";
import {
  run,
  preloadModel,
  resolvedPath,
  defaultOutputPath,
  validateInput,
  type CompressionPreset,
  type OutputFormat,
  type Result,
  type RunOptions,
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

const PREVIEW_LIMIT = 4;

function noop(): void {}

function runOptions(input: string, output: string, format: OutputFormat, args: Args): RunOptions {
  return {
    input,
    output,
    format,
    ...(args.compression !== undefined ? { compression: args.compression } : {}),
    ...(args.quality !== undefined ? { quality: args.quality } : {}),
    ...(args.pngCompressionLevel !== undefined
      ? { pngCompressionLevel: args.pngCompressionLevel }
      : {}),
    ...(args.pngPalette !== undefined ? { pngPalette: args.pngPalette } : {}),
    ...(args.webpEffort !== undefined ? { webpEffort: args.webpEffort } : {}),
    ...(args.webpLossless !== undefined ? { webpLossless: args.webpLossless } : {}),
    ...(args.flipHorizontal ? { flipHorizontal: true } : {}),
  };
}

function printHelp(): void {
  console.log(`
${pc.bold("bg-remove")}  AI background removal

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

${pc.dim("Interactive picker:")}
  Fuzzy search (fzf) over images in the current directory, ~/Pictures,
  ~/Downloads, ~/Desktop and the rest of your home, with image previews.
  Tab marks files, Enter confirms. Typing a path such as
  ~/Downloads/photo.png also works, in the picker and as an argument.

${pc.dim("Examples:")}
  bg-remove photo.jpg
  bg-remove ~/Downloads/photo.jpg --format webp --compression small
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
    if (a === "--output") {
      const v = args[++i];
      if (v !== undefined) out.output = v;
      continue;
    }
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
    if (a === "--png-palette") {
      out.pngPalette = true;
      continue;
    }
    if (a === "--webp-effort") {
      const n = Number(args[++i]);
      if (!Number.isInteger(n) || n < 0 || n > 6) {
        console.error(pc.red("--webp-effort must be an integer from 0–6"));
        process.exit(1);
      }
      out.webpEffort = n;
      continue;
    }
    if (a === "--webp-lossless") {
      out.webpLossless = true;
      continue;
    }
    if (a === "--flip" || a === "--flip-horizontal") {
      out.flipHorizontal = true;
      continue;
    }
    if (a === "--restore-transparent") {
      out.restoreTransparent = true;
      continue;
    }
    if (!a.startsWith("--")) out.input = a;
  }

  return out;
}

function transparentTargetPath(path: string): string | null {
  const ext = extname(path);
  const base = basename(path, ext);
  if (!base.endsWith("-transparent")) return null;
  return join(dirname(path), `${base.slice(0, "-transparent".length * -1)}${ext}`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileSize(path: string): string {
  try {
    return formatBytes(statSync(path).size);
  } catch {
    return "unknown size";
  }
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

function fileLine(path: string): string {
  const ext = extname(path).slice(1).toUpperCase();
  return `${pc.bold(basename(path))}  ${pc.dim(`${ext} · ${fileSize(path)} · ${displayPath(dirname(path))}`)}`;
}

function previewFiles(files: string[]): void {
  console.log();
  for (const file of files.slice(0, PREVIEW_LIMIT)) {
    console.log(`  ${fileLine(file)}`);
    printImage(file);
    console.log();
  }
  if (files.length > PREVIEW_LIMIT) {
    console.log(pc.dim(`  and ${files.length - PREVIEW_LIMIT} more`));
    console.log();
  }
}

function exitIfCancelled(value: unknown, message = "Cancelled"): void {
  if (p.isCancel(value)) {
    p.cancel(message);
    process.exit(0);
  }
}

function validatedFiles(paths: string[]): string[] {
  const files = paths.map((path) => resolvedPath(path));
  for (const file of files) {
    const err = validateInput(file);
    if (err) {
      p.cancel(err);
      process.exit(1);
    }
  }
  return files;
}

async function interactiveMode(prefill: Args): Promise<void> {
  console.clear();
  p.intro(pc.bgWhite(pc.black(" bg-remove ")));
  preloadModel().catch(noop);

  let files: string[];
  if (prefill.input) {
    files = validatedFiles([prefill.input]);
  } else {
    const picked = await pickImages({ message: "Select images" });
    if (picked === null) {
      p.cancel("Cancelled");
      process.exit(0);
    }
    if (picked.length === 0) {
      p.cancel("No files selected");
      process.exit(0);
    }
    files = validatedFiles(picked);
  }

  p.log.step(`Selected ${files.length} file${files.length > 1 ? "s" : ""}`);
  previewFiles(files);

  const format = await p.select<OutputFormat>({
    message: "Output format",
    initialValue: prefill.format ?? "png",
    options: [
      { value: "png", label: "PNG", hint: "lossless, larger file" },
      { value: "webp", label: "WebP", hint: "lossy, smaller file" },
    ],
  });
  exitIfCancelled(format);

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
    exitIfCancelled(q);
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
  exitIfCancelled(compression);

  const flipHorizontal =
    prefill.flipHorizontal ??
    (await p.confirm({
      message: "Mirror output left-to-right?",
      initialValue: false,
    }));
  exitIfCancelled(flipHorizontal);

  const outputs: string[] = files.map((f) => defaultOutputPath(f, format as OutputFormat));

  if (files.length === 1) {
    const suggestedOut = outputs[0] as string;
    const custom = await p.text({
      message: "Output path",
      placeholder: displayPath(suggestedOut),
      initialValue: prefill.output ?? "",
      validate(v) {
        if (!v || !v.trim()) return undefined;
        const dir = dirname(resolvedPath(v.trim()));
        if (!existsSync(dir)) return `Directory does not exist: ${dir}`;
      },
    });
    exitIfCancelled(custom);
    outputs[0] = (custom as string).trim() ? resolvedPath((custom as string).trim()) : suggestedOut;
  }

  const summaryLines = files.map((f, i) => {
    const out = outputs[i] as string;
    return `${pc.dim("input")}   ${displayPath(f)}\n${pc.dim("output")}  ${displayPath(out)}`;
  });
  p.note(
    [
      ...summaryLines,
      `${pc.dim("format")}  ${(format as string).toUpperCase()}${quality !== undefined ? `  quality ${quality}` : ""}  ${pc.dim(formatHint(format as OutputFormat))}`,
      `${pc.dim("compression")}  ${compression as string}  ${pc.dim(compressionHint(compression as CompressionPreset))}`,
      `${pc.dim("mirror")}  ${flipHorizontal ? "yes" : "no"}`,
    ].join("\n\n"),
    `Summary (${files.length} file${files.length > 1 ? "s" : ""})`,
  );

  const confirmed = await p.confirm({ message: "Start processing?" });
  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel("Aborted");
    process.exit(0);
  }

  const chosen: Args = {
    ...prefill,
    compression: compression as CompressionPreset,
    flipHorizontal: flipHorizontal === true,
    ...(quality !== undefined ? { quality } : {}),
  };
  function startRun(i: number): Promise<Result> {
    return run(
      runOptions(files[i] as string, outputs[i] as string, format as OutputFormat, chosen),
    );
  }

  const results: Result[] = [];
  let ahead: Promise<Result> | undefined;
  for (let i = 0; i < files.length; i++) {
    const f = files[i] as string;
    const label =
      files.length > 1 ? `[${i + 1}/${files.length}] ${basename(f)}` : "Removing background";

    const current = ahead ?? startRun(i);
    ahead = i + 1 < files.length ? startRun(i + 1) : undefined;
    ahead?.catch(noop);

    const spinner = p.spinner();
    spinner.start(label);

    try {
      const result = await current;
      spinner.stop(pc.green("✓"));
      results.push(result);
    } catch (err) {
      spinner.stop(pc.red("✗"));
      p.cancel(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }

  previewFiles(results.map((r) => r.outputPath));
  const outLines = results.map(
    (r) =>
      `${pc.green("✓")} ${pc.bold(displayPath(r.outputPath))}  ${pc.dim(sizeStats(r.inputBytes, r.outputBytes))}`,
  );
  p.outro(outLines.join("\n"));
}

async function restoreTransparentMode(): Promise<void> {
  console.clear();
  p.intro(pc.bgWhite(pc.black(" bg-remove restore ")));

  const picked = await pickImages({
    message: "Select transparent files",
    filter: (path) => transparentTargetPath(path) !== null,
  });
  if (picked === null) {
    p.cancel("Cancelled");
    process.exit(0);
  }
  if (picked.length === 0) {
    p.cancel("No files selected");
    process.exit(0);
  }

  const files = picked.filter((file) => transparentTargetPath(file) !== null);
  if (files.length === 0) {
    p.cancel("Selected files are not *-transparent files");
    process.exit(1);
  }

  const summary = files.map((file) => {
    const target = transparentTargetPath(file) as string;
    const overwrite = existsSync(target) ? pc.dim("  overwrite") : "";
    return `${pc.dim("from")}  ${displayPath(file)}\n${pc.dim("to")}    ${displayPath(target)}${overwrite}`;
  });
  p.note(summary.join("\n\n"), `Restore ${files.length} file${files.length > 1 ? "s" : ""}`);

  const confirmed = await p.confirm({ message: "Overwrite originals?" });
  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel("Aborted");
    process.exit(0);
  }

  const restored: string[] = [];
  for (const file of files) {
    const target = transparentTargetPath(file);
    if (!target) continue;
    await rename(file, target);
    restored.push(target);
  }

  p.outro(restored.map((file) => `${pc.green("✓")} ${relative(process.cwd(), file)}`).join("\n"));
}

async function directMode(args: Args): Promise<void> {
  if (!args.input) {
    printHelp();
    process.exit(1);
  }

  const input = resolvedPath(args.input);
  const err = validateInput(input);
  if (err) {
    console.error(pc.red(err));
    process.exit(1);
  }

  const spinner = p.spinner();
  const fmt = args.format ?? "png";
  const out = args.output ? resolvedPath(args.output) : defaultOutputPath(input, fmt);

  p.intro(pc.bgWhite(pc.black(" bg-remove ")));
  spinner.start(`Processing ${pc.bold(basename(input))}`);

  try {
    const result = await run(runOptions(input, out, fmt, args));
    spinner.stop("Done");
    previewFiles([result.outputPath]);
    p.outro(
      `${pc.green("✓")} ${pc.bold(displayPath(result.outputPath))}  ${pc.dim(sizeStats(result.inputBytes, result.outputBytes))}`,
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

  const isInteractive =
    !args.input || process.argv.includes("--interactive") || process.argv.includes("-i");

  if (isInteractive) {
    if (!args.input) {
      console.clear();
      p.intro(pc.bgWhite(pc.black(" bg-remove ")));
      const mode = await p.select<"remove" | "restore">({
        message: "What do you want to do?",
        initialValue: "remove",
        options: [
          { value: "remove", label: "Remove background", hint: "create transparent output" },
          {
            value: "restore",
            label: "Restore names",
            hint: "rename *-transparent files back to originals",
          },
        ],
      });
      exitIfCancelled(mode);
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
