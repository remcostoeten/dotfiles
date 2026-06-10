// Thin typed layer over the generated Wails bindings. Components import from
// here, never from wailsjs directly.
import {
  Catalog as goCatalog,
  CheckPresence as goCheckPresence,
  RunInstall as goRunInstall,
  CancelInstall as goCancelInstall,
  SystemInfo as goSystemInfo,
} from "../../wailsjs/go/main/App";
import { EventsOn } from "../../wailsjs/runtime/runtime";
import type { main } from "../../wailsjs/go/models";

export type SystemInfo = main.SystemInfo;
export type CatalogCategory = main.CatalogCategory;
export type CatalogItem = main.CatalogItem;

export type InstallKind = "all" | "category" | "package";

// specRows shapes a SystemInfo into ordered [label, value] pairs, shared by the
// intro sequence and the persistent "This machine" panel so they never drift.
export function specRows(info: SystemInfo): Array<[string, string]> {
  return [
    ["OS", info.os],
    ["Distro", `${info.distro} · ${info.osFamily}`],
    ["Kernel", info.kernel],
    ["Arch", info.arch],
    ["Desktop", `${info.desktop}${info.sessionType ? ` · ${info.sessionType}` : ""}`],
    ["Packages", info.packageManager],
    ["Shell", info.shell],
    ["CPU", info.cpu],
    ["Memory", info.memory],
    ["Uptime", info.uptime],
    ["Host", `${info.user}@${info.hostname}`],
    ["Sudo", info.hasSudo ? "passwordless" : "password required"],
  ];
}

export function systemInfo(): Promise<SystemInfo> {
  return goSystemInfo();
}

export function catalog(): Promise<CatalogCategory[]> {
  return goCatalog();
}

export function checkPresence(names: string[]): Promise<Record<string, boolean>> {
  return goCheckPresence(names);
}

export function runInstall(kind: InstallKind, id: string, dryRun: boolean): Promise<string> {
  return goRunInstall(kind, id, dryRun);
}

export function cancelInstall(): Promise<void> {
  return goCancelInstall();
}

export type InstallStart = { kind: string; id: string; command: string };
export type InstallExit = { code: number; ok: boolean };

export function onInstallStart(cb: (e: InstallStart) => void): () => void {
  return EventsOn("install:start", (e: InstallStart) => cb(e));
}

export function onInstallLine(cb: (line: string) => void): () => void {
  return EventsOn("install:line", (line: string) => cb(line));
}

export function onInstallExit(cb: (e: InstallExit) => void): () => void {
  return EventsOn("install:exit", (e: InstallExit) => cb(e));
}
