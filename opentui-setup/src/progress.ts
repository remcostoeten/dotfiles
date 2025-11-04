/**
 * Progress tracking system
 * Saves installation progress to JSON file
 */

import type { ProgressData, PackageStatus } from "./types";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname } from "path";

const DOTFILES_DATA_DIR = `${process.env.HOME}/.dotfiles`;
const PROGRESS_FILE = `${DOTFILES_DATA_DIR}/setup/progress.json`;

/**
 * Initialize data directory
 */
export async function initDataDirectory(): Promise<void> {
  try {
    const dirs = [
      DOTFILES_DATA_DIR,
      `${DOTFILES_DATA_DIR}/setup`,
      `${DOTFILES_DATA_DIR}/logs`,
      `${DOTFILES_DATA_DIR}/backups`,
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    }
  } catch (err) {
    console.error("Failed to initialize data directory:", err);
  }
}

/**
 * Load progress data from file
 */
export async function loadProgress(): Promise<ProgressData> {
  try {
    if (!existsSync(PROGRESS_FILE)) {
      return {
        packages: {},
        snaps: {},
        tools: {},
      };
    }

    const content = await readFile(PROGRESS_FILE, "utf-8");
    return JSON.parse(content) as ProgressData;
  } catch (err) {
    console.error("Failed to load progress:", err);
    return {
      packages: {},
      snaps: {},
      tools: {},
    };
  }
}

/**
 * Save progress data to file
 */
export async function saveProgress(data: ProgressData): Promise<void> {
  try {
    await initDataDirectory();
    await writeFile(PROGRESS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save progress:", err);
  }
}

/**
 * Update progress for a specific package
 */
export async function updatePackageProgress(
  category: keyof ProgressData,
  packageId: string,
  status: PackageStatus
): Promise<void> {
  const progress = await loadProgress();
  progress[category][packageId] = status;
  await saveProgress(progress);
}

/**
 * Check if a package was completed
 */
export async function isCompleted(
  category: keyof ProgressData,
  packageId: string
): Promise<boolean> {
  const progress = await loadProgress();
  return progress[category][packageId] === "completed";
}

/**
 * Get progress statistics
 */
export async function getProgressStats(): Promise<{
  total: number;
  completed: number;
  failed: number;
  pending: number;
}> {
  const progress = await loadProgress();
  
  const allStatuses = [
    ...Object.values(progress.packages),
    ...Object.values(progress.snaps),
    ...Object.values(progress.tools),
  ];

  return {
    total: allStatuses.length,
    completed: allStatuses.filter((s) => s === "completed").length,
    failed: allStatuses.filter((s) => s === "failed").length,
    pending: allStatuses.filter((s) => s === "pending").length,
  };
}

/**
 * Clear all progress
 */
export async function clearProgress(): Promise<void> {
  const emptyProgress: ProgressData = {
    packages: {},
    snaps: {},
    tools: {},
  };
  await saveProgress(emptyProgress);
}
