#!/usr/bin/env bun
/**
 * Interactive OpenTUI Setup - Beautiful terminal interface
 */

import { categories } from "./src/packages";
import { executeCommand, updateApt, upgradeApt } from "./src/executor";
import { configureSudoNoPassword, configureGnomeDesktop, setBraveAsDefaultBrowser, setWallpaper, dockerPostInstall } from "./src/system-config";
import { makeScriptsExecutable } from "./src/scripts-executable";
import { installNerdFonts } from "./src/nerd-fonts";
import { applyDotfilesConfig } from "./src/dotfiles-config";
import { installGhExtensions } from "./src/gh-extensions";

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
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

function clearScreen() {
  console.clear();
}

function printHeader() {
  console.log(`${colors.cyan}${colors.bright}
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║    🚀 OpenTUI Setup - Interactive Installation Tool        ║
║                                                              ║
║    Complete dotfiles and development environment setup     ║
║    with beautiful terminal interface                        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
${colors.reset}`);
}

function printMainMenu() {
  console.log(`${colors.yellow}${colors.bright}┌─ Main Menu:${colors.reset}`);
  console.log(`${colors.yellow}│${colors.reset}`);
  console.log(`${colors.yellow}│${colors.reset} ${colors.cyan}1.${colors.reset} ${colors.white}📦 Package Management${colors.reset} ${colors.dim}- Install/remove individual packages${colors.reset}`);
  console.log(`${colors.yellow}│${colors.reset} ${colors.cyan}2.${colors.reset} ${colors.white}🔧 System Configuration${colors.reset} ${colors.dim}- Configure GNOME, sudo, wallpaper${colors.reset}`);
  console.log(`${colors.yellow}│${colors.reset} ${colors.cyan}3.${colors.reset} ${colors.white}🚀 Full Setup${colors.reset} ${colors.dim}- Install all selected packages${colors.reset}`);
  console.log(`${colors.yellow}│${colors.reset} ${colors.cyan}4.${colors.reset} ${colors.white}📋 Select Categories${colors.reset} ${colors.dim}- Choose which categories to install${colors.reset}`);
  console.log(`${colors.yellow}│${colors.reset} ${colors.cyan}5.${colors.reset} ${colors.white}🔍 Check Installation${colors.reset} ${colors.dim}- Verify what's currently installed${colors.reset}`);
  console.log(`${colors.yellow}│${colors.reset} ${colors.cyan}6.${colors.reset} ${colors.white}⚙️  Settings${colors.reset} ${colors.dim}- Configure setup options${colors.reset}`);
  console.log(`${colors.yellow}│${colors.reset} ${colors.cyan}7.${colors.reset} ${colors.white}❌ Exit${colors.reset} ${colors.dim}- Quit the setup tool${colors.reset}`);
  console.log(`${colors.yellow}│${colors.reset}`);
  console.log(`${colors.yellow}└─ Enter your choice (1-7):${colors.reset} `);
}

function printPackageMenu() {
  console.log(`${colors.magenta}${colors.bright}
┌─ Package Management:${colors.reset}`);
  console.log(`${colors.magenta}│${colors.reset}`);
  console.log(`${colors.magenta}│${colors.reset} ${colors.cyan}1.${colors.reset} ${colors.white}📦 Install Package${colors.reset} ${colors.dim}- Install a specific package${colors.reset}`);
  console.log(`${colors.magenta}│${colors.reset} ${colors.cyan}2.${colors.reset} ${colors.white}🗑️  Remove Package${colors.reset} ${colors.dim}- Remove a specific package${colors.reset}`);
  console.log(`${colors.magenta}│${colors.reset} ${colors.cyan}3.${colors.reset} ${colors.white}📋 List All Packages${colors.reset} ${colors.dim}- Show available packages${colors.reset}`);
  console.log(`${colors.magenta}│${colors.reset} ${colors.cyan}4.${colors.reset} ${colors.white}🔍 Search Packages${colors.reset} ${colors.dim}- Find packages by name${colors.reset}`);
  console.log(`${colors.magenta}│${colors.reset} ${colors.cyan}5.${colors.reset} ${colors.white}⬅️  Back to Main${colors.reset} ${colors.dim}- Return to main menu${colors.reset}`);
  console.log(`${colors.magenta}│${colors.reset}`);
  console.log(`${colors.magenta}└─ Enter your choice (1-5):${colors.reset} `);
}

function printSystemMenu() {
  console.log(`${colors.blue}${colors.bright}
┌─ System Configuration:${colors.reset}`);
  console.log(`${colors.blue}│${colors.reset}`);
  console.log(`${colors.blue}│${colors.reset} ${colors.cyan}1.${colors.reset} ${colors.white}🔧 Configure GNOME Desktop${colors.reset} ${colors.dim}- Hide icons, dock, hot corner${colors.reset}`);
  console.log(`${colors.blue}│${colors.reset} ${colors.cyan}2.${colors.reset} ${colors.white}🌐 Set Default Browser${colors.reset} ${colors.dim}- Set Brave as default browser${colors.reset}`);
  console.log(`${colors.blue}│${colors.reset} ${colors.cyan}3.${colors.reset} ${colors.white}🖼️  Set Wallpaper${colors.reset} ${colors.dim}- Apply custom wallpaper${colors.reset}`);
  console.log(`${colors.blue}│${colors.reset} ${colors.cyan}4.${colors.reset} ${colors.white}🔓 Configure Sudo NOPASSWD${colors.reset} ${colors.dim}- Remove sudo password prompts${colors.reset}`);
  console.log(`${colors.blue}│${colors.reset} ${colors.cyan}5.${colors.reset} ${colors.white}🐳 Docker Post-Install${colors.reset} ${colors.dim}- Configure Docker settings${colors.reset}`);
  console.log(`${colors.blue}│${colors.reset} ${colors.cyan}6.${colors.reset} ${colors.white}⬅️  Back to Main${colors.reset} ${colors.dim}- Return to main menu${colors.reset}`);
  console.log(`${colors.blue}│${colors.reset}`);
  console.log(`${colors.blue}└─ Enter your choice (1-6):${colors.reset} `);
}

let selectedCategories = new Set<string>();
let verboseMode = false;
let dryRunMode = false;

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
          checkResult = await executeCommand(`command -v ${name}`, false);
          break;
        default:
          checkResult = { success: false };
      }
      
      const status = checkResult.success ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
      const displayName = selectedCategories.has(category.id) ? `${colors.white}${pkg.displayName}${colors.reset}` : `${colors.dim}${pkg.displayName}${colors.reset}`;
      
      console.log(`  ${status} ${displayName}`);
      if (checkResult.success) installedPackages++;
    }
    console.log();
  }
  
  const percentage = Math.round((installedPackages / totalPackages) * 100);
  console.log(`${colors.yellow}📊 Summary: ${installedPackages}/${totalPackages} packages installed (${percentage}%)${colors.reset}`);
  
  return { totalPackages, installedPackages, percentage };
}

async function listAllPackages() {
  console.log(`${colors.cyan}${colors.bright}
📋 Available Packages:${colors.reset}\n`);
  
  for (const category of categories) {
    const isSelected = selectedCategories.has(category.id);
    const categoryStatus = isSelected ? `${colors.green}[SELECTED]${colors.reset}` : `${colors.dim}[available]${colors.reset}`;
    
    console.log(`${colors.yellow}${category.name} ${categoryStatus}:${colors.reset}`);
    
    category.packages.forEach(pkg => {
      const methodColor = {
        apt: colors.green,
        snap: colors.blue,
        npm: colors.magenta,
        github: colors.cyan,
        curl: colors.yellow
      }[pkg.method] || colors.white;
      
      console.log(`  • ${colors.white}${pkg.displayName}${colors.reset} (${methodColor}${pkg.method}${colors.reset}) - ${colors.dim}${pkg.id}${colors.reset}`);
    });
    console.log();
  }
}

async function installPackage() {
  console.log(`${colors.green}📦 Install Package${colors.reset}\n`);
  console.log(`${colors.cyan}Enter package name to install:${colors.reset} `);
  
  const packageName = await new Promise<string>((resolve) => {
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });

  if (!packageName) {
    console.log(`${colors.red}❌ No package name entered${colors.reset}`);
    return;
  }

  // Find package
  let foundPackage = null;
  let foundCategory = null;
  
  for (const category of categories) {
    const pkg = category.packages.find(p => 
      p.id === packageName.toLowerCase() || 
      p.displayName.toLowerCase().includes(packageName.toLowerCase()) ||
      p.name.toLowerCase().includes(packageName.toLowerCase())
    );
    if (pkg) {
      foundPackage = pkg;
      foundCategory = category;
      break;
    }
  }

  if (!foundPackage) {
    console.log(`${colors.red}❌ Package "${packageName}" not found${colors.reset}`);
    return;
  }

  console.log(`${colors.cyan}Found: ${foundPackage.displayName} from ${foundCategory.name}${colors.reset}`);
  
  if (dryRunMode) {
    console.log(`${colors.yellow}[DRY RUN] Would install ${foundPackage.displayName}${colors.reset}`);
    return;
  }

  // Check if already installed
  const { name, method } = foundPackage;
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
      checkResult = await executeCommand(`command -v ${name}`, false);
      break;
    default:
      checkResult = { success: false };
  }
  
  if (checkResult.success) {
    console.log(`${colors.green}✓ ${foundPackage.displayName} is already installed${colors.reset}`);
    return;
  }

  // Install package
  console.log(`${colors.yellow}📦 Installing ${foundPackage.displayName}...${colors.reset}`);
  
  let result;
  const { extra, flags } = foundPackage;
  
  switch (method) {
    case "apt":
      result = await executeCommand(`sudo apt install -y ${name}`, verboseMode);
      break;
    case "snap":
      const snapFlags = flags || "";
      result = await executeCommand(`sudo snap install ${snapFlags} ${name}`, verboseMode);
      break;
    case "github":
      result = await executeCommand(`gh repo clone ${extra} ${name}`, verboseMode);
      break;
    case "curl":
      result = await executeCommand(`curl -fsSL ${extra} | bash`, verboseMode);
      break;
    case "npm":
      result = await executeCommand(`npm install -g ${name}`, verboseMode);
      break;
    default:
      result = { success: false, output: "", error: `Unsupported method: ${method}` };
  }
  
  if (result.success) {
    console.log(`${colors.green}✅ ${foundPackage.displayName} installed successfully!${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ Failed to install ${foundPackage.displayName}: ${result.error}${colors.reset}`);
  }
}

async function configureGnome() {
  console.log(`${colors.blue}🔧 Configuring GNOME Desktop...${colors.reset}`);
  
  if (dryRunMode) {
    console.log(`${colors.yellow}[DRY RUN] Would configure GNOME desktop settings${colors.reset}`);
    return;
  }

  const result = await configureGnomeDesktop(verboseMode);
  result.steps.forEach((step) => {
    const icon = step.success ? "✓" : "✗";
    const color = step.success ? colors.green : colors.red;
    console.log(`  ${color}${icon} ${step.name}: ${step.message}${colors.reset}`);
  });
  
  if (result.success) {
    console.log(`${colors.green}✅ GNOME desktop configured successfully!${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠ Some GNOME settings encountered issues${colors.reset}`);
  }
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

async function fullSetup() {
  console.log(`${colors.green}🚀 Starting Full Setup...${colors.reset}\n`);
  
  if (selectedCategories.size === 0) {
    console.log(`${colors.yellow}⚠ No categories selected. Select categories first or use 'all'.${colors.reset}`);
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
      const { name, method } = pkg;
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
          checkResult = await executeCommand(`command -v ${name}`, false);
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
      const { extra, flags } = pkg;
      
      switch (method) {
        case "apt":
          result = await executeCommand(`sudo apt install -y ${name}`, verboseMode);
          break;
        case "snap":
          const snapFlags = flags || "";
          result = await executeCommand(`sudo snap install ${snapFlags} ${name}`, verboseMode);
          break;
        case "github":
          result = await executeCommand(`gh repo clone ${extra} ${name}`, verboseMode);
          break;
        case "curl":
          result = await executeCommand(`curl -fsSL ${extra} | bash`, verboseMode);
          break;
        case "npm":
          result = await executeCommand(`npm install -g ${name}`, verboseMode);
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

  console.log(`\n${colors.green}✅ Full setup complete!${colors.reset}`);
}

async function showSettings() {
  console.log(`${colors.yellow}⚙️ Current Settings:${colors.reset}\n`);
  console.log(`${colors.cyan}Verbose Mode:${colors.reset} ${verboseMode ? `${colors.green}ON${colors.reset}` : `${colors.red}OFF${colors.reset}`}`);
  console.log(`${colors.cyan}Dry Run Mode:${colors.reset} ${dryRunMode ? `${colors.green}ON${colors.reset}` : `${colors.red}OFF${colors.reset}`}`);
  console.log(`${colors.cyan}Selected Categories:${colors.reset} ${selectedCategories.size} of ${categories.length}\n`);
  
  console.log(`${colors.yellow}Toggle options:${colors.reset}`);
  console.log(`${colors.cyan}1.${colors.reset} Toggle verbose mode`);
  console.log(`${colors.cyan}2.${colors.reset} Toggle dry run mode`);
  console.log(`${colors.cyan}3.${colors.reset} Back to main menu`);
  console.log(`${colors.yellow}Enter choice (1-3):${colors.reset} `);

  const choice = await new Promise<string>((resolve) => {
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });

  switch (choice) {
    case '1':
      verboseMode = !verboseMode;
      console.log(`${colors.green}✅ Verbose mode ${verboseMode ? 'enabled' : 'disabled'}${colors.reset}`);
      break;
    case '2':
      dryRunMode = !dryRunMode;
      console.log(`${colors.green}✅ Dry run mode ${dryRunMode ? 'enabled' : 'disabled'}${colors.reset}`);
      break;
    case '3':
      return;
  }
}

async function main() {
  console.log(`${colors.yellow}🚀 Starting Interactive OpenTUI Setup...${colors.reset}`);
  
  if (!process.stdin.isTTY) {
    console.log(`${colors.red}❌ This tool requires an interactive terminal.${colors.reset}`);
    process.exit(1);
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
      case '1': // Package Management
        await packageManagementMenu();
        break;
      case '2': // System Configuration
        await systemConfigurationMenu();
        break;
      case '3': // Full Setup
        await fullSetup();
        break;
      case '4': // Select Categories
        await selectCategories();
        break;
      case '5': // Check Installation
        await checkInstallation();
        break;
      case '6': // Settings
        await showSettings();
        break;
      case '7': // Exit
        console.log(`${colors.green}👋 Setup complete! Happy coding!${colors.reset}`);
        process.exit(0);
      default:
        console.log(`${colors.red}❌ Invalid choice. Please enter 1-7.${colors.reset}`);
    }
    
    console.log(`\n${colors.yellow}Press Enter to continue...${colors.reset}`);
    await new Promise<void>((resolve) => {
      process.stdin.once('data', () => resolve());
    });
  }
}

async function packageManagementMenu() {
  while (true) {
    clearScreen();
    printHeader();
    printPackageMenu();
    
    const choice = await new Promise<string>((resolve) => {
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim());
      });
    });

    clearScreen();
    printHeader();
    
    switch (choice) {
      case '1':
        await installPackage();
        break;
      case '2':
        console.log(`${colors.red}🗑️ Remove package feature coming soon...${colors.reset}`);
        break;
      case '3':
        await listAllPackages();
        break;
      case '4':
        console.log(`${colors.cyan}🔍 Search packages feature coming soon...${colors.reset}`);
        break;
      case '5':
        return;
      default:
        console.log(`${colors.red}❌ Invalid choice. Please enter 1-5.${colors.reset}`);
    }
    
    console.log(`\n${colors.yellow}Press Enter to continue...${colors.reset}`);
    await new Promise<void>((resolve) => {
      process.stdin.once('data', () => resolve());
    });
  }
}

async function systemConfigurationMenu() {
  while (true) {
    clearScreen();
    printHeader();
    printSystemMenu();
    
    const choice = await new Promise<string>((resolve) => {
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim());
      });
    });

    clearScreen();
    printHeader();
    
    switch (choice) {
      case '1':
        await configureGnome();
        break;
      case '2':
        console.log(`${colors.blue}🌐 Set default browser feature coming soon...${colors.reset}`);
        break;
      case '3':
        console.log(`${colors.blue}🖼️ Set wallpaper feature coming soon...${colors.reset}`);
        break;
      case '4':
        console.log(`${colors.blue}🔓 Configure sudo NOPASSWD feature coming soon...${colors.reset}`);
        break;
      case '5':
        console.log(`${colors.blue}🐳 Docker post-install feature coming soon...${colors.reset}`);
        break;
      case '6':
        return;
      default:
        console.log(`${colors.red}❌ Invalid choice. Please enter 1-6.${colors.reset}`);
    }
    
    console.log(`\n${colors.yellow}Press Enter to continue...${colors.reset}`);
    await new Promise<void>((resolve) => {
      process.stdin.once('data', () => resolve());
    });
  }
}

main().catch(console.error);
