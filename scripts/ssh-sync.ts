#!/usr/bin/env bun
// DOCSTRING: Sync SSH keys to/from env-private repository

import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync, chmodSync } from "fs";
import { join } from "path";

const DOTFILES_DIR = process.env.HOME + "/.config/dotfiles";
const ENV_PRIVATE_DIR = join(DOTFILES_DIR, "env-private");
const SSH_STORAGE_DIR = join(ENV_PRIVATE_DIR, ".ssh");
const SSH_HOME_DIR = process.env.HOME + "/.ssh";

interface SyncResult {
  success: boolean;
  message: string;
  keysBackedUp?: string[];
  keysRestored?: string[];
}

/**
 * Backup SSH keys from ~/.ssh to env-private/.ssh
 */
export async function backupSSHKeys(): Promise<SyncResult> {
  try {
    // Ensure env-private directory exists
    if (!existsSync(ENV_PRIVATE_DIR)) {
      return {
        success: false,
        message: `env-private directory not found at ${ENV_PRIVATE_DIR}. Please initialize git submodules first.`,
      };
    }

    // Create .ssh directory in env-private if it doesn't exist
    if (!existsSync(SSH_STORAGE_DIR)) {
      mkdirSync(SSH_STORAGE_DIR, { recursive: true, mode: 0o700 });
    }

    // Check if ~/.ssh exists
    if (!existsSync(SSH_HOME_DIR)) {
      return {
        success: false,
        message: `SSH directory not found at ${SSH_HOME_DIR}`,
      };
    }

    const keysBackedUp: string[] = [];
    const sshFiles = readdirSync(SSH_HOME_DIR);

    // Filter for SSH key files (private keys, public keys, config, known_hosts)
    const sshKeyFiles = sshFiles.filter((file) => {
      const filePath = join(SSH_HOME_DIR, file);
      const stat = statSync(filePath);
      return (
        stat.isFile() &&
        (file.endsWith("_rsa") ||
          file.endsWith("_ed25519") ||
          file.endsWith("_ecdsa") ||
          file.endsWith("_dsa") ||
          file.endsWith(".pub") ||
          file === "config" ||
          file === "known_hosts" ||
          file === "authorized_keys")
      );
    });

    if (sshKeyFiles.length === 0) {
      return {
        success: true,
        message: "No SSH keys found to backup",
        keysBackedUp: [],
      };
    }

    // Copy each key file
    for (const file of sshKeyFiles) {
      const sourcePath = join(SSH_HOME_DIR, file);
      const targetPath = join(SSH_STORAGE_DIR, file);

      copyFileSync(sourcePath, targetPath);

      // Set secure permissions
      chmodSync(targetPath, file.includes("_rsa") || file.includes("_ed25519") || file.includes("_ecdsa") || file.includes("_dsa") ? 0o600 : 0o644);

      keysBackedUp.push(file);
    }

    return {
      success: true,
      message: `Backed up ${keysBackedUp.length} SSH key file(s) to env-private`,
      keysBackedUp,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to backup SSH keys: ${error.message}`,
    };
  }
}

/**
 * Restore SSH keys from env-private/.ssh to ~/.ssh
 */
export async function restoreSSHKeys(): Promise<SyncResult> {
  try {
    // Check if env-private/.ssh exists
    if (!existsSync(SSH_STORAGE_DIR)) {
      return {
        success: false,
        message: `SSH storage directory not found at ${SSH_STORAGE_DIR}. No SSH keys to restore.`,
      };
    }

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
      chmodSync(targetPath, file.includes("_rsa") || file.includes("_ed25519") || file.includes("_ecdsa") || file.includes("_dsa") ? 0o600 : 0o644);

      keysRestored.push(file);
    }

    // Ensure .ssh directory has correct permissions
    chmodSync(SSH_HOME_DIR, 0o700);

    if (keysRestored.length === 0) {
      return {
        success: true,
        message: "No new SSH keys to restore (all keys already exist)",
        keysRestored: [],
      };
    }

    return {
      success: true,
      message: `Restored ${keysRestored.length} SSH key file(s) from env-private`,
      keysRestored,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to restore SSH keys: ${error.message}`,
    };
  }
}

/**
 * Main CLI entry point
 */
async function main() {
  const command = process.argv[2] || "restore";

  if (command === "backup") {
    const result = await backupSSHKeys();
    if (result.success) {
      console.log(`✓ ${result.message}`);
      if (result.keysBackedUp && result.keysBackedUp.length > 0) {
        console.log(`  Files: ${result.keysBackedUp.join(", ")}`);
      }
      process.exit(0);
    } else {
      console.error(`✗ ${result.message}`);
      process.exit(1);
    }
  } else if (command === "restore") {
    const result = await restoreSSHKeys();
    if (result.success) {
      console.log(`✓ ${result.message}`);
      if (result.keysRestored && result.keysRestored.length > 0) {
        console.log(`  Files: ${result.keysRestored.join(", ")}`);
      }
      process.exit(0);
    } else {
      // Don't fail if no keys to restore (first time setup)
      if (result.message.includes("not found")) {
        console.log(`ℹ ${result.message}`);
        process.exit(0);
      } else {
        console.error(`✗ ${result.message}`);
        process.exit(1);
      }
    }
  } else {
    console.log("Usage: ssh-sync [backup|restore]");
    console.log("  backup  - Copy SSH keys from ~/.ssh to env-private/.ssh");
    console.log("  restore - Copy SSH keys from env-private/.ssh to ~/.ssh (default)");
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}

