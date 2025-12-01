/**
 * Pre-flight checks and setup
 * Runs before main setup to ensure prerequisites are met
 * - Initialize git submodules (env-private)
 * - Restore SSH keys from env-private repository
 */

import { executeCommand } from "./executor";
import type { CommandResult } from "./executor";
import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync, chmodSync } from "fs";
import { join } from "path";

const DOTFILES_DIR = `${process.env.HOME}/.config/dotfiles`;
const ENV_PRIVATE_DIR = join(DOTFILES_DIR, "env-private");

export interface PreflightResult {
  success: boolean;
  steps: {
    name: string;
    success: boolean;
    message: string;
  }[];
}

/**
 * Main preflight function
 */
export async function runPreflight(): Promise<PreflightResult> {
  const result: PreflightResult = {
    success: true,
    steps: [],
  };

  // 1. Initialize git submodules (especially env-private)
  const submodulesResult = await initGitSubmodules();
  result.steps.push(...submodulesResult.steps);
  if (!submodulesResult.success) result.success = false;

  // 2. Restore SSH keys from env-private
  const sshResult = await restoreSSHKeysFromEnvPrivate();
  result.steps.push(...sshResult.steps);
  // Don't fail preflight if SSH keys don't exist (first time setup)
  // if (!sshResult.success) result.success = false;

  return result;
}

/**
 * Initialize git submodules
 */
async function initGitSubmodules(): Promise<PreflightResult> {
  const result: PreflightResult = { success: true, steps: [] };

  const gitmodulesPath = `${DOTFILES_DIR}/.gitmodules`;

  if (!existsSync(gitmodulesPath)) {
    result.steps.push({
      name: "Git submodules",
      success: true,
      message: "No git submodules found (skipped)",
    });
    return result;
  }

  try {
    const submoduleResult = await executeCommand(
      `cd "${DOTFILES_DIR}" && git submodule update --init --recursive 2>&1`,
      false
    );

    if (submoduleResult.success) {
      result.steps.push({
        name: "Git submodules",
        success: true,
        message: "Git submodules initialized",
      });
    } else {
      // Check if it's just a permission/access issue with env-private
      if (submoduleResult.error?.includes("env-private") || submoduleResult.output?.includes("env-private")) {
        result.steps.push({
          name: "Git submodules",
          success: false,
          message: "Failed to initialize env-private submodule (may need manual setup or SSH keys)",
        });
        result.success = false;
      } else {
        result.steps.push({
          name: "Git submodules",
          success: false,
          message: "Failed to initialize git submodules",
        });
        result.success = false;
      }
    }
  } catch (err) {
    result.steps.push({
      name: "Git submodules",
      success: false,
      message: `Failed to initialize git submodules: ${err}`,
    });
    result.success = false;
  }

  return result;
}

/**
 * Restore SSH keys from env-private repository
 */
async function restoreSSHKeysFromEnvPrivate(): Promise<PreflightResult> {
  const result: PreflightResult = { success: true, steps: [] };

  const SSH_STORAGE_DIR = join(ENV_PRIVATE_DIR, ".ssh");
  const SSH_HOME_DIR = `${process.env.HOME}/.ssh`;

  // Check if env-private directory exists
  if (!existsSync(ENV_PRIVATE_DIR)) {
    result.steps.push({
      name: "SSH keys restore",
      success: true,
      message: "env-private directory not found (skipped - first time setup)",
    });
    return result;
  }

  // Check if SSH storage directory exists
  if (!existsSync(SSH_STORAGE_DIR)) {
    result.steps.push({
      name: "SSH keys restore",
      success: true,
      message: "No SSH keys found in env-private (skipped - first time setup)",
    });
    return result;
  }

  try {
    // Create ~/.ssh directory if it doesn't exist
    if (!existsSync(SSH_HOME_DIR)) {
      mkdirSync(SSH_HOME_DIR, { recursive: true, mode: 0o700 });
    }

    const sshFiles = readdirSync(SSH_STORAGE_DIR);
    const keysRestored: string[] = [];

    // Copy each file from storage to ~/.ssh
    for (const file of sshFiles) {
      const sourcePath = join(SSH_STORAGE_DIR, file);
      const targetPath = join(SSH_HOME_DIR, file);

      // Skip if file already exists (don't overwrite existing keys)
      if (existsSync(targetPath)) {
        continue;
      }

      const stat = statSync(sourcePath);
      if (!stat.isFile()) {
        continue;
      }

      copyFileSync(sourcePath, targetPath);

      // Set secure permissions
      chmodSync(
        targetPath,
        file.includes("_rsa") || file.includes("_ed25519") || file.includes("_ecdsa") || file.includes("_dsa")
          ? 0o600
          : 0o644
      );

      keysRestored.push(file);
    }

    // Ensure .ssh directory has correct permissions
    chmodSync(SSH_HOME_DIR, 0o700);

    if (keysRestored.length === 0) {
      result.steps.push({
        name: "SSH keys restore",
        success: true,
        message: "No new SSH keys to restore (all keys already exist)",
      });
    } else {
      result.steps.push({
        name: "SSH keys restore",
        success: true,
        message: `Restored ${keysRestored.length} SSH key file(s): ${keysRestored.join(", ")}`,
      });
    }
  } catch (err: any) {
    result.steps.push({
      name: "SSH keys restore",
      success: false,
      message: `Failed to restore SSH keys: ${err.message || err}`,
    });
    // Don't fail preflight on SSH restore errors
    // result.success = false;
  }

  return result;
}

