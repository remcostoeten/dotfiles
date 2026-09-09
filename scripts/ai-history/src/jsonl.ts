import { noop } from "./noop";

/**
 * Streams a file line by line without holding it in memory. Missing or
 * unreadable files yield nothing rather than throwing.
 */
export async function forEachLine(
  path: string,
  onLine: (line: string) => void,
): Promise<void> {
  let stream: ReadableStream<Uint8Array>;
  try {
    stream = Bun.file(path).stream();
  } catch {
    noop();
    return;
  }

  const decoder = new TextDecoder();
  let carry = "";

  try {
    for await (const chunk of stream) {
      carry += decoder.decode(chunk as Uint8Array, { stream: true });
      let start = 0;
      let idx = carry.indexOf("\n", start);
      while (idx !== -1) {
        if (idx > start) onLine(carry.slice(start, idx));
        start = idx + 1;
        idx = carry.indexOf("\n", start);
      }
      carry = carry.slice(start);
    }
  } catch {
    noop();
    return;
  }

  carry += decoder.decode();
  if (carry.length > 0) onLine(carry);
}

/** Parses a JSONL line, returning null instead of throwing on garbage. */
export function parseLine<T = any>(line: string): T | null {
  if (line.length === 0 || (line[0] !== "{" && line[0] !== "[")) return null;
  try {
    return JSON.parse(line) as T;
  } catch {
    noop();
    return null;
  }
}

/** Reads the first `bytes` of a file as text; empty string if unreadable. */
export async function readHead(path: string, bytes: number): Promise<string> {
  try {
    const file = Bun.file(path);
    return await file.slice(0, bytes).text();
  } catch {
    noop();
    return "";
  }
}

/** Reads the last `bytes` of a file as text; empty string if unreadable. */
export async function readTail(path: string, bytes: number): Promise<string> {
  try {
    const file = Bun.file(path);
    const size = file.size;
    const start = size > bytes ? size - bytes : 0;
    return await file.slice(start, size).text();
  } catch {
    noop();
    return "";
  }
}

/**
 * Pulls a flat string value out of a raw JSON line without parsing it. Returns
 * null when the key is absent or the value is not a plain string.
 */
export function rawString(line: string, key: string): string | null {
  const needle = `"${key}":"`;
  const at = line.indexOf(needle);
  if (at === -1) return null;
  const from = at + needle.length;
  let out = "";
  for (let i = from; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\\") {
      const next = line[i + 1];
      if (next === "n") out += "\n";
      else if (next === "t") out += "\t";
      else if (next === "u") {
        out += String.fromCharCode(parseInt(line.slice(i + 2, i + 6), 16) || 32);
        i += 4;
      } else out += next ?? "";
      i++;
      continue;
    }
    if (ch === '"') return out;
    out += ch;
  }
  return null;
}
