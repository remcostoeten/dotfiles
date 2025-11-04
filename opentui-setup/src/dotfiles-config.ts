/**
 * Dotfiles Configuration Utilities
 * - Apply kitty configuration
 * - Apply other dotfiles configurations
 * - Symlink config files to appropriate locations
 */

import { executeCommand } from "./executor";
import { existsSync } from "fs";

export interface DotfilesConfigResult {
  success: boolean;
  steps: Array<{ name: string; success: boolean; message: string }>;
}

/**
 * Apply all dotfiles configurations
 */
export async function applyDotfilesConfig(verbose: boolean = false): Promise<DotfilesConfigResult> {
  const steps: Array<{ name: string; success: boolean; message: string }> = [];

  try {
    const DOTFILES_DIR = `${process.env.HOME}/.config/dotfiles`;
    const CONFIG_DIR = `${process.env.HOME}/.config`;

    // Create config directory if it doesn't exist
    const configCheck = await executeCommand(`mkdir -p "${CONFIG_DIR}"`, verbose);
    if (configCheck.success) {
      steps.push({ name: "Create config directory", success: true, message: "Config directory ready" });
    } else {
      steps.push({ name: "Create config directory", success: false, message: "Failed to create config directory" });
    }

    // Apply kitty configuration
    const kittyResult = await applyKittyConfig(verbose);
    steps.push(...kittyResult.steps);

    // Apply fish configuration
    const fishResult = await applyFishConfig(verbose);
    steps.push(...fishResult.steps);

    // Apply git configuration
    const gitResult = await applyGitConfig(verbose);
    steps.push(...gitResult.steps);

    // Apply neovim configuration
    const nvimResult = await applyNeovimConfig(verbose);
    steps.push(...nvimResult.steps);

    // Apply wezterm configuration
    const weztermResult = await applyWeztermConfig(verbose);
    steps.push(...weztermResult.steps);

    return { success: steps.filter(s => !s.success).length === 0, steps };
  } catch (err) {
    steps.push({ name: "Apply dotfiles", success: false, message: err instanceof Error ? err.message : String(err) });
    return { success: false, steps };
  }
}

/**
 * Apply kitty configuration
 */
async function applyKittyConfig(verbose: boolean = false): Promise<DotfilesConfigResult> {
  const steps: Array<{ name: string; success: boolean; message: string }> = [];

  try {
    const DOTFILES_DIR = `${process.env.HOME}/.config/dotfiles`;
    const CONFIG_DIR = `${process.env.HOME}/.config`;
    const kittySource = `${DOTFILES_DIR}/configs/kitty`;
    const kittyTarget = `${CONFIG_DIR}/kitty`;

    // Check if kitty config exists
    if (!existsSync(kittySource)) {
      steps.push({ name: "Kitty config", success: false, message: "Kitty config not found in dotfiles/configs" });
      return { success: false, steps };
    }

    // Remove existing kitty config
    const removeResult = await executeCommand(`rm -rf "${kittyTarget}"`, verbose);
    if (removeResult.success) {
      steps.push({ name: "Remove old kitty config", success: true, message: "Old config removed" });
    }

    // Create symlink to kitty config
    const linkResult = await executeCommand(`ln -sf "${kittySource}" "${kittyTarget}"`, verbose);
    if (linkResult.success) {
      steps.push({ name: "Kitty config symlink", success: true, message: "Kitty configuration applied" });
    } else {
      steps.push({ name: "Kitty config symlink", success: false, message: "Failed to symlink kitty config" });
    }

    // Verify kitty can read config
    const verifyResult = await executeCommand(`command -v kitty >/dev/null && kitty --config "${kittyTarget}/kitty.conf" --help >/dev/null 2>&1`, verbose);
    if (verifyResult.success) {
      steps.push({ name: "Kitty config verification", success: true, message: "Kitty config is valid" });
    } else {
      steps.push({ name: "Kitty config verification", success: false, message: "Kitty config verification failed" });
    }

    return { success: steps.filter(s => !s.success).length === 0, steps };
  } catch (err) {
    steps.push({ name: "Kitty config", success: false, message: err instanceof Error ? err.message : String(err) });
    return { success: false, steps };
  }
}

/**
 * Apply fish configuration
 */
async function applyFishConfig(verbose: boolean = false): Promise<DotfilesConfigResult> {
  const steps: Array<{ name: string; success: boolean; message: string }> = [];

  try {
    const DOTFILES_DIR = `${process.env.HOME}/.config/dotfiles`;
    const CONFIG_DIR = `${process.env.HOME}/.config`;
    const fishSource = `${DOTFILES_DIR}/configs/fish`;
    const fishTarget = `${CONFIG_DIR}/fish`;

    // Check if fish config exists
    if (!existsSync(fishSource)) {
      steps.push({ name: "Fish config", success: false, message: "Fish config not found in dotfiles/configs" });
      return { success: false, steps };
    }

    // Remove existing fish config
    const removeResult = await executeCommand(`rm -rf "${fishTarget}"`, verbose);
    if (removeResult.success) {
      steps.push({ name: "Remove old fish config", success: true, message: "Old config removed" });
    }

    // Create symlink to fish config
    const linkResult = await executeCommand(`ln -sf "${fishSource}" "${fishTarget}"`, verbose);
    if (linkResult.success) {
      steps.push({ name: "Fish config symlink", success: true, message: "Fish configuration applied" });
    } else {
      steps.push({ name: "Fish config symlink", success: false, message: "Failed to symlink fish config" });
    }

    return { success: steps.filter(s => !s.success).length === 0, steps };
  } catch (err) {
    steps.push({ name: "Fish config", success: false, message: err instanceof Error ? err.message : String(err) });
    return { success: false, steps };
  }
}

/**
 * Apply git configuration
 */
async function applyGitConfig(verbose: boolean = false): Promise<DotfilesConfigResult> {
  const steps: Array<{ name: string; success: boolean; message: string }> = [];

  try {
    const DOTFILES_DIR = `${process.env.HOME}/.config/dotfiles`;
    const gitSource = `${DOTFILES_DIR}/configs/git`;
    const gitTarget = `${process.env.HOME}/.config/git`;

    // Create target directory
    await executeCommand(`mkdir -p "${gitTarget}"`, verbose);

    // Check if git config exists
    if (!existsSync(gitSource)) {
      steps.push({ name: "Git config", success: false, message: "Git config not found in dotfiles/configs" });
      return { success: false, steps };
    }

    // Link git config files
    const linkResult = await executeCommand(`ln -sf "${gitSource}/config" "${gitTarget}/config" && ln -sf "${gitSource}/ignore" "${gitTarget}/ignore"`, verbose);
    if (linkResult.success) {
      steps.push({ name: "Git config symlink", success: true, message: "Git configuration applied" });
    } else {
      steps.push({ name: "Git config symlink", success: false, message: "Failed to symlink git config" });
    }

    return { success: steps.filter(s => !s.success).length === 0, steps };
  } catch (err) {
    steps.push({ name: "Git config", success: false, message: err instanceof Error ? err.message : String(err) });
    return { success: false, steps };
  }
}

/**
 * Apply neovim configuration
 */
async function applyNeovimConfig(verbose: boolean = false): Promise<DotfilesConfigResult> {
  const steps: Array<{ name: string; success: boolean; message: string }> = [];

  try {
    const DOTFILES_DIR = `${process.env.HOME}/.config/dotfiles`;
    const CONFIG_DIR = `${process.env.HOME}/.config`;
    const nvimSource = `${DOTFILES_DIR}/configs/nvim`;
    const nvimTarget = `${CONFIG_DIR}/nvim`;

    // Check if nvim config exists
    if (!existsSync(nvimSource)) {
      steps.push({ name: "Neovim config", success: false, message: "Neovim config not found in dotfiles/configs" });
      return { success: false, steps };
    }

    // Remove existing nvim config
    const removeResult = await executeCommand(`rm -rf "${nvimTarget}"`, verbose);
    if (removeResult.success) {
      steps.push({ name: "Remove old nvim config", success: true, message: "Old config removed" });
    }

    // Create symlink to nvim config
    const linkResult = await executeCommand(`ln -sf "${nvimSource}" "${nvimTarget}"`, verbose);
    if (linkResult.success) {
      steps.push({ name: "Neovim config symlink", success: true, message: "Neovim configuration applied" });
    } else {
      steps.push({ name: "Neovim config symlink", success: false, message: "Failed to symlink nvim config" });
    }

    return { success: steps.filter(s => !s.success).length === 0, steps };
  } catch (err) {
    steps.push({ name: "Neovim config", success: false, message: err instanceof Error ? err.message : String(err) });
    return { success: false, steps };
  }
}

/**
 * Apply wezterm configuration
 */
async function applyWeztermConfig(verbose: boolean = false): Promise<DotfilesConfigResult> {
  const steps: Array<{ name: string; success: boolean; message: string }> = [];

  try {
    const DOTFILES_DIR = `${process.env.HOME}/.config/dotfiles`;
    const CONFIG_DIR = `${process.env.HOME}/.config`;
    const weztermSource = `${DOTFILES_DIR}/configs/wezterm`;
    const weztermTarget = `${CONFIG_DIR}/wezterm`;

    // Check if wezterm config exists
    if (!existsSync(weztermSource)) {
      steps.push({ name: "WezTerm config", success: false, message: "WezTerm config not found in dotfiles/configs" });
      return { success: false, steps };
    }

    // Remove existing wezterm config
    const removeResult = await executeCommand(`rm -rf "${weztermTarget}"`, verbose);
    if (removeResult.success) {
      steps.push({ name: "Remove old wezterm config", success: true, message: "Old config removed" });
    }

    // Create symlink to wezterm config
    const linkResult = await executeCommand(`ln -sf "${weztermSource}" "${weztermTarget}"`, verbose);
    if (linkResult.success) {
      steps.push({ name: "WezTerm config symlink", success: true, message: "WezTerm configuration applied" });
    } else {
      steps.push({ name: "WezTerm config symlink", success: false, message: "Failed to symlink wezterm config" });
    }

    return { success: steps.filter(s => !s.success).length === 0, steps };
  } catch (err) {
    steps.push({ name: "WezTerm config", success: false, message: err instanceof Error ? err.message : String(err) });
    return { success: false, steps };
  }
}
