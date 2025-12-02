#!/usr/bin/env bun
/**
 * Interactive Setup Tool - Check installed tools and install them
 */

import { categories } from "./src/packages";
import { executeCommand, updateApt, upgradeApt } from "./src/executor";
import { configureSudoNoPassword, configureGnomeDesktop, setBraveAsDefaultBrowser, setWallpaper, dockerPostInstall } from "./src/system-config";
import { makeScriptsExecutable } from "./src/scripts-executable";
import { installNerdFonts } from "./src/nerd-fonts";
import { applyDotfilesConfig } from "./src/dotfiles-config";
import { installGhExtensions } from "./src/gh-extensions";
import { runPreflight } from "./src/preflight";

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function clearScreen() {
  console.clear();
}

function printHeader() {
  console.log(`${colors.cyan}${colors.bright}
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║    🚀 Development Tools Setup                               ║
║                                                              ║
║    Check installed tools and install missing ones          ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
${colors.reset}`);
}

function printMainMenu() {
  console.log(`${colors.yellow}${colors.bright}┌─ Main Menu:${colors.reset}`);
  console.log(`${colors.yellow}│${colors.reset}`);
  console.log(`${colors.yellow}│${colors.reset} ${colors.cyan}1.${colors.reset} ${colors.white}🔍 Check Installation${colors.reset} ${colors.dim}- Show what tools are installed${colors.reset}`);
  console.log(`${colors.yellow}│${colors.reset} ${colors.cyan}2.${colors.reset} ${colors.white}📦 Install Tools${colors.reset} ${colors.dim}- Select categories and install${colors.reset}`);
  console.log(`${colors.yellow}│${colors.reset} ${colors.cyan}3.${colors.reset} ${colors.white}⚙️  Toggle Dry Run${colors.reset} ${colors.dim}- ${dryRunMode ? `${colors.green}ON${colors.reset}` : `${colors.red}OFF${colors.reset}`}${colors.reset}`);
  console.log(`${colors.yellow}│${colors.reset} ${colors.cyan}4.${colors.reset} ${colors.white}❌ Exit${colors.reset} ${colors.dim}- Quit the setup tool${colors.reset}`);
  console.log(`${colors.yellow}│${colors.reset}`);
  console.log(`${colors.yellow}└─ Enter your choice (1-4):${colors.reset} `);
}

let selectedCategories = new Set<string>();
let verboseMode = false;
let dryRunMode = false;

// Check for --dry-run flag from command line
if (process.argv.includes("--dry-run")) {
  dryRunMode = true;
}

async function checkInstallation() {
  console.log(`${colors.yellow}🔍 Checking current installation status...${colors.reset}\n`);

  let totalPackages = 0;
  let installedPackages = 0;

  for (const category of categories) {
    console.log(`${colors.cyan}${category.name}:${colors.reset}`);

    for (const pkg of category.packages) {
      totalPackages++;
      const { name, method } = pkg;

      let checkResult;
      switch (method) {
        case "apt":
          // Some apt packages have different binary names
          let aptCommandName = name;
          if (name === "neovim") aptCommandName = "nvim";
          else if (name === "fd-find") aptCommandName = "fd";
          else if (name === "microsoft-edge-stable") aptCommandName = "microsoft-edge-stable"; // Keep as-is, might need edge check too
          checkResult = await executeCommand(`command -v ${aptCommandName}`, false);
          break;
        case "snap":
          checkResult = await executeCommand(`snap list | grep -q "^${name} "`, false);
          break;
        case "npm":
          // For npm CLI tools, check if the command exists in PATH
          // Some npm packages have different binary names (e.g., gemini-cli -> gemini)
          const commandName = name === "gemini-cli" ? "gemini" : name;
          checkResult = await executeCommand(`command -v ${commandName}`, false);
          break;
        case "github":
          // GitHub releases install binaries, check if command exists
          checkResult = await executeCommand(`command -v ${name}`, false);
          break;
        case "curl":
          checkResult = await executeCommand(`command -v ${name}`, false);
          break;
        default:
          checkResult = { success: false };
      }

      const status = checkResult.success ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
      console.log(`  ${status} ${pkg.displayName}`);

      if (checkResult.success) installedPackages++;
    }
    console.log();
  }

  const percentage = Math.round((installedPackages / totalPackages) * 100);
  console.log(`${colors.yellow}📊 Summary: ${installedPackages}/${totalPackages} packages installed (${percentage}%)${colors.reset}`);

  return { totalPackages, installedPackages, percentage };
}

async function selectCategories() {
  console.log(`${colors.magenta}📋 Select Categories to Install${colors.reset}\n`);

  for (const category of categories) {
    const isSelected = selectedCategories.has(category.id);
    const status = isSelected ? `${colors.green}[SELECTED]${colors.reset}` : `${colors.dim}[not selected]${colors.reset}`;
    console.log(`${colors.cyan}${category.id}. ${category.name} ${status}${colors.reset}`);
    console.log(`${colors.dim}   ${category.description}${colors.reset}\n`);
  }

  console.log(`${colors.yellow}Enter category numbers to toggle (comma-separated), or 'all'/'none':${colors.reset} `);

  const input = await new Promise<string>((resolve) => {
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });

  if (input.toLowerCase() === 'all') {
    categories.forEach(cat => selectedCategories.add(cat.id));
    console.log(`${colors.green}✅ All categories selected${colors.reset}`);
  } else if (input.toLowerCase() === 'none') {
    selectedCategories.clear();
    console.log(`${colors.yellow}⚠ All categories deselected${colors.reset}`);
  } else {
    const numbers = input.split(',').map(n => n.trim());
    numbers.forEach(num => {
      const category = categories.find(cat => cat.id === num);
      if (category) {
        if (selectedCategories.has(category.id)) {
          selectedCategories.delete(category.id);
          console.log(`${colors.yellow}⚠ Deselected: ${category.name}${colors.reset}`);
        } else {
          selectedCategories.add(category.id);
          console.log(`${colors.green}✅ Selected: ${category.name}${colors.reset}`);
        }
      }
    });
  }

  console.log(`${colors.cyan}📊 Currently selected: ${selectedCategories.size} categories${colors.reset}`);
}

async function installTools() {
  console.log(`${colors.green}🚀 Starting Installation...${colors.reset}\n`);

  if (selectedCategories.size === 0) {
    console.log(`${colors.yellow}⚠ No categories selected. Please select categories first.${colors.reset}`);
    return;
  }

  if (dryRunMode) {
    console.log(`${colors.yellow}[DRY RUN MODE] - No actual changes will be made${colors.reset}\n`);
  }

  // Preflight
  if (!dryRunMode) {
    console.log(`${colors.cyan}▶ Preflight checks...${colors.reset}`);
    await executeCommand("sudo -v || true", verboseMode);
    const net = await executeCommand("ping -c 1 -W 2 github.com >/dev/null 2>&1");
    if (net.success) {
      console.log(`${colors.green}✓ Network reachable${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠ Network check failed${colors.reset}`);
    }

    // Run preflight setup (git submodules, SSH keys)
    console.log(`${colors.dim}Running preflight setup...${colors.reset}`);
    const preflightResult = await runPreflight();
    preflightResult.steps.forEach((step) => {
      const icon = step.success ? "✓" : "✗";
      const color = step.success ? colors.green : colors.yellow;
      console.log(`  ${color}${icon} ${step.name}: ${step.message}${colors.reset}`);
    });
  }

  // System update
  if (!dryRunMode) {
    console.log(`\n${colors.cyan}▶ Updating system packages...${colors.reset}`);
    const updateResult = await updateApt(verboseMode);
    if (updateResult.success) {
      console.log(`${colors.green}✓ apt update completed${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Failed to update system packages${colors.reset}`);
    }

    const upgradeResult = await upgradeApt(verboseMode);
    if (upgradeResult.success) {
      console.log(`${colors.green}✓ apt upgrade completed${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠ apt upgrade failed or skipped${colors.reset}`);
    }
  }

  // Install packages
  for (const category of categories) {
    if (!selectedCategories.has(category.id)) continue;

    console.log(`\n${colors.cyan}▶ Installing ${category.name}...${colors.reset}`);

    for (const pkg of category.packages) {
      if (dryRunMode) {
        console.log(`  ${colors.yellow}[DRY RUN] Would install ${pkg.displayName}${colors.reset}`);
        continue;
      }

      // Check if already installed
      const { name, method, extra, flags } = pkg;
      let checkResult;
      switch (method) {
        case "apt":
          // Some apt packages have different binary names
          let aptCommandName = name;
          if (name === "neovim") aptCommandName = "nvim";
          else if (name === "fd-find") aptCommandName = "fd";
          else if (name === "microsoft-edge-stable") aptCommandName = "microsoft-edge-stable"; // Keep as-is, might need edge check too
          checkResult = await executeCommand(`command -v ${aptCommandName}`, false);
          break;
        case "snap":
          checkResult = await executeCommand(`snap list | grep -q "^${name} "`, false);
          break;
        case "npm":
          // For npm CLI tools, check if the command exists in PATH
          // Some npm packages have different binary names (e.g., gemini-cli -> gemini)
          const commandName = name === "gemini-cli" ? "gemini" : name;
          checkResult = await executeCommand(`command -v ${commandName}`, false);
          break;
        case "github":
          // GitHub releases install binaries, check if command exists
          checkResult = await executeCommand(`command -v ${name}`, false);
          break;
        case "curl":
          checkResult = await executeCommand(`command -v ${name}`, false);
          break;
        case "script":
          // For script-based packages, check if the script file exists
          const scriptPath = extra && (extra.startsWith('/') ? extra : `${process.cwd()}/${extra}`);
          checkResult = scriptPath ? await executeCommand(`test -f "${scriptPath}"`, false) : { success: false };
          break;
        case "legacy":
          // For legacy packages, always assume not installed (user will trigger manually)
          checkResult = { success: false };
          break;
        default:
          checkResult = { success: false };
      }

      if (checkResult.success) {
        console.log(`  ${colors.green}✓ ${pkg.displayName} already installed${colors.reset}`);
        continue;
      }

      console.log(`  ${colors.dim}Installing ${pkg.displayName}...${colors.reset}`);

      let result;
      switch (method) {
        case "apt":
          result = await executeCommand(`sudo apt install -y ${name}`, verboseMode);
          break;
        case "snap":
          const snapFlags = flags || "";
          result = await executeCommand(`sudo snap install ${snapFlags} ${name}`, verboseMode);
          break;
        case "github":
          // Handle GitHub releases (for packages like lazygit, lazydocker, wezterm)
          // Download the latest release binary from GitHub releases
          const repoUrl = `https://api.github.com/repos/${extra}/releases/latest`;
          const tagResult = await executeCommand(`curl -s "${repoUrl}" | grep -o '"tag_name": "[^"]*' | cut -d'"' -f4`, verboseMode);
          if (!tagResult.success || !tagResult.output.trim()) {
            result = { success: false, output: "", error: `Failed to get latest release tag for ${extra}` };
            break;
          }
          const tag = tagResult.output.trim();
          const version = tag.replace(/^v/, ''); // Remove 'v' prefix if present
          // Download and install binary (format: name_version_linux_x86_64.tar.gz)
          const downloadUrl = `https://github.com/${extra}/releases/download/${tag}/${name}_${version}_linux_x86_64.tar.gz`;
          const installCmd = `wget -qO- "${downloadUrl}" | tar -xz -C /tmp && sudo mv /tmp/${name} /usr/local/bin/${name} && chmod +x /usr/local/bin/${name}`;
          result = await executeCommand(installCmd, verboseMode);
          break;
        case "curl":
          result = await executeCommand(`curl -fsSL ${extra} | bash`, verboseMode);
          break;
        case "npm":
          result = await executeCommand(`npm install -g ${name}`, verboseMode);
          break;
        case "script":
          // Execute local script files (for specialized setups)
          if (verboseMode) {
            console.log(`🔧 Executing local script: ${extra}`);
          }
          const scriptPath = extra.startsWith('/') ? extra : `${process.cwd()}/${extra}`;
          result = await executeCommand(`bash "${scriptPath}"`, verboseMode);
          break;
        default:
          result = { success: false, output: "", error: `Unsupported method: ${method}` };
      }

      if (result.success) {
        console.log(`  ${colors.green}✓ ${pkg.displayName} installed${colors.reset}`);
      } else {
        console.log(`  ${colors.red}✗ Failed to install ${pkg.displayName}${colors.reset}`);
      }
    }
  }

  // System configurations
  if (!dryRunMode) {
    console.log(`\n${colors.cyan}▶ Configuring system...${colors.reset}`);

    // Install Nerd Fonts
    console.log(`${colors.dim}Installing Nerd Fonts...${colors.reset}`);
    const fontsResult = await installNerdFonts();
    if (fontsResult.success) {
      console.log(`${colors.green}✓ ${fontsResult.message}${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ ${fontsResult.message}${colors.reset}`);
    }

    // Scripts executable
    console.log(`${colors.dim}Making scripts executable...${colors.reset}`);
    const execResult = await makeScriptsExecutable(verboseMode);
    execResult.steps.forEach((step) => {
      const icon = step.success ? "✓" : "✗";
      const color = step.success ? colors.green : colors.red;
      console.log(`  ${color}${icon} ${step.name}: ${step.message}${colors.reset}`);
    });

    // Apply dotfiles configurations
    console.log(`${colors.dim}Applying dotfiles configurations...${colors.reset}`);
    const dotfilesResult = await applyDotfilesConfig(verboseMode);
    dotfilesResult.steps.forEach((step) => {
      const icon = step.success ? "✓" : "✗";
      const color = step.success ? colors.green : colors.red;
      console.log(`  ${color}${icon} ${step.name}: ${step.message}${colors.reset}`);
    });

    // Install GitHub CLI extensions
    console.log(`${colors.dim}Installing GitHub CLI extensions...${colors.reset}`);
    const ghExtResult = await installGhExtensions(verboseMode);
    ghExtResult.steps.forEach((step) => {
      const icon = step.success ? "✓" : "✗";
      const color = step.success ? colors.green : colors.red;
      console.log(`  ${color}${icon} ${step.name}: ${step.message}${colors.reset}`);
    });

    // Brave as default browser
    console.log(`${colors.dim}Setting Brave as default browser...${colors.reset}`);
    const braveResult = await setBraveAsDefaultBrowser(verboseMode);
    braveResult.steps.forEach((step) => {
      const icon = step.success ? "✓" : "✗";
      const color = step.success ? colors.green : colors.red;
      console.log(`  ${color}${icon} ${step.name}: ${step.message}${colors.reset}`);
    });

    // Wallpaper
    console.log(`${colors.dim}Setting wallpaper...${colors.reset}`);
    const wallpaperResult = await setWallpaper(verboseMode);
    wallpaperResult.steps.forEach((step) => {
      const icon = step.success ? "✓" : "✗";
      const color = step.success ? colors.green : colors.red;
      console.log(`  ${color}${icon} ${step.name}: ${step.message}${colors.reset}`);
    });

    // GNOME desktop
    console.log(`${colors.dim}Configuring GNOME desktop...${colors.reset}`);
    const gnomeResult = await configureGnomeDesktop(verboseMode);
    gnomeResult.steps.forEach((step) => {
      const icon = step.success ? "✓" : "✗";
      const color = step.success ? colors.green : colors.red;
      console.log(`  ${color}${icon} ${step.name}: ${step.message}${colors.reset}`);
    });

    // Sudo NOPASSWD
    console.log(`${colors.dim}Configuring sudo passwordless access...${colors.reset}`);
    const sudoResult = await configureSudoNoPassword(verboseMode);
    sudoResult.steps.forEach((step) => {
      const icon = step.success ? "✓" : "✗";
      const color = step.success ? colors.green : colors.red;
      console.log(`  ${color}${icon} ${step.name}: ${step.message}${colors.reset}`);
    });

    // Docker post-install
    const dockerPkg = categories.flatMap(c => c.packages).find(p => p.id === "docker.io");
    if (dockerPkg) {
      console.log(`${colors.dim}Configuring Docker post-install...${colors.reset}`);
      const dockerResult = await dockerPostInstall(verboseMode);
      dockerResult.steps.forEach((step) => {
        const icon = step.success ? "✓" : "✗";
        const color = step.success ? colors.green : colors.red;
        console.log(`  ${color}${icon} ${step.name}: ${step.message}${colors.reset}`);
      });
    }
  }

  console.log(`\n${colors.green}✅ Installation complete!${colors.reset}`);
}

async function toggleDryRun() {
  dryRunMode = !dryRunMode;
  console.log(`${colors.green}✅ Dry run mode ${dryRunMode ? 'enabled' : 'disabled'}${colors.reset}`);
  if (dryRunMode) {
    console.log(`${colors.yellow}⚠ No actual changes will be made when installing${colors.reset}`);
  }
}


async function main() {
  if (!process.stdin.isTTY) {
    console.log(`${colors.yellow}ℹ Non-interactive terminal detected.${colors.reset}`);
    console.log(`${colors.dim}Running installation check once and exiting...${colors.reset}`);
    await checkInstallation();
    return;
  }

  while (true) {
    clearScreen();
    printHeader();
    printMainMenu();

    const choice = await new Promise<string>((resolve) => {
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim());
      });
    });

    clearScreen();
    printHeader();

    switch (choice) {
      case '1': // Check Installation
        await checkInstallation();
        break;
      case '2': // Install Tools
        // First show selection menu
        await selectCategories();
        console.log(`\n${colors.yellow}Press Enter to continue to installation...${colors.reset}`);
        await new Promise<void>((resolve) => {
          process.stdin.once('data', () => resolve());
        });
        clearScreen();
        printHeader();
        await installTools();
        break;
      case '3': // Toggle Dry Run
        await toggleDryRun();
        break;
      case '4': // Exit
        console.log(`${colors.green}👋 Goodbye!${colors.reset}`);
        process.exit(0);
      default:
        console.log(`${colors.red}❌ Invalid choice. Please enter 1-4.${colors.reset}`);
    }

    console.log(`\n${colors.yellow}Press Enter to continue...${colors.reset}`);
    await new Promise<void>((resolve) => {
      process.stdin.once('data', () => resolve());
    });
  }
}

main().catch(console.error);
