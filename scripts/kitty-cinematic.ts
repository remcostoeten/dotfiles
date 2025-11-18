#!/usr/bin/env bun
// DOCSTRING: Toggle kitty cinematic mode for enhanced recordings and demos

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import readline from 'readline';

const DOTFILES_DATA_DIR = process.env.HOME + '/.dotfiles';
const KITTY_CINEMATIC_DIR = join(DOTFILES_DATA_DIR, 'kitty-cinematic');
const STATE_FILE = join(KITTY_CINEMATIC_DIR, 'state.json');
const KITTY_CONF = process.env.HOME + '/.config/kitty/kitty.conf';
const DOTFILES_KITTY_CONF = process.env.HOME + '/.config/dotfiles/configs/kitty/kitty.conf';
const KITTY_ASSETS_DIR = process.env.HOME + '/.config/dotfiles/configs/kitty/assets';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  red: '\x1b[31m',
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

type State = {
  enabled: boolean;
  lastToggled?: string;
  background?: string;
};

function ensureDataDir(): void {
  if (!existsSync(KITTY_CINEMATIC_DIR)) {
    mkdirSync(KITTY_CINEMATIC_DIR, { recursive: true });
  }
}

function loadState(): State {
  ensureDataDir();
  if (existsSync(STATE_FILE)) {
    try {
      const content = readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(content);
    } catch {
      return { enabled: false };
    }
  }
  return { enabled: false };
}

function saveState(state: State): void {
  ensureDataDir();
  state.lastToggled = new Date().toISOString();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getConfigPath(): string {
  // Check if dotfiles config exists (for development/testing)
  if (existsSync(DOTFILES_KITTY_CONF)) {
    return DOTFILES_KITTY_CONF;
  }
  // Fall back to actual kitty config
  if (existsSync(KITTY_CONF)) {
    return KITTY_CONF;
  }
  throw new Error('Kitty config file not found');
}

function isCinematicModeEnabled(configPath: string): boolean {
  if (!existsSync(configPath)) {
    return false;
  }
  const content = readFileSync(configPath, 'utf-8');
  // Check if the include line is uncommented
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Match both commented and uncommented versions
    if (trimmed.includes('cinematic-mode.conf')) {
      return !trimmed.startsWith('#');
    }
  }
  return false;
}

function toggleCinematicMode(enabled: boolean): boolean {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    console.error(colorize(`Error: Config file not found: ${configPath}`, 'red'));
    return false;
  }

  const content = readFileSync(configPath, 'utf-8');
  const lines = content.split('\n');
  let modified = false;

  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.includes('cinematic-mode.conf')) {
      modified = true;
      if (enabled) {
        // Uncomment the line
        return line.replace(/^\s*#\s*include/, 'include');
      } else {
        // Comment the line
        if (!trimmed.startsWith('#')) {
          // Find the indentation
          const indent = line.match(/^(\s*)/)?.[1] || '';
          return `${indent}# include cinematic-mode.conf`;
        }
        return line;
      }
    }
    return line;
  });

  if (!modified) {
    // If the line doesn't exist, add it
    // Find a good place to insert it (after theme section)
    let insertIndex = -1;
    for (let i = 0; i < newLines.length; i++) {
      if (newLines[i].includes('END_KITTY_THEME')) {
        insertIndex = i + 1;
        break;
      }
    }
    if (insertIndex === -1) {
      insertIndex = newLines.length;
    }

    const indent = '    '; // Match typical indentation
    if (enabled) {
      newLines.splice(insertIndex, 0, `${indent}include cinematic-mode.conf`);
    } else {
      newLines.splice(insertIndex, 0, `${indent}# include cinematic-mode.conf`);
    }
  }

  writeFileSync(configPath, newLines.join('\n'));
  return true;
}

function getAvailableBackgrounds(): string[] {
  if (!existsSync(KITTY_ASSETS_DIR)) {
    return [];
  }
  try {
    const files = readdirSync(KITTY_ASSETS_DIR);
    return files
      .filter(f => f.match(/\.(png|jpg|jpeg|gif|webp)$/i))
      .map(f => basename(f, f.match(/\.(png|jpg|jpeg|gif|webp)$/i)?.[0] || ''));
  } catch {
    return [];
  }
}

function getBackgroundImagePath(name: string): string | null {
  if (!existsSync(KITTY_ASSETS_DIR)) {
    return null;
  }
  const files = readdirSync(KITTY_ASSETS_DIR);
  const match = files.find(f => {
    const base = basename(f, f.match(/\.(png|jpg|jpeg|gif|webp)$/i)?.[0] || '');
    return base === name || f === name || f.startsWith(name);
  });
  if (match) {
    return join(KITTY_ASSETS_DIR, match);
  }
  return null;
}

function getCurrentBackground(configPath: string): string | null {
  if (!existsSync(configPath)) {
    return null;
  }
  const content = readFileSync(configPath, 'utf-8');
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('background_image')) {
      const match = trimmed.match(/background_image\s+(.+)/);
      if (match && match[1] && match[1] !== 'none') {
        const path = match[1].trim();
        // Extract just the filename
        const filename = basename(path);
        const name = basename(filename, filename.match(/\.(png|jpg|jpeg|gif|webp)$/i)?.[0] || '');
        return name;
      }
      return null;
    }
  }
  return null;
}

function setBackgroundImage(name: string | null): boolean {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    console.error(colorize(`Error: Config file not found: ${configPath}`, 'red'));
    return false;
  }

  let imagePath: string | null = null;
  if (name && name !== 'none') {
    const bgPath = getBackgroundImagePath(name);
    if (!bgPath) {
      console.error(colorize(`Error: Background image "${name}" not found`, 'red'));
      console.log(colorize('\nAvailable backgrounds:', 'yellow'));
      const available = getAvailableBackgrounds();
      if (available.length === 0) {
        console.log(colorize('  (none found in assets directory)', 'gray'));
      } else {
        available.forEach(bg => console.log(colorize(`  • ${bg}`, 'gray')));
      }
      console.log('');
      return false;
    }
    imagePath = bgPath;
  }

  const content = readFileSync(configPath, 'utf-8');
  const lines = content.split('\n');
  
  // Remove all existing background_image lines and track where to insert
  let insertIndex = -1;
  const newLines: string[] = [];
  let foundBackgroundImage = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (trimmed.startsWith('background_image')) {
      foundBackgroundImage = true;
      // Skip this line (we'll add it back later)
      continue;
    }
    
    newLines.push(line);
    
    // Track where to insert (before background_tint or in visual enhancements section)
    if (trimmed.includes('background_tint')) {
      insertIndex = newLines.length; // Insert before background_tint
    } else if (!foundBackgroundImage && trimmed.includes('Visual enhancements')) {
      // If we haven't found background_image yet, mark this as potential insert point
      if (insertIndex === -1) {
        insertIndex = i + 2; // After the comment and first setting
      }
    }
  }

  // If we didn't find a good insert point, add it after background_tint or at end
  if (insertIndex === -1) {
    // Try to find background_tint in the new lines
    for (let i = 0; i < newLines.length; i++) {
      if (newLines[i].includes('background_tint')) {
        insertIndex = i + 1;
        break;
      }
    }
    if (insertIndex === -1) {
      // Find visual enhancements section
      for (let i = 0; i < newLines.length; i++) {
        if (newLines[i].includes('Visual enhancements')) {
          insertIndex = i + 2;
          break;
        }
      }
    }
    if (insertIndex === -1) {
      insertIndex = newLines.length;
    }
  }

  // Add the background_image line (match indentation of other settings)
  const bgLine = imagePath 
    ? `background_image ${imagePath}`
    : `background_image none`;
  newLines.splice(insertIndex, 0, bgLine);

  writeFileSync(configPath, newLines.join('\n'));
  return true;
}

function showStatus(): void {
  try {
    const configPath = getConfigPath();
    const enabled = isCinematicModeEnabled(configPath);
    const state = loadState();
    const currentBg = getCurrentBackground(configPath);

    console.log(colorize('\n🎬 Kitty Cinematic Mode Status\n', 'cyan'));
    console.log(`Mode: ${enabled ? colorize('ENABLED', 'green') : colorize('DISABLED', 'gray')}`);
    
    if (currentBg) {
      console.log(`Background: ${colorize(currentBg, 'green')}`);
    } else {
      console.log(`Background: ${colorize('none', 'gray')}`);
    }
    
    if (state.lastToggled) {
      const date = new Date(state.lastToggled);
      console.log(`Last toggled: ${date.toLocaleString()}`);
    }
    
    console.log(`Config file: ${configPath}`);
    console.log('');
    
    if (enabled) {
      console.log(colorize('Cinematic mode is active:', 'green'));
      console.log('  • Font: Hack Mono Nerd Font');
      console.log('  • Opacity: 100% (full opacity)');
      console.log('  • Line height: 110%');
      console.log('  • Letter spacing: 110%');
    } else {
      console.log(colorize('Cinematic mode is disabled', 'gray'));
      console.log('  • Using default font and spacing');
    }
    
    console.log('');
  } catch (error: any) {
    console.error(colorize(`\n✗ Error: ${error.message}\n`, 'red'));
    process.exit(1);
  }
}

function showHelp(): void {
  console.log(colorize('\n🎬 Kitty Cinematic Mode Toggle\n', 'cyan'));
  console.log(colorize('Usage: kitty-cinematic [command] [options]\n', 'bright'));
  console.log(colorize('Commands:', 'yellow'));
  console.log(colorize('  (no args)          Launch interactive menu', 'gray'));
  console.log(colorize('  on, enable         Enable cinematic mode', 'gray'));
  console.log(colorize('  off, disable       Disable cinematic mode', 'gray'));
  console.log(colorize('  toggle             Toggle between enabled/disabled', 'gray'));
  console.log(colorize('  status             Show current status', 'gray'));
  console.log(colorize('  bg <name>          Set background image', 'gray'));
  console.log(colorize('  bg list            List available backgrounds', 'gray'));
  console.log(colorize('  bg none            Remove background image', 'gray'));
  console.log(colorize('  help               Show this help message\n', 'gray'));
  console.log(colorize('What cinematic mode does:', 'yellow'));
  console.log(colorize('  • Changes font to Hack Mono Nerd Font', 'gray'));
  console.log(colorize('  • Increases opacity to 100% (from 85%)', 'gray'));
  console.log(colorize('  • Increases line height to 110%', 'gray'));
  console.log(colorize('  • Increases letter spacing to 110%', 'gray'));
  console.log(colorize('  • Optimized for recordings and demos\n', 'gray'));
  console.log(colorize('Background images:', 'yellow'));
  console.log(colorize('  Background images are stored in configs/kitty/assets/', 'gray'));
  console.log(colorize('  Use "bg list" to see available options\n', 'gray'));
  console.log(colorize('Note:', 'yellow'));
  console.log(colorize('  You may need to restart kitty or reload config', 'gray'));
  console.log(colorize('  to see changes. Use Ctrl+Shift+F5 in kitty.\n', 'gray'));
}

function createReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function prompt(question: string): Promise<string> {
  const rl = createReadline();
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function interactiveMenu(): Promise<void> {
  while (true) {
    // Refresh status on each loop iteration
    const configPath = getConfigPath();
    const enabled = isCinematicModeEnabled(configPath);
    const currentBg = getCurrentBackground(configPath);
    const backgrounds = getAvailableBackgrounds();

    console.clear();
    console.log(colorize('\n🎬 Kitty Cinematic Mode\n', 'cyan'));
    console.log(colorize('═'.repeat(50), 'gray'));
    
    // Show current status
    console.log(colorize('\nCurrent Status:', 'yellow'));
    console.log(`  Cinematic Mode: ${enabled ? colorize('ENABLED', 'green') : colorize('DISABLED', 'gray')}`);
    console.log(`  Background: ${currentBg ? colorize(currentBg, 'green') : colorize('none', 'gray')}`);
    
    console.log(colorize('\nOptions:', 'yellow'));
    console.log(colorize('  1. ', 'gray') + 'Toggle Cinematic Mode');
    console.log(colorize('  2. ', 'gray') + 'Set Background Image');
    console.log(colorize('  3. ', 'gray') + 'Remove Background');
    console.log(colorize('  4. ', 'gray') + 'Show Detailed Status');
    console.log(colorize('  5. ', 'gray') + 'Exit');
    
    console.log(colorize('\n' + '═'.repeat(50), 'gray'));
    
    const choice = await prompt(colorize('\nSelect option (1-5): ', 'cyan'));
    
    if (choice === '1') {
      const configPath = getConfigPath();
      const currentlyEnabled = isCinematicModeEnabled(configPath);
      const newState = !currentlyEnabled;
      const success = toggleCinematicMode(newState);
      if (success) {
        const state = loadState();
        saveState({ ...state, enabled: newState });
        console.log(colorize(`\n✓ Cinematic mode ${newState ? 'enabled' : 'disabled'}`, 'green'));
        console.log(colorize('💡 Restart kitty or reload config (Ctrl+Shift+F5) to apply changes', 'cyan'));
        await prompt(colorize('\nPress Enter to continue...', 'gray'));
      } else {
        console.error(colorize('\n✗ Failed to toggle cinematic mode', 'red'));
        await prompt(colorize('\nPress Enter to continue...', 'gray'));
      }
    } else if (choice === '2') {
      if (backgrounds.length === 0) {
        console.log(colorize('\n⚠ No backgrounds found in assets directory', 'yellow'));
        console.log(colorize(`  Location: ${KITTY_ASSETS_DIR}`, 'gray'));
        await prompt(colorize('\nPress Enter to continue...', 'gray'));
        continue;
      }
      
      console.clear();
      console.log(colorize('\n🖼️  Select Background Image\n', 'cyan'));
      console.log(colorize('═'.repeat(50), 'gray'));
      console.log(colorize('\nAvailable Backgrounds:', 'yellow'));
      backgrounds.forEach((bg, index) => {
        const marker = bg === currentBg ? colorize('✓ ', 'green') : '  ';
        console.log(`  ${marker}${index + 1}. ${bg}`);
      });
      console.log(`  ${backgrounds.length + 1}. Cancel`);
      console.log(colorize('\n' + '═'.repeat(50), 'gray'));
      
      const bgChoice = await prompt(colorize(`\nSelect background (1-${backgrounds.length + 1}): `, 'cyan'));
      const bgIndex = parseInt(bgChoice, 10) - 1;
      
      if (bgIndex >= 0 && bgIndex < backgrounds.length) {
        const selectedBg = backgrounds[bgIndex];
        const success = setBackgroundImage(selectedBg);
        if (success) {
          const state = loadState();
          saveState({ ...state, background: selectedBg });
          console.log(colorize(`\n✓ Background image set to: ${selectedBg}`, 'green'));
          console.log(colorize('💡 Restart kitty or reload config (Ctrl+Shift+F5) to apply changes', 'cyan'));
        } else {
          console.error(colorize('\n✗ Failed to set background image', 'red'));
        }
        await prompt(colorize('\nPress Enter to continue...', 'gray'));
      }
    } else if (choice === '3') {
      if (!currentBg) {
        console.log(colorize('\n⚠ No background image is currently set', 'yellow'));
        await prompt(colorize('\nPress Enter to continue...', 'gray'));
        continue;
      }
      
      const confirm = await prompt(colorize(`\nRemove background "${currentBg}"? (y/n): `, 'yellow'));
      if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
        const success = setBackgroundImage(null);
        if (success) {
          const state = loadState();
          saveState({ ...state, background: null });
          console.log(colorize('\n✓ Background image removed', 'green'));
          console.log(colorize('💡 Restart kitty or reload config (Ctrl+Shift+F5) to apply changes', 'cyan'));
        } else {
          console.error(colorize('\n✗ Failed to remove background image', 'red'));
        }
        await prompt(colorize('\nPress Enter to continue...', 'gray'));
      }
    } else if (choice === '4') {
      console.clear();
      showStatus();
      await prompt(colorize('\nPress Enter to continue...', 'gray'));
    } else if (choice === '5' || choice.toLowerCase() === 'q' || choice.toLowerCase() === 'exit') {
      console.log(colorize('\n👋 Goodbye!\n', 'cyan'));
      break;
    } else {
      console.log(colorize('\n⚠ Invalid option. Please try again.', 'yellow'));
      await prompt(colorize('\nPress Enter to continue...', 'gray'));
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase() || '';

  if (command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    process.exit(0);
  }

  // If no command provided, launch interactive menu
  if (command === '') {
    try {
      await interactiveMenu();
      process.exit(0);
    } catch (error: any) {
      console.error(colorize(`\n✗ Error: ${error.message}\n`, 'red'));
      process.exit(1);
    }
  }

  try {
    if (command === 'status') {
      showStatus();
    } else if (command === 'on' || command === 'enable') {
      const success = toggleCinematicMode(true);
      if (success) {
        const state = loadState();
        saveState({ ...state, enabled: true });
        console.log(colorize('\n✓ Cinematic mode enabled\n', 'green'));
        console.log(colorize('💡 Restart kitty or reload config (Ctrl+Shift+F5) to apply changes\n', 'cyan'));
      } else {
        console.error(colorize('\n✗ Failed to enable cinematic mode\n', 'red'));
        process.exit(1);
      }
    } else if (command === 'off' || command === 'disable') {
      const success = toggleCinematicMode(false);
      if (success) {
        const state = loadState();
        saveState({ ...state, enabled: false });
        console.log(colorize('\n✓ Cinematic mode disabled\n', 'green'));
        console.log(colorize('💡 Restart kitty or reload config (Ctrl+Shift+F5) to apply changes\n', 'cyan'));
      } else {
        console.error(colorize('\n✗ Failed to disable cinematic mode\n', 'red'));
        process.exit(1);
      }
    } else if (command === 'toggle') {
      const configPath = getConfigPath();
      const currentlyEnabled = isCinematicModeEnabled(configPath);
      const newState = !currentlyEnabled;
      const success = toggleCinematicMode(newState);
      if (success) {
        const state = loadState();
        saveState({ ...state, enabled: newState });
        console.log(colorize(`\n✓ Cinematic mode ${newState ? 'enabled' : 'disabled'}\n`, 'green'));
        console.log(colorize('💡 Restart kitty or reload config (Ctrl+Shift+F5) to apply changes\n', 'cyan'));
      } else {
        console.error(colorize('\n✗ Failed to toggle cinematic mode\n', 'red'));
        process.exit(1);
      }
    } else if (command === 'bg' || command === 'background') {
      const bgCommand = args[1]?.toLowerCase();
      
      if (!bgCommand || bgCommand === 'list') {
        // List available backgrounds
        const backgrounds = getAvailableBackgrounds();
        console.log(colorize('\n🖼️  Available Background Images\n', 'cyan'));
        if (backgrounds.length === 0) {
          console.log(colorize('  No backgrounds found in assets directory', 'gray'));
          console.log(colorize(`  Location: ${KITTY_ASSETS_DIR}\n`, 'gray'));
        } else {
          backgrounds.forEach(bg => {
            console.log(colorize(`  • ${bg}`, 'gray'));
          });
          console.log('');
        }
      } else if (bgCommand === 'none') {
        // Remove background
        const success = setBackgroundImage(null);
        if (success) {
          const state = loadState();
          saveState({ ...state, background: null });
          console.log(colorize('\n✓ Background image removed\n', 'green'));
          console.log(colorize('💡 Restart kitty or reload config (Ctrl+Shift+F5) to apply changes\n', 'cyan'));
        } else {
          console.error(colorize('\n✗ Failed to remove background image\n', 'red'));
          process.exit(1);
        }
      } else {
        // Set background
        const success = setBackgroundImage(bgCommand);
        if (success) {
          const state = loadState();
          saveState({ ...state, background: bgCommand });
          console.log(colorize(`\n✓ Background image set to: ${bgCommand}\n`, 'green'));
          console.log(colorize('💡 Restart kitty or reload config (Ctrl+Shift+F5) to apply changes\n', 'cyan'));
        } else {
          process.exit(1);
        }
      }
    } else {
      console.error(colorize(`\n✗ Unknown command: ${command}\n`, 'red'));
      showHelp();
      process.exit(1);
    }
  } catch (error: any) {
    console.error(colorize(`\n✗ Error: ${error.message}\n`, 'red'));
    process.exit(1);
  }
}

main();

