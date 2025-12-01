/**
 * System configuration utilities
 * - Set default browser to Brave
 * - Set wallpaper from dotfiles/assets/wallpaper.png
 * - Docker post-install steps (group, daemon enable)
 */

import { executeCommand } from "./executor";

export interface SystemConfigResult {
  success: boolean;
  steps: Array<{ name: string; success: boolean; message: string }>;
}

/**
 * Set Brave as the default browser using xdg-settings
 */
export async function setBraveAsDefaultBrowser(verbose: boolean = false): Promise<SystemConfigResult> {
  const steps: Array<{ name: string; success: boolean; message: string }> = [];

  try {
    // Check if Brave is installed
    const braveCheck = await executeCommand("command -v brave-browser");
    if (!braveCheck.success) {
      steps.push({ name: "Check Brave", success: false, message: "Brave browser not installed" });
      return { success: false, steps };
    }
    steps.push({ name: "Check Brave", success: true, message: "Brave browser found" });

    // Set as default for http and https
    for (const scheme of ["http", "https"]) {
      const setResult = await executeCommand(`xdg-settings set default-web-browser brave-browser.desktop`, verbose);
      if (setResult.success) {
        steps.push({ name: `Set default for ${scheme}`, success: true, message: `Default browser set for ${scheme}` });
      } else {
        steps.push({ name: `Set default for ${scheme}`, success: false, message: setResult.error || "Failed to set default" });
      }
    }

    // Verify default browser
    const defaultCheck = await executeCommand("xdg-settings get default-web-browser", verbose);
    if (defaultCheck.success && defaultCheck.output.includes("brave")) {
      steps.push({ name: "Verify default", success: true, message: `Default browser: ${defaultCheck.output.trim()}` });
    } else {
      steps.push({ name: "Verify default", success: false, message: "Verification failed" });
    }

    return { success: steps.every((s) => s.success), steps };
  } catch (err) {
    steps.push({ name: "Set Brave default", success: false, message: err instanceof Error ? err.message : String(err) });
    return { success: false, steps };
  }
}

/**
 * Set wallpaper from dotfiles/assets/wallpaper.png using gsettings for GNOME
 */
export async function setWallpaper(verbose: boolean = false): Promise<SystemConfigResult> {
  const steps: Array<{ name: string; success: boolean; message: string }> = [];

  try {
    const wallpaperPath = `${process.env.HOME}/.config/dotfiles/setup/assets/wallpaper.png`;

    // Check if wallpaper file exists
    const fileCheck = await executeCommand(`test -f "${wallpaperPath}"`);
    if (!fileCheck.success) {
      steps.push({ name: "Check wallpaper file", success: false, message: `Wallpaper not found at ${wallpaperPath}` });
      return { success: false, steps };
    }
    steps.push({ name: "Check wallpaper file", success: true, message: "Wallpaper file found" });

    // Detect desktop environment
    const desktopCheck = await executeCommand("echo $XDG_CURRENT_DESKTOP");
    const desktop = desktopCheck.success ? desktopCheck.output.trim().toLowerCase() : "";

    if (desktop.includes("gnome") || desktop.includes("ubuntu")) {
      const setResult = await executeCommand(`gsettings set org.gnome.desktop.background picture-uri "file://${wallpaperPath}"`, verbose);
      if (setResult.success) {
        steps.push({ name: "Set GNOME wallpaper", success: true, message: "Wallpaper set via gsettings" });
      } else {
        steps.push({ name: "Set GNOME wallpaper", success: false, message: setResult.error || "Failed to set wallpaper" });
      }
    } else if (desktop.includes("kde")) {
      // KDE Plasma wallpaper setting (more complex)
      steps.push({ name: "Set KDE wallpaper", success: false, message: "KDE wallpaper setting not implemented" });
    } else {
      steps.push({ name: "Detect desktop", success: false, message: `Unsupported desktop: ${desktop}` });
    }

    return { success: steps.every((s) => s.success), steps };
  } catch (err) {
    steps.push({ name: "Set wallpaper", success: false, message: err instanceof Error ? err.message : String(err) });
    return { success: false, steps };
  }
}

/**
 * Docker post-install configuration:
 * - Add user to docker group
 * - Enable and start docker service
 * - Verify docker daemon
 */
export async function dockerPostInstall(verbose: boolean = false): Promise<SystemConfigResult> {
  const steps: Array<{ name: string; success: boolean; message: string }> = [];

  try {
    // Check if docker is installed
    const dockerCheck = await executeCommand("command -v docker");
    if (!dockerCheck.success) {
      steps.push({ name: "Check Docker", success: false, message: "Docker not installed" });
      return { success: false, steps };
    }
    steps.push({ name: "Check Docker", success: true, message: "Docker found" });

    // Add user to docker group
    const user = process.env.USER || "user";
    const groupResult = await executeCommand(`sudo usermod -aG docker "${user}"`, verbose);
    if (groupResult.success) {
      steps.push({ name: "Add to docker group", success: true, message: `User ${user} added to docker group` });
    } else {
      steps.push({ name: "Add to docker group", success: false, message: groupResult.error || "Failed to add to group" });
    }

    // Enable and start docker service (systemd)
    const enableResult = await executeCommand("sudo systemctl enable docker", verbose);
    if (enableResult.success) {
      steps.push({ name: "Enable Docker service", success: true, message: "Docker service enabled" });
    } else {
      steps.push({ name: "Enable Docker service", success: false, message: enableResult.error || "Failed to enable service" });
    }

    const startResult = await executeCommand("sudo systemctl start docker", verbose);
    if (startResult.success) {
      steps.push({ name: "Start Docker service", success: true, message: "Docker service started" });
    } else {
      steps.push({ name: "Start Docker service", success: false, message: startResult.error || "Failed to start service" });
    }

    // Verify docker daemon
    const verifyResult = await executeCommand("docker info", verbose);
    if (verifyResult.success) {
      steps.push({ name: "Verify Docker daemon", success: true, message: "Docker daemon running" });
    } else {
      steps.push({ name: "Verify Docker daemon", success: false, message: "Docker daemon not responding" });
    }

    // Optional: run hello-world to test
    if (verifyResult.success) {
      const helloResult = await executeCommand("docker run --rm hello-world", verbose);
      if (helloResult.success) {
        steps.push({ name: "Test Docker (hello-world)", success: true, message: "Docker test passed" });
      } else {
        steps.push({ name: "Test Docker (hello-world)", success: false, message: "Docker test failed" });
      }
    }

    return { success: steps.every((s) => s.success), steps };
  } catch (err) {
    steps.push({ name: "Docker post-install", success: false, message: err instanceof Error ? err.message : String(err) });
    return { success: false, steps };
  }
}

/**
 * Configure sudo to never ask for password for current user
 */
export async function configureSudoNoPassword(verbose: boolean = false): Promise<SystemConfigResult> {
  const steps: Array<{ name: string; success: boolean; message: string }> = [];

  try {
    const user = process.env.USER || "user";
    const sudoersLine = `${user} ALL=(ALL) NOPASSWD: ALL`;
    const sudoersFile = `/etc/sudoers.d/99-${user}-nopasswd`;

    // Check if rule already exists
    const checkResult = await executeCommand(`sudo grep -q "${sudoersLine}" /etc/sudoers /etc/sudoers.d/* 2>/dev/null`, verbose);
    if (checkResult.success) {
      steps.push({ name: "Check sudoers", success: true, message: "NOPASSWD rule already exists" });
      return { success: true, steps };
    }

    // Create sudoers file
    const createResult = await executeCommand(`echo "${sudoersLine}" | sudo tee "${sudoersFile}" >/dev/null`, verbose);
    if (createResult.success) {
      steps.push({ name: "Create sudoers file", success: true, message: `NOPASSWD rule added for ${user}` });
    } else {
      steps.push({ name: "Create sudoers file", success: false, message: createResult.error || "Failed to create sudoers file" });
      return { success: false, steps };
    }

    // Verify syntax
    const verifyResult = await executeCommand(`sudo visudo -cf "${sudoersFile}"`, verbose);
    if (verifyResult.success) {
      steps.push({ name: "Verify sudoers syntax", success: true, message: "Sudoers syntax valid" });
    } else {
      steps.push({ name: "Verify sudoers syntax", success: false, message: "Sudoers syntax error" });
      // Remove invalid file
      await executeCommand(`sudo rm -f "${sudoersFile}"`);
      return { success: false, steps };
    }

    return { success: true, steps };
  } catch (err) {
    steps.push({ name: "Configure sudo NOPASSWD", success: false, message: err instanceof Error ? err.message : String(err) });
    return { success: false, steps };
  }
}

/**
 * Configure GNOME desktop: hide desktop icons, hide dock, enable top-left hot corner
 */
export async function configureGnomeDesktop(verbose: boolean = false): Promise<SystemConfigResult> {
  const steps: Array<{ name: string; success: boolean; message: string }> = [];

  try {
    // Hide desktop icons
    const desktopIconsResult = await executeCommand("gsettings set org.gnome.desktop.background show-desktop-icons false", verbose);
    if (desktopIconsResult.success) {
      steps.push({ name: "Hide desktop icons", success: true, message: "Desktop icons hidden" });
    } else {
      steps.push({ name: "Hide desktop icons", success: false, message: desktopIconsResult.error || "Failed to hide desktop icons" });
    }

    // Hide dock (Dash to Dock) if installed
    const dockHideResult = await executeCommand("gsettings set org.gnome.shell.extensions.dash-to-dock dock-position 'LEFT' && gsettings set org.gnome.shell.extensions.dash-to-dock autohide true", verbose);
    if (dockHideResult.success) {
      steps.push({ name: "Hide dock", success: true, message: "Dock set to autohide" });
    } else {
      steps.push({ name: "Hide dock", success: false, message: "Dash to Dock extension not found or failed" });
    }

    // Enable hot corner (top-left) - this is usually enabled by default in GNOME
    const hotCornerResult = await executeCommand("gsettings set org.gnome.desktop.interface enable-hot-corners true", verbose);
    if (hotCornerResult.success) {
      steps.push({ name: "Enable hot corner", success: true, message: "Top-left hot corner enabled" });
    } else {
      steps.push({ name: "Enable hot corner", success: false, message: hotCornerResult.error || "Failed to enable hot corner" });
    }

    // Additional: disable workspace switch animation for faster feel
    const animationResult = await executeCommand("gsettings set org.gnome.desktop.interface enable-animations false", verbose);
    if (animationResult.success) {
      steps.push({ name: "Disable animations", success: true, message: "Animations disabled" });
    } else {
      steps.push({ name: "Disable animations", success: false, message: animationResult.error || "Failed to disable animations" });
    }

    // Configure top bar styling
    const topBarStyleResult = await executeCommand("gsettings set org.gnome.desktop.interface gtk-theme 'Adwaita-dark' && gsettings set org.gnome.shell.extensions.user-theme name 'Adwaita-dark'", verbose);
    if (topBarStyleResult.success) {
      steps.push({ name: "Top bar dark theme", success: true, message: "Top bar dark theme applied" });
    } else {
      steps.push({ name: "Top bar dark theme", success: false, message: "Failed to apply top bar theme" });
    }

    // Hide weekday from top bar
    const weekdayResult = await executeCommand("gsettings set org.gnome.desktop.interface clock-show-weekday false", verbose);
    if (weekdayResult.success) {
      steps.push({ name: "Hide weekday", success: true, message: "Weekday hidden from top bar" });
    } else {
      steps.push({ name: "Hide weekday", success: false, message: weekdayResult.error || "Failed to hide weekday" });
    }

    // Show seconds in clock
    const secondsResult = await executeCommand("gsettings set org.gnome.desktop.interface clock-show-seconds true", verbose);
    if (secondsResult.success) {
      steps.push({ name: "Show seconds", success: true, message: "Seconds shown in clock" });
    } else {
      steps.push({ name: "Show seconds", success: false, message: secondsResult.error || "Failed to show seconds" });
    }

    // Reduce top bar opacity/transparency for cleaner look
    const opacityResult = await executeCommand("gsettings set org.gnome.shell.extensions.dash-to-panel panel-opacity 0.8", verbose);
    if (opacityResult.success) {
      steps.push({ name: "Top bar opacity", success: true, message: "Top bar opacity adjusted" });
    } else {
      steps.push({ name: "Top bar opacity", success: false, message: "Dash to Panel extension not found" });
    }

    return { success: steps.filter(s => !s.success).length === 0, steps };
  } catch (err) {
    steps.push({ name: "Configure GNOME desktop", success: false, message: err instanceof Error ? err.message : String(err) });
    return { success: false, steps };
  }
}

/**
 * Install Blur My Shell GNOME extension
 */
export async function installBlurMyShell(verbose: boolean = false): Promise<SystemConfigResult> {
  const steps: Array<{ name: string; success: boolean; message: string }> = [];

  try {
    // Check if gnome-shell is installed
    const shellCheck = await executeCommand("command -v gnome-shell");
    if (!shellCheck.success) {
      steps.push({ name: "Check GNOME Shell", success: false, message: "GNOME Shell not found" });
      return { success: false, steps };
    }
    steps.push({ name: "Check GNOME Shell", success: true, message: "GNOME Shell found" });

    // Install extension via gnome-extensions CLI if available
    const extInstall = await executeCommand("gnome-extensions install blur-my-shell", verbose);
    if (extInstall.success) {
      steps.push({ name: "Install Blur My Shell", success: true, message: "Blur My Shell installed" });
    } else {
      // Fallback: try installing via zip from GNOME Extensions site
      steps.push({ name: "Install Blur My Shell", success: false, message: "Installation failed; try manual install from extensions.gnome.org" });
    }

    // Enable extension
    if (extInstall.success) {
      const enableResult = await executeCommand("gnome-extensions enable blur-my-shell", verbose);
      if (enableResult.success) {
        steps.push({ name: "Enable Blur My Shell", success: true, message: "Blur My Shell enabled" });
      } else {
        steps.push({ name: "Enable Blur My Shell", success: false, message: "Failed to enable extension" });
      }
    }

    return { success: steps.every((s) => s.success), steps };
  } catch (err) {
    steps.push({ name: "Blur My Shell", success: false, message: err instanceof Error ? err.message : String(err) });
    return { success: false, steps };
  }
}
