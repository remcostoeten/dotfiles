/**
 * Shell Setup Utilities
 * - Install Fish shell
 * - Set Fish as default shell
 * - Configure shell environment
 */

import { executeCommand } from "./executor";
import { logErrorSilently } from "./noop";

export interface ShellSetupResult {
  success: boolean;
  message: string;
  steps: {
    name: string;
    success: boolean;
    message: string;
  }[];
}

/**
 * Install Fish shell
 */
export async function installFishShell(verbose: boolean = false): Promise<ShellSetupResult> {
  const result: ShellSetupResult = {
    success: true,
    message: "",
    steps: [],
  };

  try {
    // Check if Fish is already installed
    const fishCheck = await executeCommand("command -v fish");
    if (fishCheck.success) {
      result.steps.push({
        name: "Fish installation",
        success: true,
        message: "Fish shell is already installed",
      });
      result.message = "Fish shell already available";
      return result;
    }

    // Install Fish shell
    if (verbose) {
      console.log("Installing Fish shell...");
    }

    const installResult = await executeCommand("sudo apt-get update && sudo apt-get install -y fish");

    if (installResult.success) {
      result.steps.push({
        name: "Fish installation",
        success: true,
        message: "Fish shell installed successfully",
      });
    } else {
      result.steps.push({
        name: "Fish installation",
        success: false,
        message: "Failed to install Fish shell",
      });
      result.success = false;
      result.message = "Failed to install Fish shell";
      return result;
    }

    // Verify installation
    const verifyResult = await executeCommand("command -v fish");
    if (verifyResult.success) {
      result.message = "Fish shell installed and verified";
    } else {
      result.success = false;
      result.message = "Fish shell installation verification failed";
    }

    return result;
  } catch (err) {
    logErrorSilently(err, "Fish shell installation");
    return {
      success: false,
      message: `Fish shell installation failed: ${err}`,
      steps: [],
    };
  }
}

/**
 * Set Fish as default shell
 */
export async function setFishAsDefaultShell(verbose: boolean = false): Promise<ShellSetupResult> {
  const result: ShellSetupResult = {
    success: true,
    message: "",
    steps: [],
  };

  try {
    // Check if Fish is installed
    const fishCheck = await executeCommand("command -v fish");
    if (!fishCheck.success) {
      result.steps.push({
        name: "Fish default shell",
        success: false,
        message: "Fish shell is not installed",
      });
      result.success = false;
      result.message = "Cannot set Fish as default - not installed";
      return result;
    }

    // Get current shell
    const currentShellResult = await executeCommand("echo $SHELL");
    const currentShell = currentShellResult.output.trim();

    if (currentShell.includes("fish")) {
      result.steps.push({
        name: "Fish default shell",
        success: true,
        message: "Fish is already the default shell",
      });
      result.message = "Fish already set as default";
      return result;
    }

    // Get Fish path
    const fishPathResult = await executeCommand("which fish");
    const fishPath = fishPathResult.output.trim();

    if (!fishPath) {
      result.steps.push({
        name: "Fish default shell",
        success: false,
        message: "Could not find Fish shell path",
      });
      result.success = false;
      result.message = "Failed to locate Fish shell";
      return result;
    }

    // Set Fish as default shell
    if (verbose) {
      console.log(`Setting Fish as default shell: ${fishPath}`);
    }

    const chshResult = await executeCommand(`chsh -s ${fishPath}`);

    if (chshResult.success) {
      result.steps.push({
        name: "Fish default shell",
        success: true,
        message: `Fish set as default shell (${fishPath})`,
      });
      result.message = "Fish set as default shell (restart terminal to apply)";
    } else {
      result.steps.push({
        name: "Fish default shell",
        success: false,
        message: "Failed to set Fish as default shell",
      });
      result.success = false;
      result.message = "Failed to set Fish as default shell";
    }

    return result;
  } catch (err) {
    logErrorSilently(err, "Set Fish as default shell");
    return {
      success: false,
      message: `Failed to set Fish as default: ${err}`,
      steps: [],
    };
  }
}

/**
 * Configure shell environment
 */
export async function configureShellEnvironment(verbose: boolean = false): Promise<ShellSetupResult> {
  const result: ShellSetupResult = {
    success: true,
    message: "",
    steps: [],
  };

  try {
    const bashrc = `${process.env.HOME}/.bashrc`;

    // Add Fish to bashrc for fallback
    const fishEntry = `
# Fish shell integration
if command -v fish >/dev/null 2>&1; then
    # Start Fish in interactive bash sessions
    if [[ $- == *i* ]] && [[ -z "$FISH_STARTED" ]]; then
        export FISH_STARTED=1
        exec fish
    fi
fi`;

    const bashrcContent = await executeCommand(`cat "${bashrc}" 2>/dev/null || echo ""`);

    if (!bashrcContent.output.includes("Fish shell integration")) {
      if (verbose) {
        console.log("Adding Fish integration to .bashrc");
      }

      const appendResult = await executeCommand(`echo '${fishEntry}' >> "${bashrc}"`);

      if (appendResult.success) {
        result.steps.push({
          name: "Shell environment",
          success: true,
          message: "Added Fish integration to .bashrc",
        });
      } else {
        result.steps.push({
          name: "Shell environment",
          success: false,
          message: "Failed to update .bashrc",
        });
        result.success = false;
      }
    } else {
      result.steps.push({
        name: "Shell environment",
        success: true,
        message: "Fish integration already in .bashrc",
      });
    }

    result.message = "Shell environment configured";
    return result;
  } catch (err) {
    logErrorSilently(err, "Configure shell environment");
    return {
      success: false,
      message: `Failed to configure shell environment: ${err}`,
      steps: [],
    };
  }
}

/**
 * Complete shell setup
 */
export async function setupShell(verbose: boolean = false): Promise<ShellSetupResult> {
  const result: ShellSetupResult = {
    success: true,
    message: "",
    steps: [],
  };

  // Install Fish
  const fishInstall = await installFishShell(verbose);
  result.steps.push(...fishInstall.steps);
  if (!fishInstall.success) result.success = false;

  // Configure environment
  const envConfig = await configureShellEnvironment(verbose);
  result.steps.push(...envConfig.steps);
  if (!envConfig.success) result.success = false;

  // Set as default
  const defaultShell = await setFishAsDefaultShell(verbose);
  result.steps.push(...defaultShell.steps);
  if (!defaultShell.success) result.success = false;

  result.message = result.success
    ? "Shell setup completed (restart terminal to apply changes)"
    : "Shell setup completed with some issues";

  return result;
}
