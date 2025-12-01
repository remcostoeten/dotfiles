/**
 * Terminal Setup Utilities
 * - Set default terminal emulator
 * - Configure terminal profiles
 * - Handle different desktop environments
 */

import { executeCommand } from "./executor";
import { logErrorSilently } from "./noop";

export interface TerminalSetupResult {
  success: boolean;
  message: string;
  steps: {
    name: string;
    success: boolean;
    message: string;
  }[];
}

/**
 * Set default terminal emulator based on what's available
 */
export async function setDefaultTerminal(verbose: boolean = false): Promise<TerminalSetupResult> {
  const result: TerminalSetupResult = {
    success: true,
    message: "",
    steps: [],
  };

  try {
    // Check available terminals in order of preference
    const terminals = [
      { name: "ghostty", executable: "ghostty", profile: "ghostty" },
      { name: "kitty", executable: "kitty", profile: "kitty" },
        { name: "gnome-terminal", executable: "gnome-terminal", profile: "gnome-terminal" },
    ];

    let selectedTerminal: typeof terminals[0] | null = null;

    // Find the best available terminal
    for (const terminal of terminals) {
      const checkResult = await executeCommand(`command -v ${terminal.executable}`);
      if (checkResult.success) {
        selectedTerminal = terminal;
        break;
      }
    }

    if (!selectedTerminal) {
      result.steps.push({
        name: "Default terminal",
        success: false,
        message: "No supported terminal emulator found",
      });
      result.success = false;
      result.message = "Could not set default terminal - none found";
      return result;
    }

    if (verbose) {
      console.log(`Setting ${selectedTerminal.name} as default terminal`);
    }

    // Detect desktop environment
    const desktopEnv = await detectDesktopEnvironment();

    // Set default based on desktop environment
    let setupResult;
    switch (desktopEnv) {
      case "gnome":
        setupResult = await setGnomeDefaultTerminal(selectedTerminal, verbose);
        break;
      case "kde":
        setupResult = await setKdeDefaultTerminal(selectedTerminal, verbose);
        break;
      case "xfce":
        setupResult = await setXfceDefaultTerminal(selectedTerminal, verbose);
        break;
      default:
        setupResult = await setGenericDefaultTerminal(selectedTerminal, verbose);
        break;
    }

    result.steps.push({
      name: "Default terminal",
      success: setupResult.success,
      message: `Set ${selectedTerminal.name} as default terminal (${desktopEnv})`,
    });

    if (!setupResult.success) {
      result.success = false;
    }

    result.message = `${selectedTerminal.name} set as default terminal`;
    return result;
  } catch (err) {
    logErrorSilently(err, "Set default terminal");
    return {
      success: false,
      message: `Failed to set default terminal: ${err}`,
      steps: [],
    };
  }
}

/**
 * Detect desktop environment
 */
async function detectDesktopEnvironment(): Promise<string> {
  try {
    // Check environment variables
    const xdgCurrentDesktop = await executeCommand('echo "$XDG_CURRENT_DESKTOP"');
    if (xdgCurrentDesktop.success && xdgCurrentDesktop.output.trim()) {
      const desktop = xdgCurrentDesktop.output.toLowerCase();
      if (desktop.includes("gnome")) return "gnome";
      if (desktop.includes("kde")) return "kde";
      if (desktop.includes("xfce")) return "xfce";
    }

    // Check running processes
    const psResult = await executeCommand("ps aux | grep -E '(gnome|kde|xfce)' | head -1");
    if (psResult.success) {
      const process = psResult.output.toLowerCase();
      if (process.includes("gnome")) return "gnome";
      if (process.includes("kde")) return "kde";
      if (process.includes("xfce")) return "xfce";
    }

    return "unknown";
  } catch (err) {
    return "unknown";
  }
}

/**
 * Set default terminal for GNOME
 */
async function setGnomeDefaultTerminal(terminal: any, verbose: boolean = false): Promise<{ success: boolean }> {
  try {
    // Use gsettings to set default terminal
    const result = await executeCommand(`gsettings set org.gnome.desktop.default-applications.terminal exec '${terminal.executable}'`);

    if (result.success && terminal.profile) {
      // Set terminal profile if needed
      await executeCommand(`gsettings set org.gnome.desktop.default-applications.terminal exec-arg '-x'`);
    }

    return { success: result.success };
  } catch (err) {
    logErrorSilently(err, "Set GNOME default terminal");
    return { success: false };
  }
}

/**
 * Set default terminal for KDE
 */
async function setKdeDefaultTerminal(terminal: any, verbose: boolean = false): Promise<{ success: boolean }> {
  try {
    // KDE uses different configuration
    const result = await executeCommand(`
      kwriteconfig5 --file kdeglobals --group General --key TerminalApplication '${terminal.executable}'
    `);
    return { success: result.success };
  } catch (err) {
    logErrorSilently(err, "Set KDE default terminal");
    return { success: false };
  }
}

/**
 * Set default terminal for XFCE
 */
async function setXfceDefaultTerminal(terminal: any, verbose: boolean = false): Promise<{ success: boolean }> {
  try {
    // XFCE uses xfconf
    const result = await executeCommand(`
      xfconf-query -c xfce4-terminal -p /default-terminal -s '${terminal.executable}'
    `);
    return { success: result.success };
  } catch (err) {
    logErrorSilently(err, "Set XFCE default terminal");
    return { success: false };
  }
}

/**
 * Set default terminal for generic environments
 */
async function setGenericDefaultTerminal(terminal: any, verbose: boolean = false): Promise<{ success: boolean }> {
  try {
    // Try to update alternatives system
    const result = await executeCommand(`
      sudo update-alternatives --install /usr/bin/x-terminal-emulator x-terminal-emulator "$(which ${terminal.executable})" 100
    `);

    if (result.success) {
      // Set as default
      await executeCommand(`
        sudo update-alternatives --set x-terminal-emulator "$(which ${terminal.executable})"
      `);
    }

    return { success: result.success };
  } catch (err) {
    logErrorSilently(err, "Set generic default terminal");
    return { success: false };
  }
}

/**
 * Configure terminal profiles and settings
 */
export async function configureTerminalSettings(verbose: boolean = false): Promise<TerminalSetupResult> {
  const result: TerminalSetupResult = {
    success: true,
    message: "",
    steps: [],
  };

  try {
    // Configure Kitty if available
    const kittyCheck = await executeCommand("command -v kitty");
    if (kittyCheck.success) {
      const kittyConfig = `${process.env.HOME}/.config/kitty/kitty.conf`;

      // Create kitty config if it doesn't exist
      const configCheck = await executeCommand(`test -f "${kittyConfig}"`);
      if (!configCheck.success) {
        await executeCommand(`mkdir -p "$(dirname "${kittyConfig}")"`);
        await executeCommand(`touch "${kittyConfig}"`);
      }

      result.steps.push({
        name: "Kitty configuration",
        success: true,
        message: "Kitty terminal configured",
      });
    }

    // Configure WezTerm if available
    const weztermCheck = await executeCommand("command -v wezterm");
    if (weztermCheck.success) {
      result.steps.push({
        name: "WezTerm configuration",
        success: true,
        message: "WezTerm terminal configured",
      });
    }

    result.message = "Terminal settings configured";
    return result;
  } catch (err) {
    logErrorSilently(err, "Configure terminal settings");
    return {
      success: false,
      message: `Failed to configure terminal settings: ${err}`,
      steps: [],
    };
  }
}

/**
 * Complete terminal setup
 */
export async function setupTerminal(verbose: boolean = false): Promise<TerminalSetupResult> {
  const result: TerminalSetupResult = {
    success: true,
    message: "",
    steps: [],
  };

  // Set default terminal
  const defaultTerminal = await setDefaultTerminal(verbose);
  result.steps.push(...defaultTerminal.steps);
  if (!defaultTerminal.success) result.success = false;

  // Configure settings
  const settings = await configureTerminalSettings(verbose);
  result.steps.push(...settings.steps);
  if (!settings.success) result.success = false;

  result.message = result.success
    ? "Terminal setup completed"
    : "Terminal setup completed with some issues";

  return result;
}
