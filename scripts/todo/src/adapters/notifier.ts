import { spawn } from "node:child_process";

export interface Notification {
  title: string;
  body: string;
  urgent: boolean;
}

export interface Notifier {
  notify(notification: Notification): Promise<void>;
}

/**
 * The single place the CLI talks to the desktop notification service. macOS (`osascript`) and
 * Windows (`toast`) adapters slot in here by returning a different {@link Notifier}.
 */
export function createNotifier(): Notifier {
  return {
    async notify({ title, body, urgent }) {
      await runQuietly("notify-send", ["--app-name=todo", `--urgency=${urgent ? "critical" : "normal"}`, title, body]);
    },
  };
}

export function createRecordingNotifier(): Notifier & { sent: Notification[] } {
  const sent: Notification[] = [];
  return {
    sent,
    async notify(notification) {
      sent.push(notification);
    },
  };
}

/**
 * Resolves with the exit code and never rejects: a missing binary must not take down the
 * scheduler, and the caller decides whether the failure is worth recording.
 */
export function runQuietly(command: string, args: string[], cwd?: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "ignore", ...(cwd === undefined ? {} : { cwd }) });
    child.on("error", () => resolve(-1));
    child.on("close", (code) => resolve(code ?? -1));
  });
}
