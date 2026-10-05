import { statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { extname } from "node:path";
import { UserInputError } from "../domain/user-input-error";
import type { SoundMode } from "../domain/task";
import { runQuietly } from "./notifier";

export interface SoundChoice {
  soundMode: SoundMode;
  soundPath?: string;
}

export interface SoundPlayer {
  play(choice: SoundChoice): Promise<void>;
}

/** Formats the adapter can hand to at least one of its players. */
export const SUPPORTED_SOUND_EXTENSIONS = [".mp3", ".wav", ".ogg", ".oga", ".flac", ".opus"];

const CUSTOM_PLAYERS: Array<{ command: string; args: (path: string) => string[] }> = [
  { command: "mpv", args: (path) => ["--no-video", "--really-quiet", path] },
  { command: "ffplay", args: (path) => ["-nodisp", "-autoexit", "-loglevel", "quiet", path] },
  { command: "mpg123", args: (path) => ["-q", path] },
];

/**
 * The single place the CLI produces audio. Playback failure is reported to the caller as a
 * message instead of an exception, because a silent reminder is still a delivered reminder.
 */
export function createSoundPlayer(): SoundPlayer {
  return {
    async play(choice) {
      if (choice.soundMode === "none") return;
      if (choice.soundMode === "default") {
        const code = await runQuietly("canberra-gtk-play", ["-i", "message"]);
        if (code !== 0) throw new Error("could not play the default notification sound");
        return;
      }

      const path = choice.soundPath;
      if (path === undefined) throw new Error("no custom sound path was stored");
      for (const player of CUSTOM_PLAYERS) {
        if ((await runQuietly(player.command, player.args(path))) === 0) return;
      }
      throw new Error(`no available player could play ${path}`);
    },
  };
}

export function createSilentSoundPlayer(): SoundPlayer & { played: SoundChoice[] } {
  const played: SoundChoice[] = [];
  return {
    played,
    async play(choice) {
      played.push(choice);
    },
  };
}

/**
 * Turns a `--sound` value into what gets persisted. A custom path is expanded, made absolute
 * against `cwd`, and validated now, so the scheduler never inherits a path it cannot resolve.
 *
 * @throws UserInputError when the file is missing, is not a file, is unreadable, or has an
 *   extension no player supports.
 */
export function resolveSoundChoice(value: string, cwd: string = process.cwd()): SoundChoice {
  if (value === "default") return { soundMode: "default" };
  if (value === "none") return { soundMode: "none" };

  const path = toAbsolutePath(value, cwd);
  const extension = extname(path).toLowerCase();
  if (!SUPPORTED_SOUND_EXTENSIONS.includes(extension)) {
    throw new UserInputError(`Unsupported sound format: ${value}\nSupported: ${SUPPORTED_SOUND_EXTENSIONS.join(", ")}`);
  }

  let stats;
  try {
    stats = statSync(path);
  } catch {
    throw new UserInputError(`Sound file not found: ${path}`);
  }
  if (!stats.isFile()) throw new UserInputError(`Sound path is not a file: ${path}`);

  return { soundMode: "custom", soundPath: path };
}

/** Expands a leading `~` and resolves `.`/`..` against `cwd`, so what is stored never moves. */
export function toAbsolutePath(value: string, cwd: string = process.cwd()): string {
  const home = process.env.HOME ?? "";
  if (value === "~") return home;
  const expanded = value.startsWith("~/") ? `${home}/${value.slice(2)}` : value;
  return isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);
}
