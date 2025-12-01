/**
 * Verification System
 * - Verify all components are working
 * - Test aliases, functions, apps
 * - Generate comprehensive report
 */

import { executeCommand } from "./executor";
import { logErrorSilently } from "./noop";

export interface VerificationResult {
  success: boolean;
  message: string;
  checks: {
    name: string;
    success: boolean;
    message: string;
    details?: string;
  }[];
}

/**
 * Comprehensive system verification
 */
export async function verifySystem(verbose: boolean = false): Promise<VerificationResult> {
  const result: VerificationResult = {
    success: true,
    message: "",
    checks: [],
  };

  try {
    // Check Fish shell
    const fishCheck = await verifyFishShell(verbose);
    result.checks.push(fishCheck);
    if (!fishCheck.success) result.success = false;

    // Check dotfiles configuration
    const dotfilesCheck = await verifyDotfilesConfig(verbose);
    result.checks.push(dotfilesCheck);
    if (!dotfilesCheck.success) result.success = false;

    // Check scripts and PATH
    const scriptsCheck = await verifyScripts(verbose);
    result.checks.push(scriptsCheck);
    if (!scriptsCheck.success) result.success = false;

    // Check config apps
    const configAppsCheck = await verifyConfigApps(verbose);
    result.checks.push(configAppsCheck);
    if (!configAppsCheck.success) result.success = false;

    // Check aliases and functions
    const aliasesCheck = await verifyAliases(verbose);
    result.checks.push(aliasesCheck);
    if (!aliasesCheck.success) result.success = false;

    // Check Android development setup
    const androidCheck = await verifyAndroidSetup(verbose);
    result.checks.push(androidCheck);
    // Android setup is optional, don't fail overall

    // Check terminal setup
    const terminalCheck = await verifyTerminalSetup(verbose);
    result.checks.push(terminalCheck);
    if (!terminalCheck.success) result.success = false;

    // Check Brave as default browser
    const braveCheck = await verifyBraveDefault(verbose);
    result.checks.push(braveCheck);
    if (!braveCheck.success) result.success = false;

    // Check wallpaper is set
    const wallpaperCheck = await verifyWallpaper(verbose);
    result.checks.push(wallpaperCheck);
    if (!wallpaperCheck.success) result.success = false;

    // Check Docker setup
    const dockerCheck = await verifyDockerSetup(verbose);
    result.checks.push(dockerCheck);
    if (!dockerCheck.success) result.success = false;

    // Check Blur My Shell extension
    const blurCheck = await verifyBlurMyShell(verbose);
    result.checks.push(blurCheck);
    // Blur My Shell is optional, don't fail overall

    // Check sudo NOPASSWD
    const sudoCheck = await verifySudoNoPassword(verbose);
    result.checks.push(sudoCheck);
    if (!sudoCheck.success) result.success = false;

    // Check GNOME desktop configuration
    const gnomeDesktopCheck = await verifyGnomeDesktop(verbose);
    result.checks.push(gnomeDesktopCheck);
    if (!gnomeDesktopCheck.success) result.success = false;

    const successCount = result.checks.filter(c => c.success).length;
    const totalCount = result.checks.length;

    result.message = `System verification: ${successCount}/${totalCount} checks passed`;
    return result;
  } catch (err) {
    logErrorSilently(err, "System verification");
    return {
      success: false,
      message: `System verification failed: ${err}`,
      checks: [],
    };
  }
}

/**
 * Verify Fish shell installation and configuration
 */
async function verifyFishShell(verbose: boolean = false): Promise<{ name: string; success: boolean; message: string; details?: string }> {
  try {
    const fishCheck = await executeCommand("command -v fish");
    if (!fishCheck.success) {
      return {
        name: "Fish Shell",
        success: false,
        message: "Fish shell is not installed",
        details: "Install with: sudo apt install fish",
      };
    }

    const fishVersion = await executeCommand("fish --version");
    const fishConfig = await executeCommand("test -f ~/.config/fish/config.fish");

    return {
      name: "Fish Shell",
      success: true,
      message: "Fish shell is installed and configured",
      details: fishVersion.output.trim(),
    };
  } catch (err) {
    return {
      name: "Fish Shell",
      success: false,
      message: "Failed to verify Fish shell",
    };
  }
}

/**
 * Verify dotfiles configuration
 */
async function verifyDotfilesConfig(verbose: boolean = false): Promise<{ name: string; success: boolean; message: string; details?: string }> {
  try {
    const DOTFILES_DIR = `${process.env.HOME}/.config/dotfiles`;
    const configCheck = await executeCommand(`test -d "${DOTFILES_DIR}"`);

    if (!configCheck.success) {
      return {
        name: "Dotfiles Config",
        success: false,
        message: "Dotfiles directory not found",
        details: `Expected: ${DOTFILES_DIR}`,
      };
    }

    const cfgCheck = await executeCommand(`test -f "${DOTFILES_DIR}/cfg"`);
    const functionsCheck = await executeCommand(`test -d "${DOTFILES_DIR}/configs/fish/functions"`);
    const aliasesCheck = await executeCommand(`test -d "${DOTFILES_DIR}/configs/fish/aliases"`);

    if (cfgCheck.success && functionsCheck.success) {
      return {
        name: "Dotfiles Config",
        success: true,
        message: "Dotfiles configuration is complete",
        details: "cfg, functions, and aliases found",
      };
    } else {
      return {
        name: "Dotfiles Config",
        success: false,
        message: "Dotfiles configuration is incomplete",
        details: "Missing cfg file or functions directory",
      };
    }
  } catch (err) {
    return {
      name: "Dotfiles Config",
      success: false,
      message: "Failed to verify dotfiles config",
    };
  }
}

/**
 * Verify scripts and PATH configuration
 */
async function verifyScripts(verbose: boolean = false): Promise<{ name: string; success: boolean; message: string; details?: string }> {
  try {
    const DOTFILES_DIR = `${process.env.HOME}/.config/dotfiles`;
    const binDir = `${DOTFILES_DIR}/bin`;
    const scriptsDir = `${DOTFILES_DIR}/scripts`;

    // Check if directories exist and are in PATH
    const pathCheck = await executeCommand('echo "$PATH"');
    const pathIncludesBin = pathCheck.output.includes("dotfiles/bin");
    const pathIncludesScripts = pathCheck.output.includes("dotfiles/scripts");

    // Check if scripts are executable
    const execCheck = await executeCommand(`find "${binDir}" "${scriptsDir}" -type f -executable 2>/dev/null | wc -l`);
    const execCount = parseInt(execCheck.output.trim()) || 0;

    if (pathIncludesBin && pathIncludesScripts && execCount > 0) {
      return {
        name: "Scripts & PATH",
        success: true,
        message: "Scripts are executable and in PATH",
        details: `${execCount} executable scripts found`,
      };
    } else {
      return {
        name: "Scripts & PATH",
        success: false,
        message: "Scripts or PATH configuration issue",
        details: `Bin in PATH: ${pathIncludesBin}, Scripts in PATH: ${pathIncludesScripts}, Executable: ${execCount}`,
      };
    }
  } catch (err) {
    return {
      name: "Scripts & PATH",
      success: false,
      message: "Failed to verify scripts configuration",
    };
  }
}

/**
 * Verify config apps symlinks
 */
async function verifyConfigApps(verbose: boolean = false): Promise<{ name: string; success: boolean; message: string; details?: string }> {
  try {
    const configApps = ["nvim", "kitty", "git"];
    let workingCount = 0;
    let totalCount = 0;

    for (const app of configApps) {
      totalCount++;
      const configPath = `${process.env.HOME}/.config/${app}`;
      const checkResult = await executeCommand(`test -L "${configPath}"`);

      if (checkResult.success) {
        workingCount++;
      }
    }

    if (workingCount === totalCount) {
      return {
        name: "Config Apps",
        success: true,
        message: "All config apps are symlinked",
        details: `${workingCount}/${totalCount} apps configured`,
      };
    } else {
      return {
        name: "Config Apps",
        success: false,
        message: "Some config apps are not symlinked",
        details: `${workingCount}/${totalCount} apps configured`,
      };
    }
  } catch (err) {
    return {
      name: "Config Apps",
      success: false,
      message: "Failed to verify config apps",
    };
  }
}

/**
 * Verify aliases and functions
 */
async function verifyAliases(verbose: boolean = false): Promise<{ name: string; success: boolean; message: string; details?: string }> {
  try {
    // Test some key aliases in Fish
    const aliasTests = [
      { alias: "ls", expected: "eza" },
      { alias: "dot", expected: "cd ~/.config/dotfiles" },
      { alias: "df", expected: "dotfiles" },
    ];

    let workingAliases = 0;

    for (const test of aliasTests) {
      const result = await executeCommand(`fish -c "functions ${test.alias}"`);
      if (result.success) {
        workingAliases++;
      }
    }

    // Test Android functions
    const androidCheck = await executeCommand("fish -c 'functions govee'");
    const androidWorking = androidCheck.success;

    if (workingAliases >= 2) {
      return {
        name: "Aliases & Functions",
        success: true,
        message: "Fish aliases and functions are working",
        details: `${workingAliases}/${aliasTests.length} aliases working, Android functions: ${androidWorking}`,
      };
    } else {
      return {
        name: "Aliases & Functions",
        success: false,
        message: "Some aliases or functions are not working",
        details: `${workingAliases}/${aliasTests.length} aliases working`,
      };
    }
  } catch (err) {
    return {
      name: "Aliases & Functions",
      success: false,
      message: "Failed to verify aliases and functions",
    };
  }
}

/**
 * Verify Android development setup
 */
async function verifyAndroidSetup(verbose: boolean = false): Promise<{ name: string; success: boolean; message: string; details?: string }> {
  try {
    const androidStudioCheck = await executeCommand("command -v studio");
    const emulatorCheck = await executeCommand("command -v emulator");

    if (androidStudioCheck.success) {
      return {
        name: "Android Development",
        success: true,
        message: "Android Studio is installed",
        details: emulatorCheck.success ? "Emulator also available" : "Emulator not found",
      };
    } else {
      return {
        name: "Android Development",
        success: false,
        message: "Android Studio not installed",
        details: "Install with: sudo snap install android-studio",
      };
    }
  } catch (err) {
    return {
      name: "Android Development",
      success: false,
      message: "Failed to verify Android setup",
    };
  }
}

/**
 * Verify terminal setup
 */
async function verifyTerminalSetup(verbose: boolean = false): Promise<{ name: string; success: boolean; message: string; details?: string }> {
  try {
    const terminals = ["ghostty", "kitty"];
    let availableTerminal = "";

    for (const terminal of terminals) {
      const check = await executeCommand(`command -v ${terminal}`);
      if (check.success) {
        availableTerminal = terminal;
        break;
      }
    }

    if (availableTerminal) {
      return {
        name: "Terminal Setup",
        success: true,
        message: "Modern terminal emulator is available",
        details: `Found: ${availableTerminal}`,
      };
    } else {
      return {
        name: "Terminal Setup",
        success: false,
        message: "No modern terminal emulator found",
        details: "Install ghostty or kitty",
      };
    }
  } catch (err) {
    return {
      name: "Terminal Setup",
      success: false,
      message: "Failed to verify terminal setup",
    };
  }
}

/**
 * Verify Brave is the default browser
 */
async function verifyBraveDefault(verbose: boolean = false): Promise<{ name: string; success: boolean; message: string; details?: string }> {
  try {
    const result = await executeCommand("xdg-settings get default-web-browser", verbose);
    if (result.success && result.output.includes("brave")) {
      return {
        name: "Brave Default Browser",
        success: true,
        message: "Brave is set as the default browser",
        details: `Default: ${result.output.trim()}`,
      };
    } else {
      return {
        name: "Brave Default Browser",
        success: false,
        message: "Brave is not set as the default browser",
        details: result.error || "Current default is not Brave",
      };
    }
  } catch (err) {
    return {
      name: "Brave Default Browser",
      success: false,
      message: "Failed to verify default browser",
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Verify wallpaper is set from dotfiles/assets/wallpaper.png
 */
async function verifyWallpaper(verbose: boolean = false): Promise<{ name: string; success: boolean; message: string; details?: string }> {
  try {
    const wallpaperPath = `${process.env.HOME}/.config/dotfiles/setup/assets/wallpaper.png`;
    const fileCheck = await executeCommand(`test -f "${wallpaperPath}"`, verbose);
    if (!fileCheck.success) {
      return {
        name: "Wallpaper Set",
        success: false,
        message: "Wallpaper file not found",
        details: `Expected: ${wallpaperPath}`,
      };
    }

    const desktopCheck = await executeCommand("echo $XDG_CURRENT_DESKTOP", verbose);
    const desktop = desktopCheck.success ? desktopCheck.output.trim().toLowerCase() : "";
    if (desktop.includes("gnome") || desktop.includes("ubuntu")) {
      const result = await executeCommand("gsettings get org.gnome.desktop.background picture-uri", verbose);
      if (result.success && result.output.includes("dotfiles/assets/wallpaper.png")) {
        return {
          name: "Wallpaper Set",
          success: true,
          message: "Wallpaper is set to dotfiles/assets/wallpaper.png",
          details: `Desktop: ${desktop}`,
        };
      } else {
        return {
          name: "Wallpaper Set",
          success: false,
          message: "Wallpaper not set to target file",
          details: `Current: ${result.output.trim()}`,
        };
      }
    } else {
      return {
        name: "Wallpaper Set",
        success: false,
        message: "Unsupported desktop environment",
        details: `Detected: ${desktop}`,
      };
    }
  } catch (err) {
    return {
      name: "Wallpaper Set",
      success: false,
      message: "Failed to verify wallpaper",
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Verify Docker group membership and daemon
 */
async function verifyDockerSetup(verbose: boolean = false): Promise<{ name: string; success: boolean; message: string; details?: string }> {
  try {
    const dockerCheck = await executeCommand("command -v docker", verbose);
    if (!dockerCheck.success) {
      return {
        name: "Docker Setup",
        success: false,
        message: "Docker is not installed",
        details: "Install with: sudo apt install docker.io",
      };
    }

    const groupCheck = await executeCommand("groups $USER | grep -q docker", verbose);
    if (!groupCheck.success) {
      return {
        name: "Docker Setup",
        success: false,
        message: "User is not in the docker group",
        details: "Run: sudo usermod -aG docker $USER && re-login",
      };
    }

    const daemonCheck = await executeCommand("docker info", verbose);
    if (daemonCheck.success) {
      return {
        name: "Docker Setup",
        success: true,
        message: "Docker is installed and daemon is running",
        details: "User in docker group and daemon responsive",
      };
    } else {
      return {
        name: "Docker Setup",
        success: false,
        message: "Docker daemon is not responding",
        details: "Try: sudo systemctl start docker",
      };
    }
  } catch (err) {
    return {
      name: "Docker Setup",
      success: false,
      message: "Failed to verify Docker setup",
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Verify sudo NOPASSWD configuration
 */
async function verifySudoNoPassword(verbose: boolean = false): Promise<{ name: string; success: boolean; message: string; details?: string }> {
  try {
    const user = process.env.USER || "user";
    const sudoersLine = `${user} ALL=(ALL) NOPASSWD: ALL`;
    const checkResult = await executeCommand(`sudo -n true 2>/dev/null`, verbose);

    if (checkResult.success) {
      return {
        name: "Sudo NOPASSWD",
        success: true,
        message: "Sudo passwordless access configured",
        details: `User ${user} can sudo without password`,
      };
    } else {
      return {
        name: "Sudo NOPASSWD",
        success: false,
        message: "Sudo passwordless access not configured",
        details: "Run: configure sudo NOPASSWD",
      };
    }
  } catch (err) {
    return {
      name: "Sudo NOPASSWD",
      success: false,
      message: "Failed to verify sudo configuration",
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Verify GNOME desktop configuration
 */
async function verifyGnomeDesktop(verbose: boolean = false): Promise<{ name: string; success: boolean; message: string; details?: string }> {
  try {
    // Check desktop icons are hidden
    const iconsResult = await executeCommand("gsettings get org.gnome.desktop.background show-desktop-icons", verbose);
    const iconsHidden = iconsResult.success && iconsResult.output.includes("false");

    // Check hot corners are enabled
    const hotCornerResult = await executeCommand("gsettings get org.gnome.desktop.interface enable-hot-corners", verbose);
    const hotCornersEnabled = hotCornerResult.success && hotCornerResult.output.includes("true");

    // Check animations are disabled
    const animationsResult = await executeCommand("gsettings get org.gnome.desktop.interface enable-animations", verbose);
    const animationsDisabled = animationsResult.success && animationsResult.output.includes("false");

    // Check top bar dark theme
    const themeResult = await executeCommand("gsettings get org.gnome.desktop.interface gtk-theme", verbose);
    const darkTheme = themeResult.success && themeResult.output.includes("dark");

    // Check weekday is hidden
    const weekdayResult = await executeCommand("gsettings get org.gnome.desktop.interface clock-show-weekday", verbose);
    const weekdayHidden = weekdayResult.success && weekdayResult.output.includes("false");

    // Check seconds are shown
    const secondsResult = await executeCommand("gsettings get org.gnome.desktop.interface clock-show-seconds", verbose);
    const secondsShown = secondsResult.success && secondsResult.output.includes("true");

    if (iconsHidden && hotCornersEnabled && animationsDisabled && darkTheme && weekdayHidden && secondsShown) {
      return {
        name: "GNOME Desktop Config",
        success: true,
        message: "GNOME desktop configured with top bar styling",
        details: "Desktop icons hidden, hot corners enabled, animations disabled, dark theme applied, weekday hidden, seconds shown",
      };
    } else {
      return {
        name: "GNOME Desktop Config",
        success: false,
        message: "Some GNOME settings not applied",
        details: `Icons hidden: ${iconsHidden}, Hot corners: ${hotCornersEnabled}, Animations disabled: ${animationsDisabled}, Dark theme: ${darkTheme}, Weekday hidden: ${weekdayHidden}, Seconds shown: ${secondsShown}`,
      };
    }
  } catch (err) {
    return {
      name: "GNOME Desktop Config",
      success: false,
      message: "Failed to verify GNOME configuration",
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Verify Blur My Shell GNOME extension is installed and enabled
 */
async function verifyBlurMyShell(verbose: boolean = false): Promise<{ name: string; success: boolean; message: string; details?: string }> {
  try {
    const listResult = await executeCommand("gnome-extensions list --enabled | grep -q blur-my-shell", verbose);
    if (listResult.success) {
      return {
        name: "Blur My Shell",
        success: true,
        message: "Blur My Shell extension is enabled",
        details: "GNOME Shell extension active",
      };
    } else {
      return {
        name: "Blur My Shell",
        success: false,
        message: "Blur My Shell extension is not enabled",
        details: "Install from extensions.gnome.org or via gnome-extensions CLI",
      };
    }
  } catch (err) {
    return {
      name: "Blur My Shell",
      success: false,
      message: "Failed to verify Blur My Shell extension",
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Generate verification report
 */
export async function generateVerificationReport(verbose: boolean = false): Promise<string> {
  const verification = await verifySystem(verbose);

  let report = "╔════════════════════════════════════════════════════════════╗\n";
  report += "║                    SYSTEM VERIFICATION REPORT               ║\n";
  report += "╚════════════════════════════════════════════════════════════╝\n\n";

  for (const check of verification.checks) {
    const status = check.success ? "✅" : "❌";
    report += `${status} ${check.name}\n`;
    report += `   ${check.message}\n`;
    if (check.details) {
      report += `   📋 ${check.details}\n`;
    }
    report += "\n";
  }

  const successCount = verification.checks.filter(c => c.success).length;
  const totalCount = verification.checks.length;

  report += "╔════════════════════════════════════════════════════════════╗\n";
  report += `║ SUMMARY: ${successCount}/${totalCount} checks passed                    ║\n`;
  report += "╚════════════════════════════════════════════════════════════╝\n";

  return report;
}
