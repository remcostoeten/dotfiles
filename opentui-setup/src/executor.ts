/**
 * Command execution utilities
 * - Execute shell commands with error handling
 * - Package management functions
 * - System update functions
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Execute a shell command
 */
export async function executeCommand(
  command: string,
  verbose: boolean = false
): Promise<CommandResult> {
  try {
    if (verbose) {
      console.log(`🔧 Executing: ${command}`);
    }

    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000, // 30 second timeout
    });

    const output = stdout.trim();
    const error = stderr.trim();

    if (verbose && output) {
      console.log(`📤 Output: ${output}`);
    }

    if (verbose && error) {
      console.log(`⚠️  Error: ${error}`);
    }

    return {
      success: true,
      output,
      error: error || undefined,
    };
  } catch (err: any) {
    const errorMessage = err.message || String(err);
    if (verbose) {
      console.log(`❌ Failed: ${errorMessage}`);
    }
    return {
      success: false,
      output: "",
      error: errorMessage,
    };
  }
}

/**
 * Update apt package lists
 */
export async function updateApt(verbose: boolean = false): Promise<CommandResult> {
  return executeCommand("sudo apt update", verbose);
}

/**
 * Upgrade all packages
 */
export async function upgradeApt(verbose: boolean = false): Promise<CommandResult> {
  return executeCommand("sudo apt upgrade -y", verbose);
}

/**
 * Install a package via apt
 */
export async function installPackage(
  packageName: string,
  verbose: boolean = false
): Promise<CommandResult> {
  return executeCommand(`sudo apt install -y ${packageName}`, verbose);
}

/**
 * Remove a package via apt
 */
export async function removePackage(
  packageName: string,
  verbose: boolean = false
): Promise<CommandResult> {
  return executeCommand(`sudo apt remove -y ${packageName}`, verbose);
}

/**
 * Install a snap package
 */
export async function installSnap(
  packageName: string,
  flags: string = "",
  verbose: boolean = false
): Promise<CommandResult> {
  return executeCommand(`sudo snap install ${flags} ${packageName}`, verbose);
}

/**
 * Remove a snap package
 */
export async function removeSnap(
  packageName: string,
  verbose: boolean = false
): Promise<CommandResult> {
  return executeCommand(`sudo snap remove ${packageName}`, verbose);
}

/**
 * Install an npm package globally
 */
export async function installNpmGlobal(
  packageName: string,
  verbose: boolean = false
): Promise<CommandResult> {
  return executeCommand(`npm install -g ${packageName}`, verbose);
}

/**
 * Remove an npm package globally
 */
export async function removeNpmGlobal(
  packageName: string,
  verbose: boolean = false
): Promise<CommandResult> {
  return executeCommand(`npm uninstall -g ${packageName}`, verbose);
}

/**
 * Clone a GitHub repository
 */
export async function cloneRepo(
  repo: string,
  targetDir: string = "",
  verbose: boolean = false
): Promise<CommandResult> {
  const command = targetDir ? `gh repo clone ${repo} ${targetDir}` : `gh repo clone ${repo}`;
  return executeCommand(command, verbose);
}

/**
 * Download and execute a script
 */
export async function executeScript(
  url: string,
  verbose: boolean = false,
  extra: string = ""
): Promise<CommandResult> {
  // Special handling for golang installation
  if (url.includes("git.io/g-install")) {
    return executeCommand(`curl -sSL ${url} | sh -s${extra}`, verbose);
  }
  return executeCommand(`curl -fsSL ${url} | bash`, verbose);
}

/**
 * Check if a command exists
 */
export async function commandExists(
  command: string,
  verbose: boolean = false
): Promise<CommandResult> {
  return executeCommand(`command -v ${command}`, verbose);
}

/**
 * Check if a command exists and return boolean
 */
export async function isCommandAvailable(
  command: string,
  verbose: boolean = false
): Promise<boolean> {
  const result = await commandExists(command, verbose);
  return result.success;
}

/**
 * Check if a package is installed via apt
 */
export async function isAptPackageInstalled(
  packageName: string,
  verbose: boolean = false
): Promise<CommandResult> {
  return executeCommand(`dpkg -l | grep -q "^ii  ${packageName} "`, verbose);
}

/**
 * Check if a package is installed and return boolean
 */
export async function isPackageInstalled(
  packageName: string,
  verbose: boolean = false
): Promise<boolean> {
  const result = await isAptPackageInstalled(packageName, verbose);
  return result.success;
}

/**
 * Check if a snap package is installed
 */
export async function isSnapPackageInstalled(
  packageName: string,
  verbose: boolean = false
): Promise<CommandResult> {
  return executeCommand(`snap list | grep -q "^${packageName} "`, verbose);
}

/**
 * Check if an npm package is installed globally
 */
export async function isNpmPackageInstalled(
  packageName: string,
  verbose: boolean = false
): Promise<CommandResult> {
  return executeCommand(`npm list -g ${packageName} 2>/dev/null | grep -q "${packageName}"`, verbose);
}

/**
 * Create a symbolic link
 */
export async function createSymlink(
  source: string,
  target: string,
  verbose: boolean = false
): Promise<CommandResult> {
  return executeCommand(`ln -sf "${source}" "${target}"`, verbose);
}

/**
 * Remove a file or directory
 */
export async function removePath(
  path: string,
  verbose: boolean = false
): Promise<CommandResult> {
  return executeCommand(`rm -rf "${path}"`, verbose);
}

/**
 * Create a directory
 */
export async function createDirectory(
  path: string,
  verbose: boolean = false
): Promise<CommandResult> {
  return executeCommand(`mkdir -p "${path}"`, verbose);
}

/**
 * Copy files
 */
export async function copyFiles(
  source: string,
  target: string,
  verbose: boolean = false
): Promise<CommandResult> {
  return executeCommand(`cp -r "${source}" "${target}"`, verbose);
}

/**
 * Move files
 */
export async function moveFiles(
  source: string,
  target: string,
  verbose: boolean = false
): Promise<CommandResult> {
  return executeCommand(`mv "${source}" "${target}"`, verbose);
}

/**
 * Change file permissions
 */
export async function changePermissions(
  path: string,
  permissions: string,
  verbose: boolean = false
): Promise<CommandResult> {
  return executeCommand(`chmod ${permissions} "${path}"`, verbose);
}

/**
 * Change file ownership
 */
export async function changeOwnership(
  path: string,
  owner: string,
  verbose: boolean = false
): Promise<CommandResult> {
  return executeCommand(`chown -R ${owner} "${path}"`, verbose);
}

/**
 * Get current user
 */
export async function getCurrentUser(verbose: boolean = false): Promise<CommandResult> {
  return executeCommand("whoami", verbose);
}

/**
 * Get home directory
 */
export async function getHomeDirectory(verbose: boolean = false): Promise<CommandResult> {
  return executeCommand("echo $HOME", verbose);
}

/**
 * Check if running as root
 */
export async function isRoot(verbose: boolean = false): Promise<CommandResult> {
  return executeCommand("[[ $EUID -eq 0 ]] && echo 'root' || echo 'user'", verbose);
}

/**
 * Get system information
 */
export async function getSystemInfo(verbose: boolean = false): Promise<CommandResult> {
  return executeCommand("uname -a", verbose);
}

/**
 * Get distribution information
 */
export async function getDistributionInfo(verbose: boolean = false): Promise<CommandResult> {
  return executeCommand("lsb_release -a", verbose);
}

/**
 * Check internet connection
 */
export async function checkInternetConnection(verbose: boolean = false): Promise<CommandResult> {
  return executeCommand("ping -c 1 google.com >/dev/null 2>&1 && echo 'connected' || echo 'disconnected'", verbose);
}

/**
 * Restart a service
 */
export async function restartService(
  serviceName: string,
  verbose: boolean = false
): Promise<CommandResult> {
  return executeCommand(`sudo systemctl restart ${serviceName}`, verbose);
}

/**
 * Enable a service
 */
export async function enableService(
  serviceName: string,
  verbose: boolean = false
): Promise<CommandResult> {
  return executeCommand(`sudo systemctl enable ${serviceName}`, verbose);
}

/**
 * Check service status
 */
export async function getServiceStatus(
  serviceName: string,
  verbose: boolean = false
): Promise<CommandResult> {
  return executeCommand(`sudo systemctl status ${serviceName}`, verbose);
}

/**
 * Add user to group
 */
export async function addUserToGroup(
  username: string,
  groupName: string,
  verbose: boolean = false
): Promise<CommandResult> {
  return executeCommand(`sudo usermod -aG ${groupName} ${username}`, verbose);
}

/**
 * Check if user is in group
 */
export async function isUserInGroup(
  username: string,
  groupName: string,
  verbose: boolean = false
): Promise<CommandResult> {
  return executeCommand(`groups ${username} | grep -q ${groupName}`, verbose);
}
