// Thin typed layer over the generated Wails bindings. Components import from
// here, never from wailsjs directly.
import {
  Catalog as goCatalog,
  CheckPresence as goCheckPresence,
  RunInstall as goRunInstall,
  CancelInstall as goCancelInstall,
  SystemInfo as goSystemInfo,
  KeydStatus as goKeydStatus,
  KeydListProfiles as goKeydListProfiles,
  KeydListKeys as goKeydListKeys,
  KeydValidate as goKeydValidate,
  KeydSaveProfile as goKeydSaveProfile,
  KeydDeleteProfile as goKeydDeleteProfile,
  KeydApplyProfile as goKeydApplyProfile,
  KeydStartCapture as goKeydStartCapture,
  KeydStopCapture as goKeydStopCapture,
} from "../../wailsjs/go/main/App";
import { EventsOn } from "../../wailsjs/runtime/runtime";
import { main } from "../../wailsjs/go/models";

export type SystemInfo = main.SystemInfo;
export type CatalogCategory = main.CatalogCategory;
export type CatalogItem = main.CatalogItem;

export type KeydStatus = main.KeydStatus;
export type KeydProfile = main.KeydProfile;
export type KeydBinding = main.KeydBinding;
export type KeydResult = main.KeydResult;
export type KeydCapturedKey = {
  device: string;
  key: string;
  raw: string;
  remapped: boolean;
};

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

// Wails models are classes, not plain shapes, so a profile the GUI invents
// before its first save still has to be built through the generated constructor.
export function newKeydProfile(name: string): KeydProfile {
  return new main.KeydProfile({ name, path: "", bindings: [], active: false });
}

export function newKeydBinding(): KeydBinding {
  return new main.KeydBinding({ layer: "main", key: "", action: "" });
}

export function keydStatus(): Promise<KeydStatus> {
  return goKeydStatus();
}

export function keydListProfiles(): Promise<KeydProfile[]> {
  return goKeydListProfiles();
}

export function keydListKeys(): Promise<string[]> {
  return goKeydListKeys();
}

export function keydValidate(bindings: KeydBinding[]): Promise<KeydResult> {
  return goKeydValidate(bindings);
}

export function keydSaveProfile(name: string, bindings: KeydBinding[]): Promise<KeydResult> {
  return goKeydSaveProfile(name, bindings);
}

export function keydDeleteProfile(name: string): Promise<KeydResult> {
  return goKeydDeleteProfile(name);
}

export function keydApplyProfile(name: string): Promise<KeydResult> {
  return goKeydApplyProfile(name);
}

export function keydStartCapture(): Promise<KeydResult> {
  return goKeydStartCapture();
}

export function keydStopCapture(): Promise<void> {
  return goKeydStopCapture();
}

export function onKeydKey(cb: (e: KeydCapturedKey) => void): () => void {
  return EventsOn("keyd:key", (e: KeydCapturedKey) => cb(e));
}
