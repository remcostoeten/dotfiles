import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runQuietly } from "../adapters/notifier";

export const SERVICE_NAME = "todo-scheduler.service";

/**
 * Where the reminder scheduler is wired to start automatically. A systemd user service is the
 * mechanism the rest of this dotfiles setup already uses for background work, and it covers the
 * two cases the CLI cannot: a fresh boot, and a shell that has since exited.
 */
export function getServicePath(): string {
  return join(process.env.HOME ?? ".", ".config", "systemd", "user", SERVICE_NAME);
}

export function buildServiceUnit(executable: string): string {
  return [
    "[Unit]",
    "Description=todo reminder scheduler",
    "After=graphical-session.target",
    "",
    "[Service]",
    "Type=simple",
    `ExecStart=${executable} due daemon run`,
    "Restart=always",
    "RestartSec=5",
    "",
    "[Install]",
    "WantedBy=default.target",
    "",
  ].join("\n");
}

/** Best-effort path to the installed `todo` launcher, falling back to how this process was started. */
export function findTodoExecutable(): string {
  const installed = join(process.env.HOME ?? ".", ".config", "dotfiles", "bin", "todo");
  if (existsSync(installed)) return installed;
  const script = process.argv[1];
  return script === undefined ? installed : `${process.execPath} ${script}`;
}

export async function installService(): Promise<{ path: string; enabled: boolean }> {
  const path = getServicePath();
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, buildServiceUnit(findTodoExecutable()), "utf8");

  await runQuietly("systemctl", ["--user", "daemon-reload"]);
  const enabled = (await runQuietly("systemctl", ["--user", "enable", "--now", SERVICE_NAME])) === 0;
  return { path, enabled };
}

export async function isServiceActive(): Promise<boolean> {
  return (await runQuietly("systemctl", ["--user", "is-active", "--quiet", SERVICE_NAME])) === 0;
}
