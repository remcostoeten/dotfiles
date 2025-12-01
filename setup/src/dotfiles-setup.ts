/**
 * Dotfiles and Fish Shell Setup
 * Handles cloning dotfiles repo, creating symlinks, and configuring Fish shell
 */

import { executeCommand } from "./executor";
import type { CommandResult } from "./executor";
import { existsSync } from "fs";
import { readlink, symlink, mkdir, readFile, writeFile } from "fs/promises";
import { dirname } from "path";
import { logErrorSilently, executeWithFallback, safeExecute } from "./noop";
import { runPreflight } from "./preflight";

const DOTFILES_DIR = `${process.env.HOME}/.config/dotfiles`;
const DOTFILES_DATA_DIR = `${process.env.HOME}/.dotfiles`;

export interface DotfilesSetupResult {
  success: boolean;
  steps: {
    name: string;
    success: boolean;
    message: string;
  }[];
}

/**
 * Main dotfiles setup function
 */
export async function setupDotfiles(): Promise<DotfilesSetupResult> {
  const result: DotfilesSetupResult = {
    success: true,
    steps: [],
  };

  // 1. Check if dotfiles directory exists
  if (!existsSync(DOTFILES_DIR)) {
    result.steps.push({
      name: "Check dotfiles directory",
      success: false,
      message: `Dotfiles directory not found at ${DOTFILES_DIR}. Please clone your dotfiles repository first.`,
    });
    result.success = false;
    return result;
  }

  result.steps.push({
    name: "Check dotfiles directory",
    success: true,
    message: `Found dotfiles at ${DOTFILES_DIR}`,
  });

  // 1.5. Run preflight (git submodules, SSH keys)
  const preflightResult = await runPreflight();
  result.steps.push(...preflightResult.steps);
  // Don't fail setup if preflight has warnings (SSH keys might not exist yet)
  // if (!preflightResult.success) result.success = false;

  // 2. Setup Fish shell configuration
  const fishResult = await setupFishConfig();
  result.steps.push(...fishResult.steps);
  if (!fishResult.success) result.success = false;

  // 3. Setup Fish functions
  const functionsResult = await setupFishFunctions();
  result.steps.push(...functionsResult.steps);
  if (!functionsResult.success) result.success = false;

  // 4. Setup scripts symlinks
  const scriptsResult = await setupScriptsSymlinks();
  result.steps.push(...scriptsResult.steps);
  if (!scriptsResult.success) result.success = false;

  // 5. Add to PATH
  const pathResult = await addToPath();
  result.steps.push(...pathResult.steps);
  if (!pathResult.success) result.success = false;

  // 6. Setup Git config
  const gitResult = await setupGitConfig();
  result.steps.push(...gitResult.steps);
  if (!gitResult.success) result.success = false;

  // 7. Setup Git ignore
  const gitIgnoreResult = await setupGitIgnore();
  result.steps.push(...gitIgnoreResult.steps);
  if (!gitIgnoreResult.success) result.success = false;

  // 8. Initialize git submodules
  const submodulesResult = await initGitSubmodules();
  result.steps.push(...submodulesResult.steps);
  if (!submodulesResult.success) result.success = false;

  // 9. Create common directories
  const dirsResult = await createCommonDirectories();
  result.steps.push(...dirsResult.steps);
  if (!dirsResult.success) result.success = false;

  // 10. Create dotfiles CLI config
  const cliConfigResult = await createDotfilesCLIConfig();
  result.steps.push(...cliConfigResult.steps);
  if (!cliConfigResult.success) result.success = false;

  // 11. Setup config app symlinks (kitty, neovim, wezterm, hyprland, waybar, cursor, ghostty)
  const configAppsResult = await setupConfigApps();
  result.steps.push(...configAppsResult.steps);
  if (!configAppsResult.success) result.success = false;

  // 12. Setup GNOME aesthetics
  const gnomeResult = await setupGnomeAesthetics();
  result.steps.push(...gnomeResult.steps);
  if (!gnomeResult.success) result.success = false;

  return result;
}

/**
 * Setup Fish shell config (cfg file)
 */
async function setupFishConfig(): Promise<DotfilesSetupResult> {
  const result: DotfilesSetupResult = { success: true, steps: [] };

  const cfgFile = `${DOTFILES_DIR}/cfg`;
  const fishConfig = `${process.env.HOME}/.config/fish/config.fish`;

  if (!existsSync(cfgFile)) {
    result.steps.push({
      name: "Fish config (cfg)",
      success: false,
      message: `cfg file not found at ${cfgFile}`,
    });
    result.success = false;
    return result;
  }

  try {
    // Create fish config directory
    await mkdir(dirname(fishConfig), { recursive: true });

    // Check if already correctly symlinked
    if (existsSync(fishConfig)) {
      try {
        const target = await readlink(fishConfig);
        if (target === cfgFile || target.includes("dotfiles/cfg")) {
          result.steps.push({
            name: "Fish config (cfg)",
            success: true,
            message: "Fish config already correctly symlinked",
          });
          return result;
        }
      } catch (err) {
        // Not a symlink, backup and create
        const backupPath = `${fishConfig}.bak.${Date.now()}`;
        await executeCommand(`mv "${fishConfig}" "${backupPath}"`);
      }
    }

    // Create symlink
    await symlink(cfgFile, fishConfig);
    result.steps.push({
      name: "Fish config (cfg)",
      success: true,
      message: `Created fish config symlink: ${fishConfig} → cfg`,
    });
  } catch (err) {
    result.steps.push({
      name: "Fish config (cfg)",
      success: false,
      message: `Failed to create fish config symlink: ${err}`,
    });
    result.success = false;
  }

  return result;
}

/**
 * Setup Fish functions symlinks
 */
async function setupFishFunctions(): Promise<DotfilesSetupResult> {
  const result: DotfilesSetupResult = { success: true, steps: [] };

  const functionsDir = `${DOTFILES_DIR}/configs/fish/functions`;
  const fishFunctionsDir = `${process.env.HOME}/.config/fish/functions`;

  if (!existsSync(functionsDir)) {
    result.steps.push({
      name: "Fish functions",
      success: true,
      message: "No fish functions directory found (skipped)",
    });
    return result;
  }

  try {
    await mkdir(fishFunctionsDir, { recursive: true });

    const listResult = await executeCommand(`ls "${functionsDir}"/*.fish 2>/dev/null || true`);
    const functionFiles = listResult.output.split("\n").filter((f) => f.trim());

    let count = 0;
    for (const funcFile of functionFiles) {
      if (!funcFile) continue;

      const funcName = funcFile.split("/").pop() || "";
      const targetPath = `${fishFunctionsDir}/${funcName}`;

      try {
        // Check if already correctly symlinked
        if (existsSync(targetPath)) {
          const target = await readlink(targetPath);
          if (target === funcFile || target.includes(funcName)) {
            continue;
          }
          // Backup existing
          await executeCommand(`mv "${targetPath}" "${targetPath}.bak.${Date.now()}"`);
        }

        await symlink(funcFile, targetPath);
        count++;
      } catch (err) {
        // Continue with other functions
        logErrorSilently(err, "Fish function symlink");
      }
    }

    result.steps.push({
      name: "Fish functions",
      success: true,
      message: count > 0 ? `Created ${count} fish function symlinks` : "All fish functions already symlinked",
    });
  } catch (err) {
    result.steps.push({
      name: "Fish functions",
      success: false,
      message: `Failed to setup fish functions: ${err}`,
    });
    result.success = false;
  }

  return result;
}

/**
 * Setup scripts symlinks to bin directory
 */
async function setupScriptsSymlinks(): Promise<DotfilesSetupResult> {
  const result: DotfilesSetupResult = { success: true, steps: [] };

  const scriptsDir = `${DOTFILES_DIR}/scripts`;
  const binDir = `${DOTFILES_DIR}/bin`;

  if (!existsSync(scriptsDir)) {
    result.steps.push({
      name: "Scripts symlinks",
      success: true,
      message: "No scripts directory found (skipped)",
    });
    return result;
  }

  try {
    await mkdir(binDir, { recursive: true });

    const listResult = await executeCommand(`find "${scriptsDir}" -maxdepth 1 -type f ! -name "*.md" ! -name "*.txt" ! -name "*.json" ! -name "*.lock" ! -name "*.pyc" 2>/dev/null || true`);
    const scriptFiles = listResult.output.split("\n").filter((f) => f.trim());

    let count = 0;
    for (const scriptFile of scriptFiles) {
      if (!scriptFile) continue;

      const scriptName = scriptFile.split("/").pop() || "";
      const targetPath = `${binDir}/${scriptName}`;

      try {
        // Check if already correctly symlinked
        if (existsSync(targetPath)) {
          const target = await readlink(targetPath);
          if (target.includes(scriptName)) {
            continue;
          }
          // Backup existing
          await executeCommand(`mv "${targetPath}" "${targetPath}.backup.${Date.now()}"`);
        }

        await symlink(`../scripts/${scriptName}`, targetPath);
        count++;
      } catch (err) {
        // Continue with other scripts
        logErrorSilently(err, "Scripts symlink");
      }
    }

    result.steps.push({
      name: "Scripts symlinks",
      success: true,
      message: count > 0 ? `Created ${count} symlinks from scripts/ to bin/` : "All scripts already symlinked",
    });
  } catch (err) {
    result.steps.push({
      name: "Scripts symlinks",
      success: false,
      message: `Failed to setup scripts symlinks: ${err}`,
    });
    result.success = false;
  }

  return result;
}

/**
 * Add dotfiles bin and scripts to PATH
 */
async function addToPath(): Promise<DotfilesSetupResult> {
  const result: DotfilesSetupResult = { success: true, steps: [] };

  const bashrc = `${process.env.HOME}/.bashrc`;

  try {
    if (!existsSync(bashrc)) {
      result.steps.push({
        name: "Add to PATH",
        success: true,
        message: "No .bashrc found (skipped)",
      });
      return result;
    }

    const bashrcContent = await readFile(bashrc, "utf-8");
    let modified = false;
    let newContent = bashrcContent;

    // Add bin directory
    if (!bashrcContent.includes("dotfiles/bin")) {
      newContent += `\n# Dotfiles bin directory\nexport PATH="$HOME/.config/dotfiles/bin:$PATH"\n`;
      modified = true;
    }

    // Add scripts directory
    if (!bashrcContent.includes("dotfiles/scripts")) {
      newContent += `export PATH="$HOME/.config/dotfiles/scripts:$PATH"\n`;
      modified = true;
    }

    if (modified) {
      await writeFile(bashrc, newContent, "utf-8");
      result.steps.push({
        name: "Add to PATH",
        success: true,
        message: "Added dotfiles/bin and dotfiles/scripts to .bashrc",
      });
    } else {
      result.steps.push({
        name: "Add to PATH",
        success: true,
        message: "PATH already configured in .bashrc",
      });
    }

    // Make scripts executable
    await executeCommand(`find "${DOTFILES_DIR}/bin" -type f -exec chmod +x {} \\; 2>/dev/null || true`);
    await executeCommand(`find "${DOTFILES_DIR}/scripts" -type f \\( -name "*.sh" -o -name "*.py" -o -name "*.ts" -o -name "*.fish" -o -name "*.js" \\) -exec chmod +x {} \\; 2>/dev/null || true`);
  } catch (err) {
    result.steps.push({
      name: "Add to PATH",
      success: false,
      message: `Failed to add to PATH: ${err}`,
    });
    result.success = false;
  }

  return result;
}

/**
 * Setup Git config symlink
 */
async function setupGitConfig(): Promise<DotfilesSetupResult> {
  const result: DotfilesSetupResult = { success: true, steps: [] };

  const gitConfigSource = `${DOTFILES_DIR}/configs/git/.gitconfig`;
  const gitConfigTarget = `${process.env.HOME}/.gitconfig`;

  if (!existsSync(gitConfigSource)) {
    result.steps.push({
      name: "Git config",
      success: true,
      message: "No git config found in dotfiles (skipped)",
    });
    return result;
  }

  try {
    // Check if already correctly symlinked
    if (existsSync(gitConfigTarget)) {
      try {
        const target = await readlink(gitConfigTarget);
        if (target === gitConfigSource || target.includes("dotfiles/configs/git/.gitconfig")) {
          result.steps.push({
            name: "Git config",
            success: true,
            message: "Git config already correctly symlinked",
          });
          return result;
        }
      } catch (err) {
        // Not a symlink, backup
        await executeCommand(`mv "${gitConfigTarget}" "${gitConfigTarget}.bak.${Date.now()}"`);
      }
    }

    await symlink(gitConfigSource, gitConfigTarget);
    result.steps.push({
      name: "Git config",
      success: true,
      message: `Created git config symlink: ${gitConfigTarget} → configs/git/.gitconfig`,
    });
  } catch (err) {
    result.steps.push({
      name: "Git config",
      success: false,
      message: `Failed to create git config symlink: ${err}`,
    });
    result.success = false;
  }

  return result;
}

/**
 * Setup Git ignore symlink
 */
async function setupGitIgnore(): Promise<DotfilesSetupResult> {
  const result: DotfilesSetupResult = { success: true, steps: [] };

  const gitIgnoreSource = `${DOTFILES_DIR}/configs/git/ignore`;
  const gitIgnoreTarget = `${process.env.HOME}/.gitignore`;

  if (!existsSync(gitIgnoreSource)) {
    result.steps.push({
      name: "Git ignore",
      success: true,
      message: "No git ignore found in dotfiles (skipped)",
    });
    return result;
  }

  try {
    // Check if already correctly symlinked
    if (existsSync(gitIgnoreTarget)) {
      try {
        const target = await readlink(gitIgnoreTarget);
        if (target === gitIgnoreSource || target.includes("dotfiles/configs/git/ignore")) {
          result.steps.push({
            name: "Git ignore",
            success: true,
            message: "Git ignore already correctly symlinked",
          });
          return result;
        }
      } catch (err) {
        // Not a symlink, backup
        await executeCommand(`mv "${gitIgnoreTarget}" "${gitIgnoreTarget}.bak.${Date.now()}"`);
      }
    }

    await symlink(gitIgnoreSource, gitIgnoreTarget);
    result.steps.push({
      name: "Git ignore",
      success: true,
      message: `Created git ignore symlink: ${gitIgnoreTarget} → configs/git/ignore`,
    });
  } catch (err) {
    result.steps.push({
      name: "Git ignore",
      success: false,
      message: `Failed to create git ignore symlink: ${err}`,
    });
    result.success = false;
  }

  return result;
}

/**
 * Initialize git submodules
 */
async function initGitSubmodules(): Promise<DotfilesSetupResult> {
  const result: DotfilesSetupResult = { success: true, steps: [] };

  const gitmodulesPath = `${DOTFILES_DIR}/.gitmodules`;

  if (!existsSync(gitmodulesPath)) {
    result.steps.push({
      name: "Git submodules",
      success: true,
      message: "No git submodules found (skipped)",
    });
    return result;
  }

  try {
    const submoduleResult = await executeCommand(`cd "${DOTFILES_DIR}" && git submodule update --init --recursive`);

    if (submoduleResult.success) {
      result.steps.push({
        name: "Git submodules",
        success: true,
        message: "Git submodules initialized",
      });
    } else {
      result.steps.push({
        name: "Git submodules",
        success: false,
        message: "Failed to initialize git submodules",
      });
      result.success = false;
    }
  } catch (err) {
    result.steps.push({
      name: "Git submodules",
      success: false,
      message: `Failed to initialize git submodules: ${err}`,
    });
    result.success = false;
  }

  return result;
}

/**
 * Create common directories
 */
async function createCommonDirectories(): Promise<DotfilesSetupResult> {
  const result: DotfilesSetupResult = { success: true, steps: [] };

  const dirs = [
    `${process.env.HOME}/programs`,
    `${process.env.HOME}/tmp`,
    `${process.env.HOME}/sandbox`,
    `${process.env.HOME}/dev`,
    `${process.env.HOME}/Audio`,
  ];

  let created = 0;
  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
        created++;
      }
    } catch (err) {
      // Continue with other directories
    }
  }

  result.steps.push({
    name: "Common directories",
    success: true,
    message: created > 0 ? `Created ${created} common directories` : "All common directories already exist",
  });

  // Download alarm sound if needed
  const alarmPath = `${process.env.HOME}/Audio/alarm.mp3`;
  if (existsSync(`${process.env.HOME}/Audio`) && !existsSync(alarmPath)) {
    try {
      await executeCommand(`curl -L -f -s -o "${alarmPath}" "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"`);
      result.steps.push({
        name: "Alarm sound",
        success: true,
        message: "Downloaded alarm sound to ~/Audio/alarm.mp3",
      });
    } catch (err) {
      result.steps.push({
        name: "Alarm sound",
        success: false,
        message: "Failed to download alarm sound (optional)",
      });
    }
  }

  return result;
}

/**
 * Create dotfiles CLI config
 */
async function createDotfilesCLIConfig(): Promise<DotfilesSetupResult> {
  const result: DotfilesSetupResult = { success: true, steps: [] };

  const configPath = `${DOTFILES_DIR}/.dotfiles-cli.json`;

  if (existsSync(configPath)) {
    result.steps.push({
      name: "Dotfiles CLI config",
      success: true,
      message: "Dotfiles CLI config already exists",
    });
    return result;
  }

  try {
    const config = {
      layout: "categories",
      banner: "modern",
      includeAliases: true,
      includeFunctions: true,
      groupAliases: true,
      preferBinOverScripts: true,
      fzfHeight: "90%",
      showDescriptions: true,
      enableCategories: true,
      recentItems: [],
    };

    await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
    result.steps.push({
      name: "Dotfiles CLI config",
      success: true,
      message: "Created dotfiles CLI config",
    });
  } catch (err) {
    result.steps.push({
      name: "Dotfiles CLI config",
      success: false,
      message: `Failed to create dotfiles CLI config: ${err}`,
    });
    result.success = false;
  }

  return result;
}

/**
 * Setup config app symlinks (kitty, neovim, wezterm, hyprland, waybar, cursor, ghostty, etc.)
 */
async function setupConfigApps(): Promise<DotfilesSetupResult> {
  const result: DotfilesSetupResult = { success: true, steps: [] };

  const configsDir = `${DOTFILES_DIR}/configs`;

  if (!existsSync(configsDir)) {
    result.steps.push({
      name: "Config apps",
      success: true,
      message: "No configs directory found (skipped)",
    });
    return result;
  }

  // Map of app name to target location
  const configApps: Record<string, string> = {
    nvim: `${process.env.HOME}/.config/nvim`,
    neovim: `${process.env.HOME}/.config/nvim`,
    kitty: `${process.env.HOME}/.config/kitty`,
    waybar: `${process.env.HOME}/.config/waybar`,
    alacritty: `${process.env.HOME}/.config/alacritty`,
    tmux: `${process.env.HOME}/.config/tmux`,
    starship: `${process.env.HOME}/.config/starship`,
    ghostty: `${process.env.HOME}/.config/ghostty`,
    cursor: `${process.env.HOME}/.config/cursor`,
  };

  let count = 0;

  // Find all config directories
  const listResult = await executeCommand(`ls -d "${configsDir}"/*/ 2>/dev/null || true`);
  const configDirs = listResult.output.split("\n").filter((d) => d.trim());

  for (const configDir of configDirs) {
    if (!configDir) continue;

    const appName = configDir.split("/").filter(Boolean).pop() || "";

    // Skip fish, git, gnome (handled separately)
    // Note: cursor and ghostty are now handled here via configApps map
    if (["fish", "git", "gnome"].includes(appName)) {
      continue;
    }

    const sourceDir = `${configsDir}/${appName}`;
    const targetDir = configApps[appName] || `${process.env.HOME}/.config/${appName}`;

    try {
      // Create parent directory
      await mkdir(dirname(targetDir), { recursive: true });

      // Check if already correctly symlinked
      if (existsSync(targetDir)) {
        try {
          const target = await readlink(targetDir);
          if (target === sourceDir || target.includes(`configs/${appName}`)) {
            continue;
          }
        } catch (err) {
          // Not a symlink, backup
          await executeCommand(`mv "${targetDir}" "${targetDir}.backup.${Date.now()}"`);
        }
      }

      // Create symlink
      await symlink(sourceDir, targetDir);
      count++;
    } catch (err) {
      // Continue with other apps
      logErrorSilently(err, "Config apps symlink");
    }
  }

  result.steps.push({
    name: "Config apps",
    success: true,
    message: count > 0 ? `Created ${count} config app symlinks (kitty, nvim, etc.)` : "All config apps already symlinked",
  });

  return result;
}

/**
 * Setup GNOME aesthetics
 */
async function setupGnomeAesthetics(): Promise<DotfilesSetupResult> {
  const result: DotfilesSetupResult = { success: true, steps: [] };

  const gnomeSetupScript = `${DOTFILES_DIR}/configs/gnome/setup-aesthetic-gnome.sh`;

  if (!existsSync(gnomeSetupScript)) {
    result.steps.push({
      name: "GNOME aesthetics",
      success: true,
      message: "No GNOME setup script found (skipped)",
    });
    return result;
  }

  try {
    // Run the GNOME aesthetic setup script
    const setupResult = await executeCommand(`bash "${gnomeSetupScript}"`);

    if (setupResult.success) {
      result.steps.push({
        name: "GNOME aesthetics",
        success: true,
        message: "GNOME aesthetic setup completed (logout/login to see changes)",
      });
    } else {
      result.steps.push({
        name: "GNOME aesthetics",
        success: false,
        message: "GNOME aesthetic setup encountered issues",
      });
      result.success = false;
    }
  } catch (err) {
    result.steps.push({
      name: "GNOME aesthetics",
      success: false,
      message: `Failed to run GNOME setup: ${err}`,
    });
    result.success = false;
  }

  return result;
}
