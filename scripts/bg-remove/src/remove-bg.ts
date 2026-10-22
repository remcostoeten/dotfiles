import sharp from "sharp";
import type { InferenceSession } from "onnxruntime-node";
import { readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, extname, basename, dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

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

type Photo = {
  data: Buffer;
  width: number;
  height: number;
};

type ModelName = "small" | "medium";
type ResourceEntry = {
  size: number;
  chunks: Array<{ hash: string }>;
};
type Ort = typeof import("onnxruntime-node");

const SUPPORTED = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const MODEL_DIR = fileURLToPath(
  new URL("../node_modules/@imgly/background-removal-node/dist/", import.meta.url),
);
const MODEL_NAME: ModelName = "medium";
const MODEL_RESOLUTION = 1024;
const MODEL_PIXELS = MODEL_RESOLUTION * MODEL_RESOLUTION;

let ortPromise: Promise<Ort> | undefined;
let sessionPromise: Promise<InferenceSession> | undefined;
let inferenceChain: Promise<unknown> = Promise.resolve();

function noop(): void {}

/**
 * @name expandHome
 * @description Replaces a leading `~` with the user's home directory.
 *
 * @example
 * expandHome("~/Downloads/a.png") // "/home/me/Downloads/a.png"
 */
export function expandHome(raw: string): string {
  if (raw === "~") return homedir();
  return raw.startsWith("~/") ? join(homedir(), raw.slice(2)) : raw;
}

/**
 * @name resolvedPath
 * @description Resolves a user-supplied path, expanding `~`, against the working directory.
 *
 * @example
 * resolvedPath("~/Downloads/a.png")
 */
export function resolvedPath(raw: string): string {
  return resolve(process.cwd(), expandHome(raw));
}

/**
 * @name defaultOutputPath
 * @description Builds the `<name>-transparent.<format>` path next to the input file.
 *
 * @example
 * defaultOutputPath("/photos/a.jpg", "png") // "/photos/a-transparent.png"
 */
export function defaultOutputPath(input: string, format: OutputFormat): string {
  const dir = dirname(input);
  const ext = extname(input);
  const base = basename(input, ext);
  return resolve(dir, `${base}-transparent.${format}`);
}

/**
 * @name validateInput
 * @description Returns an error message when the path is missing or has an unsupported
 * extension, and null when it can be processed.
 *
 * @example
 * const err = validateInput("/photos/a.gif"); // 'Unsupported format ".gif". ...'
 */
export function validateInput(path: string): string | null {
  if (!existsSync(path)) return `File not found: ${path}`;
  const ext = extname(path).toLowerCase();
  if (!SUPPORTED.has(ext)) {
    return `Unsupported format "${ext}". Supported: ${[...SUPPORTED].join(", ")}`;
  }
  return null;
}

function loadOrt(): Promise<Ort> {
  ortPromise ??= import("onnxruntime-node");
  return ortPromise;
}

async function readModel(name: ModelName): Promise<Buffer> {
  const resources: Record<string, ResourceEntry | undefined> = JSON.parse(
    await readFile(join(MODEL_DIR, "resources.json"), "utf8"),
  );
  const entry = resources[`/models/${name}`];
  if (!entry || !Array.isArray(entry.chunks)) {
    throw new Error(`Model "${name}" not found in ${MODEL_DIR}`);
  }
  const chunks = await Promise.all(
    entry.chunks.map((chunk) => readFile(join(MODEL_DIR, chunk.hash))),
  );
  const model = Buffer.concat(chunks);
  if (model.byteLength !== entry.size) {
    throw new Error(`Model "${name}" is ${model.byteLength} bytes, expected ${entry.size}`);
  }
  return model;
}

async function createSession(): Promise<InferenceSession> {
  const [ort, model] = await Promise.all([loadOrt(), readModel(MODEL_NAME)]);
  return ort.InferenceSession.create(model, { graphOptimizationLevel: "all" });
}

/**
 * @name preloadModel
 * @description Starts loading the segmentation model and creating its inference session.
 * Later calls and `run` share the same session, so call this as early as possible to
 * overlap the load with user input. The returned promise rejects when the model files
 * are missing.
 *
 * @example
 * preloadModel().catch(noop);
 * const files = await pickImages({ message: "Select images" });
 */
export function preloadModel(): Promise<InferenceSession> {
  sessionPromise ??= createSession();
  return sessionPromise;
}

function queueInference<T>(task: () => Promise<T>): Promise<T> {
  const result = inferenceChain.then(task);
  inferenceChain = result.catch(noop);
  return result;
}

async function decodePhoto(input: string): Promise<Photo> {
  const { data, info } = await sharp(input)
    .rotate()
    .toColourspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) {
    throw new Error(`Expected 3 colour channels after decoding, got ${info.channels}`);
  }
  return { data, width: info.width, height: info.height };
}

function rawPhoto(photo: Photo): sharp.Sharp {
  return sharp(photo.data, {
    raw: { width: photo.width, height: photo.height, channels: 3 },
  });
}

function modelInput(scaled: Buffer): Float32Array {
  const planes = new Float32Array(3 * MODEL_PIXELS);
  let pixel = 0;
  let channel = 0;
  for (const value of scaled) {
    planes[channel * MODEL_PIXELS + pixel] = (value - 128) / 256;
    channel += 1;
    if (channel === 3) {
      channel = 0;
      pixel += 1;
    }
  }
  return planes;
}

function alphaFromPrediction(prediction: Float32Array): Buffer {
  const alpha = Buffer.alloc(MODEL_PIXELS);
  let i = 0;
  for (const value of prediction) {
    alpha[i] = value * 255;
    i += 1;
  }
  return alpha;
}

async function segment(photo: Photo, session: InferenceSession): Promise<Buffer> {
  const [ort, scaled] = await Promise.all([
    loadOrt(),
    rawPhoto(photo)
      .resize(MODEL_RESOLUTION, MODEL_RESOLUTION, { fit: "fill", kernel: "linear" })
      .raw()
      .toBuffer(),
  ]);
  const feeds = {
    input: new ort.Tensor("float32", modelInput(scaled), [
      1,
      3,
      MODEL_RESOLUTION,
      MODEL_RESOLUTION,
    ]),
  };
  const outputs = await queueInference(() => session.run(feeds));
  const prediction = outputs["output"]?.data;
  if (!(prediction instanceof Float32Array) || prediction.length !== MODEL_PIXELS) {
    throw new Error("Model returned an unexpected output tensor");
  }
  return alphaFromPrediction(prediction);
}

async function cutout(photo: Photo, alpha: Buffer): Promise<sharp.Sharp> {
  const { data: mask, info } = await sharp(alpha, {
    raw: { width: MODEL_RESOLUTION, height: MODEL_RESOLUTION, channels: 1 },
  })
    .resize(photo.width, photo.height, { fit: "fill", kernel: "linear" })
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 1) {
    throw new Error(`Expected a single-channel mask after resizing, got ${info.channels}`);
  }
  return rawPhoto(photo).joinChannel(mask, {
    raw: { width: photo.width, height: photo.height, channels: 1 },
  });
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

async function encodeOutput(
  image: sharp.Sharp,
  opts: RunOptions,
  format: OutputFormat,
): Promise<Buffer> {
  const preset = opts.compression ?? "balanced";
  if (opts.flipHorizontal) image = image.flop();

  if (format === "png") {
    const defaults = compressionDefaults("png", preset);
    return image
      .png({
        compressionLevel: opts.pngCompressionLevel ?? defaults.compressionLevel,
        palette: opts.pngPalette ?? defaults.palette,
      })
      .toBuffer();
  }

  const defaults = compressionDefaults("webp", preset);
  return image
    .webp({
      quality: opts.quality ?? defaults.quality,
      effort: opts.webpEffort ?? defaults.effort,
      lossless: opts.webpLossless ?? false,
    })
    .toBuffer();
}

/**
 * @name run
 * @description Removes the background from one image and writes the result. The image is
 * decoded once, scaled to the model resolution with sharp, segmented on the shared
 * inference session, and the predicted mask is upscaled and joined as the alpha channel
 * before a single encode. Concurrent calls queue for the model one at a time while their
 * decode and encode work overlaps.
 *
 * @example
 * const result = await run({ input: "~/Downloads/photo.jpg", format: "webp" });
 */
export async function run(opts: RunOptions): Promise<Result> {
  const input = resolvedPath(opts.input);
  const format = opts.format ?? "png";
  const out = opts.output ? resolvedPath(opts.output) : defaultOutputPath(input, format);

  const [inputBytes, photo, session] = await Promise.all([
    stat(input).then((info) => info.size),
    decodePhoto(input),
    preloadModel(),
  ]);
  const alpha = await segment(photo, session);
  const buffer = await encodeOutput(await cutout(photo, alpha), opts, format);
  await writeFile(out, buffer);

  return { inputPath: input, outputPath: out, format, inputBytes, outputBytes: buffer.byteLength };
}
