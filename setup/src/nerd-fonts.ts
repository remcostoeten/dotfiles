/**
 * Nerd Fonts Installation - Downloads ALL Nerd Fonts from latest release
 */

import { executeCommand } from "./executor";

export interface NerdFontsResult {
  success: boolean;
  message: string;
}

const INSTALL_DIR = `${process.env.HOME}/.local/share/fonts/nerd-fonts-latest`;
const NERD_FONTS_REPO = "ryanoasis/nerd-fonts";

/**
 * Install ALL Nerd Fonts from latest GitHub release
 */
export async function installNerdFonts(): Promise<NerdFontsResult> {
  try {
    // Fetch latest release tag
    const tagResult = await executeCommand(
      `curl -s "https://api.github.com/repos/${NERD_FONTS_REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\\1/'`
    );

    if (!tagResult.success || !tagResult.output.trim()) {
      return {
        success: false,
        message: "Could not retrieve latest Nerd Fonts release from GitHub",
      };
    }

    const latestTag = tagResult.output.trim();

    // Create temporary directory
    const tmpDirResult = await executeCommand("mktemp -d");
    if (!tmpDirResult.success) {
      return {
        success: false,
        message: "Failed to create temporary directory",
      };
    }

    const tmpDir = tmpDirResult.output.trim();

    try {
      // Download all .zip font archives
      const downloadResult = await executeCommand(`
        cd "${tmpDir}" && \
        curl -s "https://api.github.com/repos/${NERD_FONTS_REPO}/releases/latest" | \
        grep -oP '"browser_download_url": "\\K[^"]*\\.zip(?=")' | \
        xargs -I {} curl -fLo "$(basename {})" {}
      `);

      if (!downloadResult.success) {
        await executeCommand(`rm -rf "${tmpDir}"`);
        return {
          success: false,
          message: "Failed to download Nerd Fonts archives",
        };
      }

      // Create install directory
      await executeCommand(`mkdir -p "${INSTALL_DIR}"`);

      // Extract all fonts
      const extractResult = await executeCommand(`
        cd "${tmpDir}" && \
        for f in *.zip; do
          font_name_dir="\${f%.*}"
          target_subdir="${INSTALL_DIR}/\$font_name_dir"
          mkdir -p "\$target_subdir"
          unzip -q "\$f" -d "\$target_subdir"
        done
      `);

      if (!extractResult.success) {
        await executeCommand(`rm -rf "${tmpDir}"`);
        return {
          success: false,
          message: "Failed to extract Nerd Fonts",
        };
      }

      // Update font cache
      await executeCommand("fc-cache -fv");

      // Cleanup
      await executeCommand(`rm -rf "${tmpDir}"`);

      // Count installed fonts
      const countResult = await executeCommand(`find "${INSTALL_DIR}" -name "*.ttf" -o -name "*.otf" | wc -l`);
      const fontCount = parseInt(countResult.output.trim()) || 0;

      return {
        success: true,
        message: `Installed ALL Nerd Fonts (${latestTag}) - ${fontCount} font files in ${INSTALL_DIR}`,
      };
    } catch (err) {
      // Cleanup on error
      await executeCommand(`rm -rf "${tmpDir}"`);
      throw err;
    }
  } catch (err) {
    return {
      success: false,
      message: `Failed to install Nerd Fonts: ${err}`,
    };
  }
}

/**
 * Set Fish as default shell
 */
export async function setFishAsDefault(): Promise<{ success: boolean; message: string }> {
  try {
    // Check if fish is installed
    const fishCheck = await executeCommand("command -v fish");
    if (!fishCheck.success) {
      return {
        success: false,
        message: "Fish shell not installed",
      };
    }

    // Check current shell
    const currentShell = await executeCommand("echo $SHELL");
    if (currentShell.output.includes("fish")) {
      return {
        success: true,
        message: "Fish is already the default shell",
      };
    }

    // Set fish as default
    const fishPath = fishCheck.output.trim();
    const chshResult = await executeCommand(`chsh -s ${fishPath}`);

    if (chshResult.success) {
      return {
        success: true,
        message: "Fish set as default shell (restart terminal to apply)",
      };
    } else {
      return {
        success: false,
        message: "Failed to set fish as default (may require logout/login)",
      };
    }
  } catch (err) {
    return {
      success: false,
      message: `Failed to set fish as default: ${err}`,
    };
  }
}
