#!/usr/bin/env bun
// DOCSTRING: Time command execution and optionally save results to JSON

import { spawn, execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const DOTFILES_DATA_DIR = process.env.HOME + '/.dotfiles';
const TIMER_DIR = join(DOTFILES_DATA_DIR, 'timer');
const HISTORY_FILE = join(TIMER_DIR, 'history.json');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

type TimingResult = {
  command: string;
  duration: number;
  exitCode: number;
  savedPath?: string;
};

function showHelp(): void {
  console.log(colorize('\n⏱️  Timer - Command Execution Timer\n', 'cyan'));
  console.log(colorize('Usage: timer [options] <command...>\n', 'bright'));
  console.log(colorize('Options:', 'yellow'));
  console.log(colorize('  --save, -s          Save timing data to JSON file', 'gray'));
  console.log(colorize('  --no-output, -n    Suppress command output (only show timer)', 'gray'));
  console.log(colorize('  --clipboard, -c    Copy results to clipboard', 'gray'));
  console.log(colorize('  --history, -h      Show recent comparison history', 'gray'));
  console.log(colorize('  --help             Show this help message\n', 'gray'));
  console.log(colorize('Examples:', 'yellow'));
  console.log(colorize('  timer rmall ; bun install ; bun run build', 'gray'));
  console.log(colorize('  timer --save bun run build', 'gray'));
  console.log(colorize('  timer --clipboard rmall ; bun install , rmall ; pnpm install', 'gray'));
  console.log(colorize('  timer --no-output --save "npm test"\n', 'gray'));
  console.log(colorize('Note:', 'yellow'));
  console.log(colorize('  Use comma (,) to separate commands for comparison', 'gray'));
}

function extractCommandName(command: string): string {
  // Extract first command name (before ; && || or first word)
  const firstPart = command.split(/[;&|]/)[0].trim();
  const firstWord = firstPart.split(/\s+/)[0];
  return firstWord || 'unknown';
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(2);
    return `${minutes}m ${seconds}s`;
  }
}

function formatComparisonText(results: TimingResult[]): string {
  if (results.length === 0) return '';

  const lines: string[] = [];
  lines.push('═'.repeat(80));
  lines.push('📊 Comparison Results');
  lines.push('═'.repeat(80));

  // Find fastest and slowest
  const fastest = Math.min(...results.map(r => r.duration));
  const slowest = Math.max(...results.map(r => r.duration));

  results.forEach((result, index) => {
    const isFastest = result.duration === fastest && results.length > 1;
    const isSlowest = result.duration === slowest && results.length > 1 && fastest !== slowest;
    
    const statusIcon = result.exitCode === 0 ? '✓' : '✗';
    const status = result.exitCode === 0 ? 'Success' : 'Failed';
    
    lines.push(`\n${index + 1}. ${result.command}`);
    lines.push(`   ${statusIcon} Status: ${status}`);
    
    let durationDisplay = formatDuration(result.duration);
    if (isFastest) {
      durationDisplay = `⚡ ${durationDisplay} (fastest)`;
    } else if (isSlowest) {
      durationDisplay = `🐌 ${durationDisplay} (slowest)`;
    } else {
      durationDisplay = `⏱️  ${durationDisplay}`;
    }
    lines.push(`   ${durationDisplay}`);
    
    if (results.length > 1 && !isFastest) {
      const diff = result.duration - fastest;
      const percentDiff = ((diff / fastest) * 100).toFixed(1);
      lines.push(`   📈 +${formatDuration(diff)} (+${percentDiff}%)`);
    }
    
    if (result.savedPath) {
      lines.push(`   💾 ${result.savedPath}`);
    }
  });

  if (results.length > 1) {
    const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
    lines.push('\n' + '─'.repeat(80));
    lines.push(`   Total time: ${formatDuration(totalTime)}`);
    lines.push(`   Average: ${formatDuration(totalTime / results.length)}`);
  }

  lines.push('\n' + '═'.repeat(80));
  return lines.join('\n');
}

function displayComparison(results: TimingResult[]): void {
  if (results.length === 0) return;
  const text = formatComparisonText(results);
  console.log(colorize('\n' + text + '\n', 'cyan'));
}

function copyToClipboard(text: string): boolean {
  try {
    const platform = process.platform;
    
    if (platform === 'linux') {
      // Try xclip first (X11)
      try {
        execSync('which xclip', { stdio: 'ignore' });
        const proc = spawn('xclip', ['-selection', 'clipboard'], { stdio: 'pipe' });
        proc.stdin.write(text);
        proc.stdin.end();
        return true;
      } catch {
        // Try wl-copy (Wayland)
        try {
          execSync('which wl-copy', { stdio: 'ignore' });
          const proc = spawn('wl-copy', [], { stdio: 'pipe' });
          proc.stdin.write(text);
          proc.stdin.end();
          return true;
        } catch {
          return false;
        }
      }
    } else if (platform === 'darwin') {
      const proc = spawn('pbcopy', [], { stdio: 'pipe' });
      proc.stdin.write(text);
      proc.stdin.end();
      return true;
    } else if (platform === 'win32') {
      const proc = spawn('clip', [], { stdio: 'pipe' });
      proc.stdin.write(text);
      proc.stdin.end();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function saveToHistory(results: TimingResult[]): void {
  if (!existsSync(TIMER_DIR)) {
    mkdirSync(TIMER_DIR, { recursive: true });
  }

  let history: Array<{
    timestamp: string;
    commands: string[];
    results: TimingResult[];
  }> = [];

  if (existsSync(HISTORY_FILE)) {
    try {
      const content = readFileSync(HISTORY_FILE, 'utf-8');
      history = JSON.parse(content);
    } catch {
      // If file is corrupted, start fresh
      history = [];
    }
  }

  history.unshift({
    timestamp: new Date().toISOString(),
    commands: results.map(r => r.command),
    results: results.map(r => ({
      command: r.command,
      duration: r.duration,
      exitCode: r.exitCode,
      savedPath: r.savedPath,
    })),
  });

  // Keep only last 50 entries
  if (history.length > 50) {
    history = history.slice(0, 50);
  }

  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function showHistory(limit: number = 10): void {
  if (!existsSync(HISTORY_FILE)) {
    console.log(colorize('\n📜 No history found\n', 'yellow'));
    return;
  }

  try {
    const content = readFileSync(HISTORY_FILE, 'utf-8');
    const history: Array<{
      timestamp: string;
      commands: string[];
      results: TimingResult[];
    }> = JSON.parse(content);

    if (history.length === 0) {
      console.log(colorize('\n📜 No history found\n', 'yellow'));
      return;
    }

    const displayHistory = history.slice(0, limit);

    console.log(colorize('\n' + '═'.repeat(80), 'cyan'));
    console.log(colorize(`📜 Recent Comparison History (showing ${displayHistory.length} of ${history.length})`, 'bright'));
    console.log(colorize('═'.repeat(80), 'cyan'));

    displayHistory.forEach((entry, index) => {
      const date = new Date(entry.timestamp);
      const dateStr = date.toLocaleDateString();
      const timeStr = date.toLocaleTimeString();

      console.log(colorize(`\n${index + 1}. ${dateStr} ${timeStr}`, 'bright'));
      entry.results.forEach((result, i) => {
        const statusIcon = result.exitCode === 0 ? '✓' : '✗';
        console.log(`   ${statusIcon} ${result.command}`);
        console.log(`      ⏱️  ${formatDuration(result.duration)}`);
      });
    });

    console.log(colorize('\n' + '═'.repeat(80) + '\n', 'cyan'));
    console.log(colorize('💡 Use --clipboard with a command to copy results to clipboard', 'gray'));
    console.log(colorize('💡 History is automatically saved for all comparisons\n', 'gray'));
  } catch (error) {
    console.error(colorize(`\n✗ Error reading history: ${error}\n`, 'yellow'));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseCommands(input: string): string[] {
  // Split by comma, but preserve commas inside quotes
  const commands: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    
    if ((char === '"' || char === "'") && (i === 0 || input[i - 1] !== '\\')) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      }
      current += char;
    } else if (char === ',' && !inQuotes) {
      const trimmed = current.trim();
      if (trimmed) {
        commands.push(trimmed);
      }
      current = '';
    } else {
      current += char;
    }
  }

  const trimmed = current.trim();
  if (trimmed) {
    commands.push(trimmed);
  }

  return commands.length > 0 ? commands : [input];
}

async function executeCommand(
  command: string,
  options: { save: boolean; noOutput: boolean },
  index?: number,
  total?: number
): Promise<TimingResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let endTime: number;
    let exitCode = 0;
    let savedPath: string | undefined;

    const prefix = total && total > 1 ? colorize(`[${index}/${total}] `, 'cyan') : '';

    console.log(colorize(`\n${prefix}▶️  Executing: ${command}\n`, 'bright'));

    // Use shell to execute the command (supports ; && || etc.)
    const shell = process.env.SHELL || '/bin/bash';
    const child = spawn(shell, ['-c', command], {
      stdio: options.noOutput ? 'pipe' : 'inherit',
      env: process.env,
    });

    child.on('error', (error) => {
      console.error(colorize(`\n✗ Error executing command: ${error.message}`, 'yellow'));
      endTime = Date.now();
      const duration = endTime - startTime;
      console.log(
        colorize(`\n⏱️  Duration: ${formatDuration(duration)}`, 'cyan')
      );
      if (options.save) {
        savedPath = saveToJson(command, duration, 1);
      }
      resolve({ command, duration, exitCode: 1, savedPath });
    });

    child.on('exit', (code) => {
      endTime = Date.now();
      exitCode = code || 0;
      const duration = endTime - startTime;

      console.log(
        colorize(`\n⏱️  Duration: ${formatDuration(duration)}`, 'cyan')
      );

      if (options.save) {
        savedPath = saveToJson(command, duration, exitCode);
      }

      resolve({ command, duration, exitCode, savedPath });
    });
  });
}

function saveToJson(command: string, duration: number, exitCode: number): string {
  if (!existsSync(TIMER_DIR)) {
    mkdirSync(TIMER_DIR, { recursive: true });
  }

  const commandName = extractCommandName(command);
  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // Format: 2024-01-15T10-30-45
  const filename = `${commandName}+${date}.json`;
  const filepath = join(TIMER_DIR, filename);

  const data = {
    command,
    commandName,
    duration: {
      milliseconds: Math.round(duration),
      formatted: formatDuration(duration),
    },
    exitCode,
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
  };

  writeFileSync(filepath, JSON.stringify(data, null, 2));
  return filepath;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    showHelp();
    process.exit(0);
  }

  // Check for history command
  if (args.includes('--history') || args.includes('-h')) {
    const limitArg = args.find(arg => arg.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 10;
    showHistory(limit);
    process.exit(0);
  }

  const options = {
    save: args.includes('--save') || args.includes('-s'),
    noOutput: args.includes('--no-output') || args.includes('-n'),
    clipboard: args.includes('--clipboard') || args.includes('-c'),
  };

  // Remove option flags from args
  const commandArgs = args.filter(
    (arg) => !['--save', '-s', '--no-output', '-n', '--clipboard', '-c'].includes(arg)
  );

  if (commandArgs.length === 0) {
    console.error(colorize('Error: No command provided', 'yellow'));
    showHelp();
    process.exit(1);
  }

  const commandString = commandArgs.join(' ');
  const commands = parseCommands(commandString);

  // If only one command, execute it normally
  if (commands.length === 1) {
    const result = await executeCommand(commands[0], options);
    if (result.savedPath) {
      console.log(colorize(`\n💾 Saved timing data to: ${result.savedPath}`, 'gray'));
    }
    
    if (options.clipboard) {
      const text = `Command: ${result.command}\nDuration: ${formatDuration(result.duration)}\nStatus: ${result.exitCode === 0 ? 'Success' : 'Failed'}`;
      if (copyToClipboard(text)) {
        console.log(colorize('📋 Results copied to clipboard', 'green'));
      } else {
        console.log(colorize('⚠️  Could not copy to clipboard (install xclip or wl-copy)', 'yellow'));
      }
    }
    
    process.exit(result.exitCode);
  }

  // Multiple commands - comparison mode
  console.log(colorize(`\n🔬 Comparison Mode: ${commands.length} command(s)\n`, 'cyan'));

  const results: TimingResult[] = [];

  for (let i = 0; i < commands.length; i++) {
    const command = commands[i].trim();
    if (!command) continue;

    const result = await executeCommand(command, options, i + 1, commands.length);
    results.push(result);

    // Wait a moment between commands (except after the last one)
    if (i < commands.length - 1) {
      console.log(colorize('\n⏸️  Waiting before next command...\n', 'gray'));
      await sleep(1000); // 1 second pause
    }
  }

  // Display comparison
  displayComparison(results);

  // Save to history
  saveToHistory(results);

  // Copy to clipboard if requested
  if (options.clipboard) {
    const comparisonText = formatComparisonText(results);
    if (copyToClipboard(comparisonText)) {
      console.log(colorize('📋 Comparison results copied to clipboard', 'green'));
    } else {
      console.log(colorize('⚠️  Could not copy to clipboard (install xclip or wl-copy)', 'yellow'));
    }
  }

  // Exit with error code if any command failed
  const hasErrors = results.some(r => r.exitCode !== 0);
  process.exit(hasErrors ? 1 : 0);
}

main();

