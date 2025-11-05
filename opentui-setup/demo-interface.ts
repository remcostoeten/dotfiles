#!/usr/bin/env bun
/**
 * Demo of the Interactive OpenTUI Setup Interface
 */

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

function showDemo() {
  console.clear();

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

  console.log(`\n${colors.green}✨ Features:${colors.reset}`);
  console.log(`${colors.white}• Beautiful colored terminal interface${colors.reset}`);
  console.log(`${colors.white}• Interactive package management${colors.reset}`);
  console.log(`${colors.white}• Category-based selection${colors.reset}`);
  console.log(`${colors.white}• Real-time installation status${colors.reset}`);
  console.log(`${colors.white}• System configuration options${colors.reset}`);
  console.log(`${colors.white}• Dry run mode for testing${colors.reset}`);
  console.log(`${colors.white}• Verbose output options${colors.reset}`);

  console.log(`\n${colors.yellow}🎯 Usage:${colors.reset}`);
  console.log(`${colors.cyan}bun run interactive${colors.reset} ${colors.dim}# Start interactive setup${colors.reset}`);
  console.log(`${colors.cyan}bun run cli${colors.reset} ${colors.dim}# Run non-interactive CLI setup${colors.reset}`);
  console.log(`${colors.cyan}bun run manager${colors.reset} ${colors.dim}# Individual package management${colors.reset}`);

  console.log(`\n${colors.magenta}💡 This demo shows the interface. Run 'bun run interactive' in a real terminal to use it!${colors.reset}`);
}

showDemo();
