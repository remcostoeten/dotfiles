/**
 * GitHub CLI Extensions Installation
 * - Install gh-select extension
 * - Other useful gh extensions
 */

import { executeCommand } from "./executor";

export interface GhExtensionsResult {
  success: boolean;
  steps: Array<{ name: string; success: boolean; message: string }>;
}

/**
 * Install GitHub CLI extensions
 */
export async function installGhExtensions(verbose: boolean = false): Promise<GhExtensionsResult> {
  const steps: Array<{ name: string; success: boolean; message: string }> = [];

  try {
    // Check if gh is installed
    const ghCheck = await executeCommand("command -v gh");
    if (!ghCheck.success) {
      steps.push({ name: "Check GitHub CLI", success: false, message: "GitHub CLI not installed" });
      return { success: false, steps };
    }
    steps.push({ name: "Check GitHub CLI", success: true, message: "GitHub CLI found" });

    // Install gh-select extension
    const selectResult = await executeCommand("gh extension install remcostoeten/gh-select", verbose);
    if (selectResult.success) {
      steps.push({ name: "Install gh-select", success: true, message: "gh-select extension installed" });
    } else {
      // Check if already installed
      const checkResult = await executeCommand("gh extension list | grep -q gh-select", false);
      if (checkResult.success) {
        steps.push({ name: "Install gh-select", success: true, message: "gh-select extension already installed" });
      } else {
        steps.push({ name: "Install gh-select", success: false, message: "Failed to install gh-select extension" });
      }
    }

    // Install other useful extensions
    const extensions = [
      { name: "gh-copilot", repo: "github/gh-copilot", description: "GitHub Copilot CLI" },
      { name: "gh-dash", repo: "dlvhdr/gh-dash", description: "GitHub Dashboard CLI" },
      { name: "gh-sponsors", repo: "charmbracelet/gh-sponsors", description: "GitHub sponsors CLI" }
    ];

    for (const ext of extensions) {
      const installResult = await executeCommand(`gh extension install ${ext.repo}`, verbose);
      if (installResult.success) {
        steps.push({ name: `Install ${ext.name}`, success: true, message: `${ext.description} installed` });
      } else {
        // Check if already installed
        const checkResult = await executeCommand(`gh extension list | grep -q ${ext.name}`, false);
        if (checkResult.success) {
          steps.push({ name: `Install ${ext.name}`, success: true, message: `${ext.description} already installed` });
        } else {
          steps.push({ name: `Install ${ext.name}`, success: false, message: `Failed to install ${ext.description}` });
        }
      }
    }

    // List installed extensions
    const listResult = await executeCommand("gh extension list", verbose);
    if (listResult.success) {
      const extensionsCount = listResult.output.split('\n').filter(line => line.trim()).length;
      steps.push({ name: "List extensions", success: true, message: `${extensionsCount} extensions installed` });
    }

    return { success: steps.filter(s => !s.success).length === 0, steps };
  } catch (err) {
    steps.push({ name: "Install extensions", success: false, message: err instanceof Error ? err.message : String(err) });
    return { success: false, steps };
  }
}

/**
 * Verify GitHub CLI extensions
 */
export async function verifyGhExtensions(verbose: boolean = false): Promise<GhExtensionsResult> {
  const steps: Array<{ name: string; success: boolean; message: string }> = [];

  try {
    // Check if gh is installed
    const ghCheck = await executeCommand("command -v gh");
    if (!ghCheck.success) {
      steps.push({ name: "Check GitHub CLI", success: false, message: "GitHub CLI not installed" });
      return { success: false, steps };
    }

    // List installed extensions
    const listResult = await executeCommand("gh extension list", verbose);
    if (listResult.success) {
      const extensions = listResult.output.split('\n').filter(line => line.trim());
      steps.push({ name: "Extensions list", success: true, message: `${extensions.length} extensions installed` });

      // Check for specific extensions
      const expectedExtensions = ["gh-select", "gh-copilot", "gh-dash", "gh-sponsors"];
      for (const ext of expectedExtensions) {
        const hasExtension = extensions.some(line => line.includes(ext));
        steps.push({
          name: `Check ${ext}`,
          success: hasExtension,
          message: hasExtension ? `${ext} is installed` : `${ext} is not installed`
        });
      }
    } else {
      steps.push({ name: "Extensions list", success: false, message: "Failed to list extensions" });
    }

    return { success: steps.filter(s => !s.success).length === 0, steps };
  } catch (err) {
    steps.push({ name: "Verify extensions", success: false, message: err instanceof Error ? err.message : String(err) });
    return { success: false, steps };
  }
}
