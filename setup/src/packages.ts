/**
 * Package definitions - recreated from old-setup.sh
 */

import type { Category, Package } from "./types";

const createPackage = (
  id: string,
  name: string,
  displayName: string,
  method: Package["method"],
  extra?: string
): Package => ({
  id,
  name,
  displayName,
  method,
  extra,
  status: "pending",
});

export const categories: Category[] = [
  {
    id: "essential",
    name: "Essential Packages",
    description: "Core system packages required for development",
    selected: false,
    packages: [
      createPackage("git", "git", "Git", "apt"),
      createPackage("curl", "curl", "cURL", "apt"),
      createPackage("wget", "wget", "wget", "apt"),
      createPackage("build-essential", "build-essential", "Build Essential", "apt"),
      createPackage("ca-certificates", "ca-certificates", "CA Certificates", "apt"),
      createPackage("gnupg", "gnupg", "GnuPG", "apt"),
      createPackage("software-properties-common", "software-properties-common", "Software Properties Common", "apt"),
      createPackage("fish", "fish", "Fish Shell", "apt"),
    ],
  },
  {
    id: "languages",
    name: "Programming Languages",
    description: "Programming languages and runtimes",
    selected: false,
    packages: [
      createPackage("python3", "python3", "Python 3", "apt"),
      createPackage("python3-pip", "python3-pip", "Python pip", "apt"),
      createPackage("python3-venv", "python3-venv", "Python venv", "apt"),
      createPackage("nodejs", "nodejs", "Node.js", "apt"),
      createPackage("zig", "zig", "Zig Programming Language", "apt"),
    ],
  },
  {
    id: "editors",
    name: "Code Editors",
    description: "Text editors and IDEs",
    selected: false,
    packages: [
      createPackage("neovim", "neovim", "Neovim", "apt"),
      createPackage("vim", "vim", "Vim", "apt"),
      { ...createPackage("code", "code", "Visual Studio Code", "snap"), flags: "--classic" },
    ],
  },
  {
    id: "terminal-emulators",
    name: "Terminal Emulators",
    description: "Modern terminal emulators",
    selected: false,
    packages: [
      createPackage("kitty", "kitty", "Kitty Terminal", "apt"),
      createPackage("ghostty", "ghostty", "Ghostty Terminal", "github", "ghostty-org/ghostty"),
        ],
  },
  {
    id: "package-managers",
    name: "Package Managers",
    description: "Additional package managers",
    selected: false,
    packages: [
      createPackage("npm", "npm", "npm (Node Package Manager)", "apt"),
      createPackage("pnpm", "pnpm", "pnpm", "curl", "https://get.pnpm.io/install.sh"),
      createPackage("bun", "bun", "Bun", "curl", "https://bun.sh/install"),
    ],
  },
  {
    id: "git-tools",
    name: "Git Tools",
    description: "Git utilities and helpers",
    selected: false,
    packages: [
      createPackage("gh", "gh", "GitHub CLI", "apt"),
      createPackage("lazygit", "lazygit", "lazygit", "github", "jesseduffield/lazygit"),
      createPackage("lazydocker", "lazydocker", "lazydocker", "github", "jesseduffield/lazydocker"),
    ],
  },
  {
    id: "cli-utils",
    name: "CLI Utilities",
    description: "Modern command-line tools",
    selected: false,
    packages: [
      createPackage("ripgrep", "ripgrep", "ripgrep", "apt"),
      createPackage("fd-find", "fd-find", "fd", "apt"),
      createPackage("fzf", "fzf", "fzf", "apt"),
      createPackage("zoxide", "zoxide", "zoxide", "apt"),
      createPackage("eza", "eza", "eza", "apt"),
      createPackage("bat", "bat", "bat", "apt"),
      createPackage("htop", "htop", "htop", "apt"),
      createPackage("tree", "tree", "tree", "apt"),
      createPackage("jq", "jq", "jq", "apt"),
      createPackage("unzip", "unzip", "unzip", "apt"),
      createPackage("zip", "zip", "zip", "apt"),
      createPackage("xclip", "xclip", "xclip", "apt"),
      createPackage("wl-clipboard", "wl-clipboard", "wl-clipboard", "apt"),
      createPackage("bc", "bc", "bc", "apt"),
      createPackage("libnotify-bin", "libnotify-bin", "libnotify-bin", "apt"),
    ],
  },
  {
    id: "browsers",
    name: "Web Browsers",
    description: "Web browsers",
    selected: false,
    packages: [
      createPackage("firefox", "firefox", "Firefox", "snap"),
      createPackage("zen-browser", "zen-browser", "Zen Browser", "apt"),
      createPackage("microsoft-edge-stable", "microsoft-edge-stable", "Microsoft Edge", "apt"),
      createPackage("brave-browser", "brave-browser", "Brave Browser", "apt"),
    ],
  },
  {
    id: "communication",
    name: "Communication Apps",
    description: "Chat and communication applications",
    selected: false,
    packages: [
      createPackage("whatsapp-for-linux", "whatsapp-for-linux", "WhatsApp", "snap"),
      createPackage("signal-desktop", "signal-desktop", "Signal", "snap"),
      createPackage("simplenote", "simplenote", "Simplenote", "snap"),
    ],
  },
  {
    id: "media",
    name: "Media & Graphics",
    description: "Media players and graphics tools",
    selected: false,
    packages: [
      createPackage("vlc", "vlc", "VLC Media Player", "apt"),
      createPackage("obs-studio", "obs-studio", "OBS Studio", "apt"),
      createPackage("ffmpeg", "ffmpeg", "FFmpeg", "apt"),
      createPackage("spotify", "spotify", "Spotify", "snap"),
    ],
  },
  {
    id: "devops",
    name: "DevOps Tools",
    description: "Container and DevOps tools",
    selected: false,
    packages: [
      createPackage("docker.io", "docker.io", "Docker", "apt"),
      createPackage("docker-compose", "docker-compose", "Docker Compose", "apt"),
    ],
  },
  {
    id: "system",
    name: "System Utilities",
    description: "System monitoring and utilities",
    selected: false,
    packages: [
      createPackage("btop", "btop", "btop", "apt"),
      createPackage("neofetch", "neofetch", "neofetch", "apt"),
      createPackage("timeshift", "timeshift", "Timeshift", "apt"),
    ],
  },
  {
    id: "hardware",
    name: "Hardware Tools",
    description: "Hardware management tools",
    selected: false,
    packages: [
      createPackage("openrgb", "openrgb", "OpenRGB", "apt"),
      createPackage("nvidia-driver-535", "nvidia-driver-535", "NVIDIA Driver", "apt"),
      createPackage("nvidia-settings", "nvidia-settings", "NVIDIA Settings", "apt"),
      createPackage("nvidia-utils", "nvidia-utils", "NVIDIA Utils", "apt"),
    ],
  },
  {
    id: "automation",
    name: "Automation Tools",
    description: "Automation and testing tools",
    selected: false,
    packages: [
      createPackage("xdotool", "xdotool", "xdotool", "apt"),
      createPackage("ydotool", "ydotool", "ydotool", "apt"),
    ],
  },
  {
    id: "gnome",
    name: "GNOME Tools",
    description: "GNOME desktop environment tools",
    selected: false,
    packages: [
      createPackage("gnome-shell-extensions", "gnome-shell-extensions", "GNOME Shell Extensions", "apt"),
      createPackage("dconf-cli", "dconf-cli", "dconf CLI", "apt"),
      createPackage("ulauncher", "ulauncher", "U Launcher", "apt"),
    ],
  },
  {
    id: "curl-tools",
    name: "Tools (via curl)",
    description: "Tools installed via curl scripts",
    selected: false,
    packages: [
      createPackage("starship", "starship", "Starship", "curl", "https://starship.rs/install.sh"),
      createPackage("nvm", "nvm", "nvm", "curl", "https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh"),
      createPackage("rust", "rust", "Rust (via rustup)", "curl", "https://sh.rustup.rs"),
      createPackage("golang", "golang", "Golang (via g-install)", "curl", "https://git.io/g-install"),
      createPackage("turso", "turso", "Turso", "curl", "https://get.tur.so/install.sh"),
      createPackage("uvx", "uv", "uvx", "curl", "https://astral.sh/uv/install.sh"),
      createPackage("vercel", "vercel", "Vercel CLI", "curl", "https://vercel.com/cli.sh"),
      createPackage("netlify", "netlify", "Netlify CLI", "curl", "https://cli.netlify.com/install.sh"),
      createPackage("claude-desktop", "claude-desktop", "Claude Desktop", "curl", "https://claude.ai/install.sh"),
    ],
  },
  {
    id: "npm-tools",
    name: "NPM CLI Tools",
    description: "CLI tools installed via npm",
    selected: false,
    packages: [
      createPackage("gemini-cli", "gemini-cli", "Gemini CLI", "npm"),
    ],
  },
  {
    id: "android",
    name: "Android Development",
    description: "Android Studio and emulator tools",
    selected: false,
    packages: [
      { ...createPackage("android-studio", "android-studio", "Android Studio", "snap"), flags: "--classic" },
      createPackage("android-emulator-setup", "Android Emulator Setup", "Android Emulator Configuration", "script", "../scripts/setup-android-emulator.sh"),
    ],
  },
  {
    id: "desktop-setup",
    name: "Desktop Environment Setup",
    description: "Desktop environment configuration and theming",
    selected: false,
    packages: [
      createPackage("gnome-aesthetic", "GNOME Aesthetic Setup", "GNOME Themes & Extensions Configuration", "script", "../configs/gnome/setup-aesthetic-gnome.sh"),
      createPackage("gnome-extensions", "Install GNOME Extensions", "Essential GNOME Extensions", "script", "../configs/gnome/install-extensions.sh"),
      createPackage("gtk-styling", "Apply GTK Styling", "GTK Theme and Icon Configuration", "script", "../configs/gnome/apply-gtk-styling.sh"),
    ],
  },
  {
    id: "environment-setup",
    name: "Environment Configuration",
    description: "Environment variables and shell configuration",
    selected: false,
    packages: [
      createPackage("env-setup", "Environment Setup", "Private environment variables via submodules", "script", "../bin/setup-env"),
    ],
  },
  ];

export const getPackageById = (id: string): Package | undefined => {
  for (const category of categories) {
    const pkg = category.packages.find((p) => p.id === id);
    if (pkg) return pkg;
  }
  return undefined;
};

export const getCategoryById = (id: string): Category | undefined => {
  return categories.find((c) => c.id === id);
};

export const getAllPackages = (): Package[] => {
  return categories.flatMap((c) => c.packages);
};

export const getSelectedPackages = (): Package[] => {
  return categories
    .filter((c) => c.selected)
    .flatMap((c) => c.packages);
};

/**
 * Select essential categories for a complete development setup
 */
export const selectEssentialCategories = (): void => {
  const essentialCategoryIds = [
    "essential",
    "languages",
    "editors",
    "terminal-emulators",
    "package-managers",
    "git-tools",
    "cli-utils",
    "curl-tools",
    "npm-tools"
  ];

  categories.forEach((category) => {
    if (essentialCategoryIds.includes(category.id)) {
      category.selected = true;
    }
  });
};

/**
 * Get all essential packages
 */
export const getEssentialPackages = (): Package[] => {
  selectEssentialCategories();
  return getSelectedPackages();
};
