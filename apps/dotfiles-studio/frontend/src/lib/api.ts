// Thin typed layer over the generated Wails bindings. Components import from
// here, never from wailsjs directly.
import {
  Catalog as goCatalog,
  CheckPresence as goCheckPresence,
  RunInstall as goRunInstall,
  CancelInstall as goCancelInstall,
  RunUninstall as goRunUninstall,
  VerifyInstall as goVerifyInstall,
  SystemInfo as goSystemInfo,
  PackagesLoad as goPackagesLoad,
  PackagesSave as goPackagesSave,
  PackagesImport as goPackagesImport,
  PackagesPickFile as goPackagesPickFile,
  PackagesInstall as goPackagesInstall,
  PackagesRun as goPackagesRun,
  PackagesUninstall as goPackagesUninstall,
  PackagesVerify as goPackagesVerify,
  PackagesCheckSource as goPackagesCheckSource,
  PackagesInstallAURHelper as goPackagesInstallAURHelper,
} from "../../wailsjs/go/main/App";
import { EventsOn } from "../../wailsjs/runtime/runtime";
import { main } from "../../wailsjs/go/models";

export type SystemInfo = main.SystemInfo;
export type CatalogCategory = main.CatalogCategory;
export type CatalogItem = main.CatalogItem;
export type VerifyResult = main.VerifyResult;

export type InstallKind = "all" | "category" | "package";

export type PackageMethod =
  | "pacman"
  | "aur"
  | "apt"
  | "dnf"
  | "flatpak"
  | "snap"
  | "npm"
  | "cargo"
  | "pipx"
  | "curl"
  | "github"
  | "shell";

export const PACKAGE_METHODS: PackageMethod[] = [
  "pacman",
  "aur",
  "apt",
  "dnf",
  "flatpak",
  "snap",
  "npm",
  "cargo",
  "pipx",
  "curl",
  "github",
  "shell",
];

export type PackageSource = {
  method: PackageMethod;
  package?: string;
  shell?: string;
  args?: string;
  script?: string;
  uninstall?: string;
};

export type PackageEntry = {
  id: string;
  name: string;
  category: string;
  description?: string;
  disabled?: boolean;
  checks?: string[];
  sources: PackageSource[];
};

export type PackageCategory = { id: string; name: string; description?: string };

export type PackageManifest = {
  version: number;
  aurHelper: string;
  categories: PackageCategory[];
  packages: PackageEntry[];
};

export type PackagesEnv = {
  packageManager: string;
  osFamily: string;
  hasSudo: boolean;
  aurHelpers: string[];
  aurHelper: string;
  methods: Record<string, boolean>;
};

export type ResolvedPackage = {
  id: string;
  sourceIndex: number;
  method: string;
  command: string;
  uninstallCommand: string;
  reason: string;
  installed: boolean;
};

export type PackagesState = {
  path: string;
  exists: boolean;
  setupScript: string;
  manifest: PackageManifest;
  env: PackagesEnv;
  resolved: Record<string, ResolvedPackage>;
  error: string;
};

export type ImportResult = {
  manifest: PackageManifest;
  source: string;
  added: string[];
  skipped: string[];
  categories: string[];
  notes: string[];
  error: string;
};

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
    ["Machine", info.machine],
    ["CPU", info.cpu],
    ["GPU", info.gpu],
    ["Memory", info.memory],
    ["Storage", info.storage],
    ["Disks", info.disks],
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

export function runUninstall(id: string, dryRun: boolean): Promise<string> {
  return goRunUninstall(id, dryRun);
}

export function verifyInstall(id: string): Promise<VerifyResult> {
  return goVerifyInstall(id);
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

// The Wails models are classes with converters; the Packages tab works on plain
// shapes and only crosses into the generated classes at the call boundary.
export function packagesLoad(): Promise<PackagesState> {
  return goPackagesLoad() as unknown as Promise<PackagesState>;
}

export function packagesSave(manifest: PackageManifest): Promise<PackagesState> {
  return goPackagesSave(main.PackageManifest.createFrom(manifest)) as unknown as Promise<PackagesState>;
}

export function packagesImport(path: string): Promise<ImportResult> {
  return goPackagesImport(path) as unknown as Promise<ImportResult>;
}

export function packagesPickFile(): Promise<string> {
  return goPackagesPickFile();
}

export function packagesInstall(id: string, dryRun: boolean): Promise<string> {
  return goPackagesInstall(id, dryRun);
}

export function packagesRun(category: string, dryRun: boolean): Promise<string> {
  return goPackagesRun(category, dryRun);
}

export function packagesUninstall(id: string, dryRun: boolean): Promise<string> {
  return goPackagesUninstall(id, dryRun);
}

export function packagesVerify(id: string): Promise<VerifyResult> {
  return goPackagesVerify(id);
}

export function packagesCheckSource(id: string): Promise<VerifyResult> {
  return goPackagesCheckSource(id);
}

export function packagesInstallAURHelper(name: string, dryRun: boolean): Promise<string> {
  return goPackagesInstallAURHelper(name, dryRun);
}
