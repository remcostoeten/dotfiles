/**
 * Type definitions for the OpenTUI setup system
 */

export type AppMode = "menu" | "select" | "confirm" | "running" | "complete";

export interface Package {
  id: string;
  name: string;
  displayName: string;
  method: "apt" | "snap" | "github" | "curl" | "npm" | "cargo";
  extra?: string;
  flags?: string;
  status: "pending" | "running" | "completed" | "failed";
}

export interface Category {
  id: string;
  name: string;
  description: string;
  selected: boolean;
  packages: Package[];
}

export interface AppConfig {
  dryRun: boolean;
  verbose: boolean;
  skipFonts: boolean;
  skipSystemUpdate: boolean;
}

export interface ProgressData {
  current: number;
  total: number;
  currentPackage: string;
  packages: Record<string, PackageStatus>;
  snaps: Record<string, PackageStatus>;
  tools: Record<string, PackageStatus>;
}

export type PackageStatus = "pending" | "running" | "completed" | "failed";