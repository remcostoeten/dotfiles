export interface Package {
  id: string;
  name: string;
  description: string;
  category: string;
}

export const packages: Package[] = [
  // Essential
  { id: "git", name: "Git", description: "Version control system", category: "essential" },
  { id: "curl", name: "cURL", description: "Command line tool for transferring data", category: "essential" },
  { id: "wget", name: "wget", description: "Network downloader", category: "essential" },
  { id: "build-essential", name: "Build Essential", description: "Compilation tools", category: "essential" },
  
  // Languages
  { id: "python3", name: "Python 3", description: "Python programming language", category: "languages" },
  { id: "nodejs", name: "Node.js", description: "JavaScript runtime", category: "languages" },
  { id: "zig", name: "Zig", description: "Zig programming language", category: "languages" },
  
  // Editors
  { id: "neovim", name: "Neovim", description: "Hyperextensible Vim-based text editor", category: "editors" },
  { id: "vscode", name: "VS Code", description: "Visual Studio Code", category: "editors" },
  
  // CLI Tools
  { id: "ripgrep", name: "ripgrep", description: "Fast grep alternative", category: "cli" },
  { id: "fzf", name: "fzf", description: "Fuzzy finder", category: "cli" },
  { id: "bat", name: "bat", description: "Cat clone with syntax highlighting", category: "cli" },
  { id: "eza", name: "eza", description: "Modern ls replacement", category: "cli" },
  { id: "zoxide", name: "zoxide", description: "Smarter cd command", category: "cli" },
  
  // Tools
  { id: "bun", name: "Bun", description: "Fast JavaScript runtime", category: "tools" },
  { id: "pnpm", name: "pnpm", description: "Fast, disk space efficient package manager", category: "tools" },
  { id: "starship", name: "Starship", description: "Cross-shell prompt", category: "tools" },
];
