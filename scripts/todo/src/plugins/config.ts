import { formatShellDisplayLimit, normalizeShellDisplayLimit, parseShellDisplayLimit } from "../domain/shell-display-limit";
import type { TodoConfig } from "../domain/task";
import { UserInputError } from "../domain/user-input-error";
import type { TodoPlugin } from "./types";

const DIM = "\u001B[2m";
const RESET = "\u001B[0m";

interface ConfigSetting {
  name: string;
  description: string;
  read(config: TodoConfig): string;
  apply(config: TodoConfig, value: string): TodoConfig;
}

const SETTINGS: ConfigSetting[] = [
  {
    name: "shell-limit",
    description: "Pending tasks shown in the shell panel (number, or 'all')",
    read(config) {
      return formatShellDisplayLimit(normalizeShellDisplayLimit(config.shellDisplayLimit));
    },
    apply(config, value) {
      return { ...config, shellDisplayLimit: parseShellDisplayLimit(value) };
    },
  },
  {
    name: "startup-notifications",
    description: "Send desktop notifications for due tasks on startup (on/off)",
    read(config) {
      return formatBoolean(config.showNotificationsOnStartup);
    },
    apply(config, value) {
      return { ...config, showNotificationsOnStartup: parseBoolean(value) };
    },
  },
  {
    name: "show-completed",
    description: "Include completed tasks in listings by default (on/off)",
    read(config) {
      return formatBoolean(config.showCompletedTasksByDefault);
    },
    apply(config, value) {
      return { ...config, showCompletedTasksByDefault: parseBoolean(value) };
    },
  },
];

export const configPlugin: TodoPlugin = {
  name: "config",
  description: "Reads and writes persisted settings.",
  register(app) {
    app.command("config", "Show settings, or set one with 'todo config <key> <value>'.", async ({ args, store, stdout }) => {
      const config = await store.loadConfig();
      const [name, ...valueParts] = stripVerb(args);

      if (name === undefined) {
        for (const setting of SETTINGS) {
          stdout.write(`${setting.name.padEnd(22)} ${setting.read(config)}${DIM}  ${setting.description}${RESET}\n`);
        }
        return;
      }

      const setting = findSetting(name);
      if (valueParts.length === 0) {
        stdout.write(`${setting.read(config)}\n`);
        return;
      }

      const updated = setting.apply(config, valueParts.join(" "));
      await store.saveConfig(updated);
      stdout.write(`${setting.name} = ${setting.read(updated)}\n`);
    });
  },
};

function stripVerb(args: string[]): string[] {
  return args[0] === "set" || args[0] === "get" ? args.slice(1) : args;
}

function findSetting(name: string): ConfigSetting {
  const setting = SETTINGS.find((candidate) => candidate.name === name);
  if (setting === undefined) {
    throw new UserInputError(`Unknown setting: ${name}. Known settings: ${SETTINGS.map((candidate) => candidate.name).join(", ")}`);
  }
  return setting;
}

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (["on", "true", "yes", "1"].includes(normalized)) return true;
  if (["off", "false", "no", "0"].includes(normalized)) return false;
  throw new UserInputError(`Invalid boolean: ${value}. Use on or off.`);
}

function formatBoolean(value: boolean): string {
  return value ? "on" : "off";
}
