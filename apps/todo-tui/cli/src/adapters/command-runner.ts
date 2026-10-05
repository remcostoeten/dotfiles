import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { UserInputError } from "../domain/user-input-error";
import { toAbsolutePath } from "./sound";

export interface CommandResult {
  exitCode: number;
  error?: string;
}

export interface CommandRunner {
  run(command: string, cwd: string | undefined): Promise<CommandResult>;
}

const COMMAND_TIMEOUT_MS = 60_000;

/**
 * The single place a reminder's `--run` command reaches the OS. The command is handed to the
 * shell as one argv element, never concatenated into a larger command line, so nothing the
 * user stored can widen what gets executed.
 */
export function createCommandRunner(): CommandRunner {
  return {
    run(command, cwd) {
      return new Promise((resolve) => {
        const child = spawn("/bin/sh", ["-c", command], {
          stdio: "ignore",
          timeout: COMMAND_TIMEOUT_MS,
          ...(cwd === undefined ? {} : { cwd }),
        });
        child.on("error", (error: Error) => resolve({ exitCode: -1, error: error.message }));
        child.on("close", (code, signal) => {
          if (signal !== null) return resolve({ exitCode: -1, error: `terminated by ${signal}` });
          resolve({ exitCode: code ?? -1 });
        });
      });
    },
  };
}

export function createRecordingCommandRunner(exitCode = 0): CommandRunner & { calls: Array<{ command: string; cwd: string | undefined }> } {
  const calls: Array<{ command: string; cwd: string | undefined }> = [];
  return {
    calls,
    async run(command, cwd) {
      calls.push({ command, cwd });
      return { exitCode };
    },
  };
}

/**
 * Turns a `--cwd` value into the absolute directory to persist. The literal `pwd` captures the
 * directory the reminder is being created from, because the scheduler's own `$PWD` later is
 * unrelated to where the user was standing.
 *
 * @throws UserInputError when the directory does not exist or is not a directory.
 */
export function resolveCommandCwd(value: string, cwd: string = process.cwd()): string {
  const path = value === "pwd" ? cwd : toAbsolutePath(value, cwd);

  let stats;
  try {
    stats = statSync(path);
  } catch {
    throw new UserInputError(`Working directory not found: ${path}`);
  }
  if (!stats.isDirectory()) throw new UserInputError(`Working directory is not a directory: ${path}`);
  return path;
}
