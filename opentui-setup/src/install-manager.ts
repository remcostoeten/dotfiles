/**
 * Advanced Installation Manager
 * - Automatic retry with exponential backoff
 * - Dependency checking
 * - Rollback on failure
 */

import { installPackage, commandExists, isPackageInstalled } from "./executor";
import { updatePackageProgress } from "./progress";
import type { Package } from "./types";
import { logErrorSilently } from "./noop";

export interface InstallOptions {
  maxRetries?: number;
  retryDelay?: number;
  verbose?: boolean;
  enableRollback?: boolean;
}

export interface InstallResult {
  success: boolean;
  package: Package;
  attempts: number;
  error?: string;
  rolledBack?: boolean;
}

interface DependencyCheck {
  name: string;
  check: () => Promise<boolean>;
  installCommand?: string;
  required: boolean;
}

/**
 * Package dependencies map
 */
const PACKAGE_DEPENDENCIES: Record<string, DependencyCheck[]> = {
  // Snap packages need snapd
  "code": [
    { name: "snapd", check: async () => commandExists("snap"), installCommand: "sudo apt-get install -y snapd", required: true }
  ],
  "discord": [
    { name: "snapd", check: async () => commandExists("snap"), installCommand: "sudo apt-get install -y snapd", required: true }
  ],
  "android-studio": [
    { name: "snapd", check: async () => commandExists("snap"), installCommand: "sudo apt-get install -y snapd", required: true }
  ],
  
  // NPM packages need npm or pnpm
  "gemini-cli": [
    { 
      name: "npm or pnpm", 
      check: async () => (await commandExists("npm")) || (await commandExists("pnpm")),
      installCommand: "sudo apt-get install -y npm",
      required: true 
    }
  ],
  
  // Cargo packages need cargo
  "ripgrep": [
    { name: "cargo", check: async () => commandExists("cargo"), required: false }
  ],
  
  // GitHub releases need wget and tar
  "lazygit": [
    { name: "wget", check: async () => commandExists("wget"), installCommand: "sudo apt-get install -y wget", required: true },
    { name: "tar", check: async () => commandExists("tar"), installCommand: "sudo apt-get install -y tar", required: true }
  ],
  "lazydocker": [
    { name: "wget", check: async () => commandExists("wget"), installCommand: "sudo apt-get install -y wget", required: true },
    { name: "tar", check: async () => commandExists("tar"), installCommand: "sudo apt-get install -y tar", required: true }
  ],
  "wezterm": [
    { name: "wget", check: async () => commandExists("wget"), installCommand: "sudo apt-get install -y wget", required: true }
  ],
  
  // Docker needs specific setup
  "docker.io": [
    { name: "systemd", check: async () => commandExists("systemctl"), required: true }
  ],
};

/**
 * Check and install dependencies for a package
 */
async function checkDependencies(
  pkg: Package,
  verbose: boolean = false
): Promise<{ success: boolean; missing: string[]; installed: string[] }> {
  const dependencies = PACKAGE_DEPENDENCIES[pkg.id] || [];
  const missing: string[] = [];
  const installed: string[] = [];

  for (const dep of dependencies) {
    const exists = await dep.check();
    
    if (!exists) {
      if (dep.required) {
        if (verbose) {
          console.log(`Missing required dependency: ${dep.name}`);
        }
        
        // Try to install the dependency
        if (dep.installCommand) {
          if (verbose) {
            console.log(`Installing dependency: ${dep.name}`);
          }
          
          const { executeCommand } = await import("./executor");
          const result = await executeCommand(dep.installCommand);
          
          if (result.success) {
            installed.push(dep.name);
          } else {
            missing.push(dep.name);
          }
        } else {
          missing.push(dep.name);
        }
      }
    }
  }

  return {
    success: missing.length === 0,
    missing,
    installed,
  };
}

/**
 * Install package with retry logic
 */
async function installWithRetry(
  pkg: Package,
  options: InstallOptions
): Promise<InstallResult> {
  const maxRetries = options.maxRetries || 3;
  const retryDelay = options.retryDelay || 2000;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (options.verbose) {
        console.log(`Attempt ${attempt}/${maxRetries} for ${pkg.displayName}`);
      }

      const result = await installPackage(pkg, options.verbose);

      if (result.success) {
        return {
          success: true,
          package: pkg,
          attempts: attempt,
        };
      }

      lastError = result.error;

      // Don't retry if it's a dependency issue
      if (result.error?.includes("not installed") || result.error?.includes("not found")) {
        break;
      
}

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(2, attempt - 1);
        if (options.verbose) {
          console.log(`Waiting ${delay}ms before retry...`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    success: false,
    package: pkg,
    attempts: maxRetries,
    error: lastError || "Installation failed after retries",
  };
}

/**
 * Rollback a package installation
 */
async function rollbackPackage(pkg: Package, verbose: boolean = false): Promise<boolean> {
  try {
    if (verbose) {
      console.log(`Rolling back ${pkg.displayName}...`);
    }

    const { executeCommand } = await import("./executor");
    let rollbackCmd = "";

    switch (pkg.method) {
      case "apt":
        rollbackCmd = `sudo apt-get remove -y ${pkg.name}`;
        break;
      case "snap":
        rollbackCmd = `sudo snap remove ${pkg.name}`;
        break;
      case "npm":
        rollbackCmd = `npm uninstall -g ${pkg.name}`;
        break;
      case "cargo":
        rollbackCmd = `cargo uninstall ${pkg.name}`;
        break;
      case "github":
        rollbackCmd = `sudo rm -f /usr/local/bin/${pkg.name}`;
        break;
      default:
        return false;
    }

    const result = await executeCommand(rollbackCmd);
    return result.success;
  } catch (err) {
    logErrorSilently(err, "Package rollback");
    return false;
  }
}

/**
 * Install package with full error handling, retry, and rollback
 */
export async function installPackageAdvanced(
  pkg: Package,
  options: InstallOptions = {}
): Promise<InstallResult> {
  const verbose = options.verbose || false;
  const enableRollback = options.enableRollback !== false; // Default true

  // 1. Check if already installed
  const exists = await commandExists(pkg.name);
  const dpkgInstalled = await isPackageInstalled(pkg.name);

  if (exists || dpkgInstalled) {
    return {
      success: true,
      package: pkg,
      attempts: 0,
    };
  }

  // 2. Check dependencies
  if (verbose) {
    console.log(`Checking dependencies for ${pkg.displayName}...`);
  }

  const depCheck = await checkDependencies(pkg, verbose);
  
  if (!depCheck.success) {
    return {
      success: false,
      package: pkg,
      attempts: 0,
      error: `Missing required dependencies: ${depCheck.missing.join(", ")}`,
    };
  }

  if (depCheck.installed.length > 0 && verbose) {
    console.log(`Installed dependencies: ${depCheck.installed.join(", ")}`);
  }

  // 3. Install with retry
  const result = await installWithRetry(pkg, options);

  // 4. Rollback on failure if enabled
  if (!result.success && enableRollback) {
    if (verbose) {
      console.log(`Installation failed, attempting rollback...`);
    }

    const rolledBack = await rollbackPackage(pkg, verbose);
    result.rolledBack = rolledBack;

    if (rolledBack && verbose) {
      console.log(`Successfully rolled back ${pkg.displayName}`);
    }
  }

  // 5. Update progress
  await updatePackageProgress(
    "packages",
    pkg.id,
    result.success ? "completed" : "failed"
  );

  return result;
}

/**
 * Install multiple packages with dependency resolution
 */
export async function installPackagesAdvanced(
  packages: Package[],
  options: InstallOptions = {},
  onProgress?: (current: number, total: number, pkg: Package, result: InstallResult) => void
): Promise<{
  successful: InstallResult[];
  failed: InstallResult[];
  rolledBack: InstallResult[];
}> {
  const successful: InstallResult[] = [];
  const failed: InstallResult[] = [];
  const rolledBack: InstallResult[] = [];

  for (let i = 0; i < packages.length; i++) {
    const pkg = packages[i];
    const result = await installPackageAdvanced(pkg, options);

    if (result.success) {
      successful.push(result);
    } else {
      failed.push(result);
      if (result.rolledBack) {
        rolledBack.push(result);
      }
    }

    if (onProgress) {
      onProgress(i + 1, packages.length, pkg, result);
    }
  }

  return { successful, failed, rolledBack };
}

/**
 * Verify installation was successful
 */
export async function verifyInstallation(pkg: Package): Promise<boolean> {
  // Check if command exists
  const cmdExists = await commandExists(pkg.name);
  if (cmdExists) return true;

  // Check if package is installed via dpkg
  const dpkgInstalled = await isPackageInstalled(pkg.name);
  if (dpkgInstalled) return true;

  // For snap packages, check snap list
  if (pkg.method === "snap") {
    const { executeCommand } = await import("./executor");
    const result = await executeCommand(`snap list ${pkg.name}`);
    return result.success;
  }

  return false;
}
