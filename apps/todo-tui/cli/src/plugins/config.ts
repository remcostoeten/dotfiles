import type { CommandSpec, ValueKind } from "../command-spec/types";
import { PANEL_BOARDS, normalizePanelBoards, parsePanelBoards } from "../domain/panel-boards";
import { PANEL_LAYOUTS, normalizePanelLayout, parsePanelLayout } from "../domain/panel-layout";
import { formatPanelLimit, normalizePanelLimit, parsePanelLimit } from "../domain/panel-limit";
import type { TodoConfig } from "../domain/task";

const DIM = "\u001B[2m";
const RESET = "\u001B[0m";

interface ConfigSetting {
  name: string;
  description: string;
  value: ValueKind;
  read(config: TodoConfig): string;
  apply(config: TodoConfig, value: string): TodoConfig;
}

const SWITCH: ValueKind = { oneOf: ["on", "off"] };

const SETTINGS: ConfigSetting[] = [
  {
    name: "panel-limit",
    description: "Pending tasks shown per lane in the shell panel (number, or 'all')",
    value: "count-or-all",
    read: (config) => formatPanelLimit(normalizePanelLimit(config.panelLimit)),
    apply: (config, value) => ({ ...config, panelLimit: parsePanelLimit(value) }),
  },
  {
    name: "panel-layout",
    description: "Board lanes in the shell panel: auto (columns when wide), side (always columns) or stack",
    value: { oneOf: PANEL_LAYOUTS },
    read: (config) => normalizePanelLayout(config.panelLayout),
    apply: (config, value) => ({ ...config, panelLayout: parsePanelLayout(value) }),
  },
  {
    name: "panel-boards",
    description: "Boards in the shell panel: active (its Now and Later lanes) or all (one column per board)",
    value: { oneOf: PANEL_BOARDS },
    read: (config) => normalizePanelBoards(config.panelBoards),
    apply: (config, value) => ({ ...config, panelBoards: parsePanelBoards(value) }),
  },
  {
    name: "startup-notifications",
    description: "Send desktop notifications for due tasks on startup (on/off)",
    value: SWITCH,
    read: (config) => formatBoolean(config.showNotificationsOnStartup),
    apply: (config, value) => ({ ...config, showNotificationsOnStartup: value === "on" }),
  },
  {
    name: "show-completed",
    description: "Include completed tasks in listings by default (on/off)",
    value: SWITCH,
    read: (config) => formatBoolean(config.showCompletedTasksByDefault),
    apply: (config, value) => ({ ...config, showCompletedTasksByDefault: value === "on" }),
  },
  {
    name: "autocorrect",
    description: "Suggest and learn corrections for mistyped commands, options and values (on/off)",
    value: SWITCH,
    read: (config) => formatBoolean(config.autocorrect),
    apply: (config, value) => ({ ...config, autocorrect: value === "on" }),
  },
];

function settingCommand(setting: ConfigSetting): CommandSpec {
  return {
    name: setting.name,
    summary: setting.description,
    args: [{ name: "value", kind: setting.value, optional: true, description: "New value; omit to print the current one" }],
    async run(input, { store, stdout }) {
      const config = await store.loadConfig();
      const value = input.optionalArg("value");
      if (value === undefined) {
        stdout.write(`${setting.read(config)}\n`);
        return;
      }
      const updated = setting.apply(config, value);
      await store.saveConfig(updated);
      stdout.write(`${setting.name} = ${setting.read(updated)}\n`);
    },
  };
}

export const configCommand: CommandSpec = {
  name: "config",
  summary: "Read or change persisted settings.",
  group: "Settings",
  subcommandNoun: "setting",
  subcommands: SETTINGS.map(settingCommand),
  details: ["Settings live in ~/.dotfiles/todo/config.json. TODO_PANEL_LIMIT, TODO_PANEL_LAYOUT and TODO_PANEL_BOARDS override the panel settings."],
  examples: [
    { command: "todo config", note: "every setting with its value" },
    { command: "todo config panel-limit 15" },
    { command: "todo config panel-limit all" },
    { command: "todo config panel-layout side", note: "lanes in columns even on a narrow terminal" },
    { command: "todo config panel-boards all", note: "every board side by side at shell startup" },
    { command: "todo config startup-notifications off" },
  ],
  async run(_input, { store, stdout }) {
    const config = await store.loadConfig();
    for (const setting of SETTINGS) {
      stdout.write(`${setting.name.padEnd(22)} ${setting.read(config)}${DIM}  ${setting.description}${RESET}\n`);
    }
  },
};

function formatBoolean(value: boolean): string {
  return value ? "on" : "off";
}
