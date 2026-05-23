import { removeBackground, type Config } from "@imgly/background-removal-node";
import sharp from "sharp";
import { stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, extname, basename, dirname } from "node:path";
import { pathToFileURL } from "node:url";

export type OutputFormat = "png" | "webp";
export type CompressionPreset = "none" | "quick" | "balanced" | "small";

export type RunOptions = {
  input: string;
  output?: string;
  format?: OutputFormat;
  quality?: number;
  compression?: CompressionPreset;
  pngCompressionLevel?: number;
  pngPalette?: boolean;
  webpEffort?: number;
  webpLossless?: boolean;
  flipHorizontal?: boolean;
};

export type Result = {
  inputPath: string;
  outputPath: string;
  format: OutputFormat;
  inputBytes: number;
  outputBytes: number;
};

const SUPPORTED = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const IMG_LY_DIST_URL = new URL(
  "../node_modules/@imgly/background-removal-node/dist/",
  import.meta.url,
).href;

export function resolvedPath(raw: string): string {
  return resolve(process.cwd(), raw);
}

export function defaultOutputPath(input: string, format: OutputFormat): string {
  const dir = dirname(input);
  const ext = extname(input);
  const base = basename(input, ext);
  return resolve(dir, `${base}-transparent.${format}`);
}

export function validateInput(path: string): string | null {
  if (!existsSync(path)) return `File not found: ${path}`;
  const ext = extname(path).toLowerCase();
  if (!SUPPORTED.has(ext)) {
    return `Unsupported format "${ext}". Supported: ${[...SUPPORTED].join(", ")}`;
  }
  return null;
}

function compressionDefaults(format: OutputFormat, preset: CompressionPreset) {
  if (format === "png") {
    if (preset === "small") return { compressionLevel: 9, palette: true };
    if (preset === "balanced") return { compressionLevel: 9, palette: false };
    if (preset === "quick") return { compressionLevel: 6, palette: false };
    return { compressionLevel: 6, palette: false };
  }

  if (preset === "small") return { effort: 6, quality: 75 };
  if (preset === "balanced") return { effort: 4, quality: 85 };
  if (preset === "quick") return { effort: 2, quality: 90 };
  return { effort: 4, quality: 100 };
}

async function encodeOutput(buffer: Buffer, opts: RunOptions, format: OutputFormat): Promise<Buffer> {
  const preset = opts.compression ?? "balanced";
  let image = sharp(buffer);
  if (opts.flipHorizontal) image = image.flop();

  if (format === "png") {
    const defaults = compressionDefaults("png", preset);
    return image.png({
      compressionLevel: opts.pngCompressionLevel ?? defaults.compressionLevel,
      palette: opts.pngPalette ?? defaults.palette,
    }).toBuffer();
  }

  const defaults = compressionDefaults("webp", preset);
  return image.webp({
    quality: opts.quality ?? defaults.quality,
    effort: opts.webpEffort ?? defaults.effort,
    lossless: opts.webpLossless ?? false,
  }).toBuffer();
}

export async function run(opts: RunOptions): Promise<Result> {
  const input = resolvedPath(opts.input);
  const format = opts.format ?? "png";
  const out = opts.output ? resolvedPath(opts.output) : defaultOutputPath(input, format);
  const inputBytes = (await stat(input)).size;

  const config: Config = {
    publicPath: IMG_LY_DIST_URL,
    output: {
      format: format === "webp" ? "image/webp" : "image/png",
      quality: opts.quality !== undefined ? opts.quality / 100 : 1,
    },
  };

  const fileUrl = pathToFileURL(input).href;
  const result = await removeBackground(fileUrl, config);
  const rawBuffer = Buffer.from(await result.arrayBuffer());
  const buffer = await encodeOutput(rawBuffer, opts, format);
  await writeFile(out, buffer);
  const outputBytes = (await stat(out)).size;

  return { inputPath: input, outputPath: out, format, inputBytes, outputBytes };
}
