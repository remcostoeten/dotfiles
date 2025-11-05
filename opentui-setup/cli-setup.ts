#!/usr/bin/env bun
/**
 * CLI Setup - bypasses OpenTUI React issues
 */

import { categories, getEssentialPackages } from "./src/packages";
import { updateApt, upgradeApt, executeCommand } from "./src/executor";
import { configureSudoNoPassword, configureGnomeDesktop, setBraveAsDefaultBrowser, setWallpaper, dockerPostInstall } from "./src/system-config";
import { makeScriptsExecutable, verifyScriptsExecutable } from "./src/scripts-executable";
import { installNerdFonts } from "./src/nerd-fonts";
import { applyDotfilesConfig } from "./src/dotfiles-config";
import { installGhExtensions } from "./src/gh-extensions";

const verbose = process.argv.includes("--verbose");
const dryRun = process.argv.includes("--dry-run");

console.log("🚀 Starting OpenTUI Setup (CLI Mode)");
console.log(`Dry run: ${dryRun}, Verbose: ${verbose}\n`);

// Preflight checks
if (!dryRun) {
  console.log("▶ Preflight checks...");
  await executeCommand("sudo -v || true", verbose);
  const net = await executeCommand("ping -c 1 -W 2 github.com >/dev/null 2>&1");
  if (!net.success) {
    console.log("⚠ Network check to github.com failed; continuing, expect download errors.");
  } else {
    console.log("✓ Network reachable");
  }
}

// System update
if (!dryRun) {
  console.log("\n▶ Updating system packages...");
  const updateResult = await updateApt(verbose);
  if (updateResult.success) {
    console.log("✓ apt update completed");
  } else {
    console.log("✗ Failed to update system packages");
  }

  const upgradeResult = await upgradeApt(verbose);
  if (upgradeResult.success) {
    console.log("✓ apt upgrade completed");
  } else {
    console.log("⚠ apt upgrade failed or skipped");
  }
}

// Install essential packages
const essentialPackages = getEssentialPackages();

for (const category of categories) {
  if (!essentialPackages.some(pkg => category.packages.some(cp => cp.id === pkg.id))) {
    continue; // Skip categories not in essential packages
  }
  console.log(`\n▶ Installing ${category.name}...`);

  for (const pkg of category.packages) {
    const { name, displayName, method, extra, flags } = pkg;

    // Check if already installed
    let checkResult;
    switch (method) {
      case "apt":
        checkResult = await executeCommand(`dpkg -l | grep -q "^ii  ${name} "`, false);
        break;
      case "snap":
        checkResult = await executeCommand(`snap list | grep -q "^${name} "`, false);
        break;
      case "npm":
        checkResult = await executeCommand(`npm list -g ${name} 2>/dev/null | grep -q "${name}"`, false);
        break;
      case "github":
        checkResult = await executeCommand(`test -d ${name}`, false);
        break;
      case "curl":
        // For curl tools, check if the command exists
        checkResult = await executeCommand(`command -v ${name}`, false);
        break;
      default:
        checkResult = { success: false };
    }

    if (checkResult.success) {
      console.log(`  ✓ ${displayName} already installed (skipped)`);
      continue;
    }

    if (dryRun) {
      console.log(`  ✓ [DRY RUN] Would install ${displayName}`);
      continue;
    }

    console.log(`  ▶ Installing ${displayName}...`);

    let result;

    switch (method) {
      case "apt":
        result = await executeCommand(`sudo apt install -y ${name}`, verbose);
        break;
      case "snap":
        const snapFlags = flags || "";
        result = await executeCommand(`sudo snap install ${snapFlags} ${name}`, verbose);
        break;
      case "github":
        result = await executeCommand(`gh repo clone ${extra} ${name}`, verbose);
        break;
      case "curl":
        result = await executeCommand(`curl -fsSL ${extra} | bash`, verbose);
        break;
      case "npm":
        result = await executeCommand(`npm install -g ${name}`, verbose);
        break;
      default:
        result = { success: false, output: "", error: `Unsupported method: ${method}` };
    }

    if (result.success) {
      console.log(`  ✓ ${displayName} installed`);
    } else {
      console.log(`  ✗ Failed to install ${displayName}: ${result.error}`);
    }
  }
}

// System configurations
console.log("\n▶ Configuring system...");

if (dryRun) {
  console.log("  ✓ [DRY RUN] Would install Nerd Fonts");
  console.log("  ✓ [DRY RUN] Would make scripts executable");
  console.log("  ✓ [DRY RUN] Would apply dotfiles configurations (kitty, fish, git, etc.)");
  console.log("  ✓ [DRY RUN] Would install GitHub CLI extensions (gh-select, etc.)");
  console.log("  ✓ [DRY RUN] Would set Brave as default browser");
  console.log("  ✓ [DRY RUN] Would set wallpaper");
  console.log("  ✓ [DRY RUN] Would configure GNOME desktop");
  console.log("  ✓ [DRY RUN] Would configure sudo NOPASSWD");
  console.log("  ✓ [DRY RUN] Would configure Docker post-install (if needed)");
} else {
  // Install Nerd Fonts
  console.log("  ▶ Installing Nerd Fonts...");
  const fontsResult = await installNerdFonts();
  if (fontsResult.success) {
    console.log(`    ✓ ${fontsResult.message}`);
  } else {
    console.log(`    ✗ ${fontsResult.message}`);
  }

  // Scripts executable
  console.log("  ▶ Making scripts executable...");
  const execResult = await makeScriptsExecutable(verbose);
  execResult.steps.forEach((step) => {
    const icon = step.success ? "✓" : "✗";
    console.log(`    ${icon} ${step.name}: ${step.message}`);
  });

  // Apply dotfiles configurations
  console.log("  ▶ Applying dotfiles configurations...");
  const dotfilesResult = await applyDotfilesConfig(verbose);
  dotfilesResult.steps.forEach((step) => {
    const icon = step.success ? "✓" : "✗";
    console.log(`    ${icon} ${step.name}: ${step.message}`);
  });

  // Install GitHub CLI extensions
  console.log("  ▶ Installing GitHub CLI extensions...");
  const ghExtResult = await installGhExtensions(verbose);
  ghExtResult.steps.forEach((step) => {
    const icon = step.success ? "✓" : "✗";
    console.log(`    ${icon} ${step.name}: ${step.message}`);
  });

  // Brave as default browser
  console.log("  ▶ Setting Brave as default browser...");
  const braveResult = await setBraveAsDefaultBrowser(verbose);
  braveResult.steps.forEach((step) => {
    const icon = step.success ? "✓" : "✗";
    console.log(`    ${icon} ${step.name}: ${step.message}`);
  });

  // Wallpaper
  console.log("  ▶ Setting wallpaper...");
  const wallpaperResult = await setWallpaper(verbose);
  wallpaperResult.steps.forEach((step) => {
    const icon = step.success ? "✓" : "✗";
    console.log(`    ${icon} ${step.name}: ${step.message}`);
  });

  // GNOME desktop
  console.log("  ▶ Configuring GNOME desktop...");
  const gnomeResult = await configureGnomeDesktop(verbose);
  gnomeResult.steps.forEach((step) => {
    const icon = step.success ? "✓" : "✗";
    console.log(`    ${icon} ${step.name}: ${step.message}`);
  });

  // Sudo NOPASSWD
  console.log("  ▶ Configuring sudo passwordless access...");
  const sudoResult = await configureSudoNoPassword(verbose);
  sudoResult.steps.forEach((step) => {
    const icon = step.success ? "✓" : "✗";
    console.log(`    ${icon} ${step.name}: ${step.message}`);
  });

  // Docker post-install
  const dockerPkg = categories.flatMap(c => c.packages).find(p => p.id === "docker.io");
  if (dockerPkg) {
    console.log("  ▶ Configuring Docker post-install...");
    const dockerResult = await dockerPostInstall(verbose);
    dockerResult.steps.forEach((step) => {
      const icon = step.success ? "✓" : "✗";
      console.log(`    ${icon} ${step.name}: ${step.message}`);
    });
  }
}

console.log("\n✅ Setup complete!");
console.log("You may need to re-login for some changes to take effect (Docker group, sudo NOPASSWD).");
