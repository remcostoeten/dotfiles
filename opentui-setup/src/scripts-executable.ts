/**
 * Scripts Executable Utilities
 * - Make all dotfiles scripts executable
 * - Verify executability
 * - Handle permissions
 */

import { executeCommand } from "./executor";
import { logErrorSilently } from "./noop";
import { existsSync } from "fs";

export interface ScriptsExecutableResult {
  success: boolean;
  message: string;
  steps: {
    name: string;
    success: boolean;
    message: string;
  }[];
}

/**
 * Make all scripts in dotfiles/bin and dotfiles/scripts executable
 */
export async function makeScriptsExecutable(verbose: boolean = false): Promise<ScriptsExecutableResult> {
  const result: ScriptsExecutableResult = {
    success: true,
    message: "",
    steps: [],
  };

  const DOTFILES_DIR = `${process.env.HOME}/.config/dotfiles`;
  const binDir = `${DOTFILES_DIR}/bin`;
  const scriptsDir = `${DOTFILES_DIR}/scripts`;

  try {
    // Make bin directory scripts executable
    if (existsSync(binDir)) {
      if (verbose) {
        console.log("Making bin scripts executable...");
      }

      const binResult = await executeCommand(`
        find "${binDir}" -type f \\
          ! -name "*.md" \\
          ! -name "*.txt" \\
          ! -name "*.json" \\
          ! -name "*.lock" \\
          ! -name "*.pyc" \\
          -exec chmod +x {} \\; 2>/dev/null || true
      `);

      if (binResult.success) {
        result.steps.push({
          name: "Bin scripts executable",
          success: true,
          message: "Made all bin scripts executable",
        });
      } else {
        result.steps.push({
          name: "Bin scripts executable",
          success: false,
          message: "Failed to make bin scripts executable",
        });
        result.success = false;
      }
    } else {
      result.steps.push({
        name: "Bin scripts executable",
        success: true,
        message: "No bin directory found (skipped)",
      });
    }

    // Make scripts directory files executable
    if (existsSync(scriptsDir)) {
      if (verbose) {
        console.log("Making scripts directory files executable...");
      }

      const scriptsResult = await executeCommand(`
        find "${scriptsDir}" -type f \\
          \\( -name "*.sh" -o -name "*.py" -o -name "*.ts" -o -name "*.fish" -o -name "*.js" -o -name "*.rb" -o -name "*.pl" \\) \\
          -exec chmod +x {} \\; 2>/dev/null || true
      `);

      if (scriptsResult.success) {
        result.steps.push({
          name: "Scripts directory executable",
          success: true,
          message: "Made all script files executable",
        });
      } else {
        result.steps.push({
          name: "Scripts directory executable",
          success: false,
          message: "Failed to make script files executable",
        });
        result.success = false;
      }
    } else {
      result.steps.push({
        name: "Scripts directory executable",
        success: true,
        message: "No scripts directory found (skipped)",
      });
    }

    // Make additional common script types executable
    if (existsSync(DOTFILES_DIR)) {
      if (verbose) {
        console.log("Making additional scripts executable...");
      }

      const additionalResult = await executeCommand(`
        find "${DOTFILES_DIR}" -maxdepth 2 -type f \\
          \\( -name "*.sh" -o -name "install.sh" -o -name "setup.sh" -o -name "*.fish" \\) \\
          -exec chmod +x {} \\; 2>/dev/null || true
      `);

      if (additionalResult.success) {
        result.steps.push({
          name: "Additional scripts executable",
          success: true,
          message: "Made additional scripts executable",
        });
      } else {
        result.steps.push({
          name: "Additional scripts executable",
          success: false,
          message: "Failed to make additional scripts executable",
        });
        result.success = false;
      }
    }

    // Count executable files
    const countResult = await executeCommand(`
      find "${binDir}" "${scriptsDir}" "${DOTFILES_DIR}" \\
        -type f -executable 2>/dev/null | wc -l
    `);

    const executableCount = parseInt(countResult.output.trim()) || 0;

    result.message = `Scripts executable setup completed (${executableCount} executable files)`;
    return result;
  } catch (err) {
    logErrorSilently(err, "Make scripts executable");
    return {
      success: false,
      message: `Failed to make scripts executable: ${err}`,
      steps: [],
    };
  }
}

/**
 * Verify scripts are executable
 */
export async function verifyScriptsExecutable(verbose: boolean = false): Promise<ScriptsExecutableResult> {
  const result: ScriptsExecutableResult = {
    success: true,
    message: "",
    steps: [],
  };

  const DOTFILES_DIR = `${process.env.HOME}/.config/dotfiles`;
  const binDir = `${DOTFILES_DIR}/bin`;
  const scriptsDir = `${DOTFILES_DIR}/scripts`;

  try {
    // Check bin directory
    if (existsSync(binDir)) {
      const binCheck = await executeCommand(`find "${binDir}" -type f -executable | wc -l`);
      const binCount = parseInt(binCheck.output.trim()) || 0;

      result.steps.push({
        name: "Bin scripts verification",
        success: binCount > 0,
        message: `${binCount} executable scripts in bin directory`,
      });
    }

    // Check scripts directory
    if (existsSync(scriptsDir)) {
      const scriptsCheck = await executeCommand(`find "${scriptsDir}" -type f -executable | wc -l`);
      const scriptsCount = parseInt(scriptsCheck.output.trim()) || 0;

      result.steps.push({
        name: "Scripts verification",
        success: scriptsCount > 0,
        message: `${scriptsCount} executable files in scripts directory`,
      });
    }

    result.message = "Scripts executability verified";
    return result;
  } catch (err) {
    logErrorSilently(err, "Verify scripts executable");
    return {
      success: false,
      message: `Failed to verify scripts: ${err}`,
      steps: [],
    };
  }
}
