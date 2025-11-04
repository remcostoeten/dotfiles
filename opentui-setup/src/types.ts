/**
 * Type definitions for the OpenTUI setup system
 */

export type AppMode = "menu" | "select" | "confirm" | "running" | "complete";

export interface Package {
  id: string;
  name: string;
  displayName: string;
  method: "apt" | "snap" | "github" | "curl" | "npm";
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