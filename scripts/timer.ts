#!/usr/bin/env bun
// DOCSTRING: Time command execution with notifications, exports, and benchmarking

import { spawn, execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from 'fs';
import { join } from 'path';

const DOTFILES_DATA_DIR = process.env.DOTFILES_DATA_DIR || process.env.HOME + '/.dotfiles';
const TIMER_DIR = join(DOTFILES_DATA_DIR, 'timer');
const HISTORY_FILE = join(TIMER_DIR, 'history.json');
const CONFIG_FILE = join(TIMER_DIR, 'config.json');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
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

type Config = {
  bell: boolean;
  notification: boolean;
  defaultRuns: number;
  exportFormat: 'json' | 'csv' | 'markdown';
};

const defaultConfig: Config = {
  bell: true,
  notification: true,
  defaultRuns: 3,
  exportFormat: 'json',
};

function loadConfig(): Config {
  if (!existsSync(CONFIG_FILE)) {
    mkdirSync(TIMER_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  try {
    return { ...defaultConfig, ...JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) };
  } catch {
    return defaultConfig;
  }
}

function saveConfig(config: Config): void {
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function showHelp(): void {
  console.log(colorize('\n⏱️  Timer - Command Execution Timer\n', 'cyan'));
  console.log(colorize('Usage: timer [options] <command...>\n', 'bright'));
  console.log(colorize('Options:', 'yellow'));
  console.log(colorize('  --run, -r <n>        Run command n times and show stats', 'gray'));
  console.log(colorize('  --save, -s          Save timing data to JSON file', 'gray'));
  console.log(colorize('  --no-output, -n    Suppress command output', 'gray'));
  console.log(colorize('  --clipboard, -c    Copy results to clipboard', 'gray'));
  console.log(colorize('  --history, -h      Show comparison history', 'gray'));
  console.log(colorize('  --export, -e      Export history (json|csv|md)', 'gray'));
  console.log(colorize('  --bell, -b         Play bell on completion', 'gray'));
  console.log(colorize('  --notify, -N       Send notification on completion', 'gray'));
  console.log(colorize('  --config           Show/manage config', 'gray'));
  console.log(colorize('  --quick            Quick mode (no stats, just time)', 'gray'));
  console.log(colorize('  --help             Show this help message\n', 'gray'));
  console.log(colorize('Examples:', 'yellow'));
  console.log(colorize('  timer bun run build                  Time a single command', 'gray'));
  console.log(colorize('  timer -r 5 "npm test"               Run 5 times, show avg/min/max', 'gray'));
  console.log(colorize('  timer -r 3 --save "npm install"     Save benchmark results', 'gray'));
  console.log(colorize('  timer , bun , pnpm                   Compare 3 commands', 'gray'));
  console.log(colorize('  timer --export md > results.md      Export to markdown', 'gray'));
  console.log(colorize('  timer --config bell=false           Disable bell', 'gray'));
  console.log(colorize('\nComparison syntax:', 'yellow'));
  console.log(colorize('  Use comma (,) to separate commands for comparison', 'gray'));
  console.log(colorize('  Use semicolon (;) or && to chain commands', 'gray'));
}

function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}µs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(2);
  return `${minutes}m ${seconds}s`;
}

function playBell(): void {
  if (!loadConfig().bell) return;
  process.stdout.write('\x07');
}

function sendNotification(title: string, body: string): void {
  if (!loadConfig().notification) return;
  try {
    if (process.platform === 'linux') {
      execSync(`notify-send "${title}" "${body}"`, { stdio: 'ignore' });
    }
  } catch { /* ignore */ }
}

function copyToClipboard(text: string): boolean {
  try {
    const platforms: Record<string, string[]> = {
      linux: ['xclip', '-selection', 'clipboard'],
      darwin: ['pbcopy'],
      win32: ['clip'],
    };
    const cmd = platforms[process.platform];
    if (!cmd) return false;
    const proc = spawn(cmd[0], cmd.slice(1), { stdio: 'pipe' });
    proc.stdin.write(text);
    proc.stdin.end();
    return true;
  } catch {
    return false;
  }
}

function extractCommandName(command: string): string {
  const firstPart = command.split(/[;&|]/)[0].trim();
  return firstPart.split(/\s+/)[0] || 'unknown';
}

function computeStats(durations: number[]): { avg: number; min: number; max: number; stdDev: number } {
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const variance = durations.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / durations.length;
  return { avg, min, max, stdDev: Math.sqrt(variance) };
}

function formatComparisonText(results: TimingResult[], exportFormat?: string): string {
  if (results.length === 0) return '';
  const lines: string[] = [];
  lines.push(colorize('═'.repeat(60), 'cyan'));
  lines.push(colorize('📊 Comparison Results', 'bright'));
  lines.push(colorize('═'.repeat(60), 'cyan'));

  const fastest = Math.min(...results.map(r => r.duration));
  const slowest = Math.max(...results.map(r => r.duration));

  results.forEach((result, index) => {
    const isFastest = result.duration === fastest && results.length > 1;
    const isSlowest = result.duration === slowest && results.length > 1 && fastest !== slowest;
    const status = result.exitCode === 0 ? '✓ Success' : '✗ Failed';
    const icon = isFastest ? '⚡' : isSlowest ? '🐌' : '⏱️ ';
    let durationDisplay = `${icon} ${formatDuration(result.duration)}`;
    if (isFastest) durationDisplay += ' (fastest)';
    if (isSlowest) durationDisplay += ' (slowest)';

    lines.push(`\n${index + 1}. ${result.command}`);
    lines.push(`   ${status} | ${durationDisplay}`);
    if (results.length > 1 && !isFastest) {
      const diff = result.duration - fastest;
      const pct = ((diff / fastest) * 100).toFixed(1);
      lines.push(`   📈 +${formatDuration(diff)} (+${pct}%)`);
    }
  });

  if (results.length > 1) {
    const total = results.reduce((sum, r) => sum + r.duration, 0);
    lines.push(colorize('\n─'.repeat(60), 'cyan'));
    lines.push(`   Total: ${formatDuration(total)} | Avg: ${formatDuration(total / results.length)}`);
  }
  lines.push(colorize('\n═'.repeat(60) + '\n', 'cyan'));
  return lines.join('\n');
}

function formatBenchmarkText(command: string, stats: ReturnType<typeof computeStats>, runs: number): string {
  const lines: string[] = [];
  lines.push(colorize('\n📈 Benchmark Results', 'cyan'));
  lines.push(colorize('─'.repeat(60), 'cyan'));
  lines.push(`Command: ${command}`);
  lines.push(`Runs: ${runs}`);
  lines.push(colorize('─'.repeat(60), 'cyan'));
  lines.push(colorize(`  Average:  ${formatDuration(stats.avg)}`, 'bright'));
  lines.push(colorize(`  Min:      ${formatDuration(stats.min)}`, 'green'));
  lines.push(colorize(`  Max:      ${formatDuration(stats.max)}`, 'red'));
  lines.push(colorize(`  Std Dev:  ${formatDuration(stats.stdDev)}`, 'yellow'));
  lines.push(colorize('─'.repeat(60), 'cyan'));
  return lines.join('\n');
}

function saveToHistory(result: TimingResult): void {
  mkdirSync(TIMER_DIR, { recursive: true });
  let history: TimingResult[] = [];
  if (existsSync(HISTORY_FILE)) {
    try { history = JSON.parse(readFileSync(HISTORY_FILE, 'utf-8')); } catch { history = []; }
  }
  history.unshift(result);
  if (history.length > 100) history = history.slice(0, 100);
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function showHistory(limit: number = 10): void {
  if (!existsSync(HISTORY_FILE)) {
    console.log(colorize('\n📜 No history found\n', 'yellow'));
    return;
  }
  const history: TimingResult[] = JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'));
  console.log(colorize(`\n📜 Recent History (${Math.min(limit, history.length)} entries)\n`, 'cyan'));
  history.slice(0, limit).forEach((r, i) => {
    const status = r.exitCode === 0 ? '✓' : '✗';
    console.log(`  ${i + 1}. ${status} ${formatDuration(r.duration)} | ${r.command.slice(0, 50)}`);
  });
  console.log('');
}

function exportHistory(format: string): void {
  if (!existsSync(HISTORY_FILE)) {
    console.log(colorize('No history to export', 'yellow'));
    return;
  }
  const history: TimingResult[] = JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'));

  if (format === 'json') {
    console.log(JSON.stringify(history, null, 2));
  } else if (format === 'csv') {
    console.log('timestamp,command,duration_ms,exit_code');
    history.forEach(r => console.log(`${new Date().toISOString()},${r.command},${r.duration},${r.exitCode}`));
  } else if (format === 'md') {
    console.log('| Command | Duration | Status |');
    console.log('|---------|----------|--------|');
    history.forEach(r => {
      const status = r.exitCode === 0 ? '✓' : '✗';
      console.log(`| ${r.command.slice(0, 40)} | ${formatDuration(r.duration)} | ${status} |`);
    });
  }
}

function parseCommands(input: string): string[] {
  const commands: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if ((char === '"' || char === "'") && (i === 0 || input[i - 1] !== '\\')) {
      if (!inQuotes) { inQuotes = true; quoteChar = char; }
      else if (char === quoteChar) { inQuotes = false; quoteChar = ''; }
    } else if (char === ',' && !inQuotes) {
      if (current.trim()) commands.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) commands.push(current.trim());
  return commands.length > 0 ? commands : [input];
}

function executeCommand(command: string, noOutput: boolean): Promise<TimingResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const shell = process.env.SHELL || '/bin/bash';
    const child = spawn(shell, ['-c', command], {
      stdio: noOutput ? 'pipe' : 'inherit',
      env: process.env,
    });

    child.on('exit', (code) => {
      const duration = Date.now() - startTime;
      resolve({ command, duration, exitCode: code || 0 });
    });

    child.on('error', (err) => {
      const duration = Date.now() - startTime;
      resolve({ command, duration, exitCode: 1 });
    });
  });
}

function saveToJson(command: string, duration: number, exitCode: number): string {
  mkdirSync(TIMER_DIR, { recursive: true });
  const name = extractCommandName(command);
  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filepath = join(TIMER_DIR, `${name}+${date}.json`);
  writeFileSync(filepath, JSON.stringify({ command, duration, exitCode, timestamp: new Date().toISOString() }, null, 2));
  return filepath;
}

async function runBenchmark(command: string, runs: number, options: { save: boolean; noOutput: boolean }): Promise<void> {
  console.log(colorize(`\n🔄 Running benchmark: ${runs}x "${command}"\n`, 'cyan'));
  const durations: number[] = [];

  for (let i = 0; i < runs; i++) {
    const result = await executeCommand(command, options.noOutput);
    durations.push(result.duration);
    if (i < runs - 1) await new Promise(r => setTimeout(r, 500));
  }

  const stats = computeStats(durations);
  console.log(formatBenchmarkText(command, stats, runs));

  if (options.save) {
    const path = join(TIMER_DIR, `benchmark+${Date.now()}.json`);
    writeFileSync(path, JSON.stringify({ command, runs, stats, timestamp: new Date().toISOString() }, null, 2));
    console.log(colorize(`💾 Saved to ${path}\n`, 'green'));
  }

  playBell();
  sendNotification('Timer', `Benchmark complete: ${formatDuration(stats.avg)} avg`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    showHelp();
    process.exit(0);
  }

  const config = loadConfig();

  // Config management
  if (args.includes('--config')) {
    const setArg = args.find(a => a.startsWith('bell=') || a.startsWith('notification=') || a.startsWith('defaultRuns=') || a.startsWith('exportFormat='));
    if (setArg) {
      const [key, val] = setArg.split('=');
      (config as any)[key] = val === 'true' ? true : val === 'false' ? false : isNaN(Number(val)) ? val : Number(val);
      saveConfig(config);
      console.log(colorize(`✅ Config updated: ${key}=${val}`, 'green'));
    } else {
      console.log(colorize('\n📝 Current Config:', 'cyan'));
      console.log(JSON.stringify(config, null, 2));
      console.log(colorize('\nTip: Use --config bell=false to modify', 'gray'));
    }
    process.exit(0);
  }

  // History
  if (args.includes('--history') || args.includes('-h')) {
    const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '10');
    showHistory(limit);
    process.exit(0);
  }

  // Export
  if (args.includes('--export') || args.includes('-e')) {
    const format = args.find(a => ['json', 'csv', 'md'].includes(a))?.replace('-', '') || 'json';
    exportHistory(format);
    process.exit(0);
  }

  const options = {
    runs: parseInt(args.find(a => a.startsWith('-r') && !a.startsWith('--'))?.replace('-r', '') || args.find(a => a.startsWith('--run='))?.split('=')[1] || '1'),
    save: args.includes('--save') || args.includes('-s'),
    noOutput: args.includes('--no-output') || args.includes('-n'),
    clipboard: args.includes('--clipboard') || args.includes('-c'),
    bell: args.includes('--bell') || args.includes('-b'),
    notify: args.includes('--notify') || args.includes('-N'),
    quick: args.includes('--quick'),
  };

  const commandArgs = args.filter(a => !a.startsWith('-') || a === '-s' || a === '-n' || a === '-c');
  if (commandArgs.length === 0) {
    console.error(colorize('Error: No command provided', 'yellow'));
    showHelp();
    process.exit(1);
  }

  const commandString = commandArgs.join(' ');

  // Benchmark mode
  if (options.runs > 1) {
    await runBenchmark(commandString, options.runs, { save: options.save, noOutput: options.noOutput });
    if (options.clipboard) copyToClipboard(formatDuration(computeStats([]).avg)); // placeholder
    process.exit(0);
  }

  // Quick mode
  if (options.quick) {
    const result = await executeCommand(commandString, options.noOutput);
    console.log(colorize(`⏱️  ${formatDuration(result.duration)}`, 'cyan'));
    playBell();
    process.exit(result.exitCode);
  }

  // Single command
  console.log(colorize(`\n▶️  Executing: ${commandString}\n`, 'bright'));
  const result = await executeCommand(commandString, options.noOutput);
  console.log(colorize(`\n⏱️  Duration: ${formatDuration(result.duration)}`, 'cyan'));

  if (options.save) {
    const path = saveToJson(commandString, result.duration, result.exitCode);
    console.log(colorize(`💾 Saved to ${path}`, 'green'));
  }

  saveToHistory(result);

  if (options.clipboard) {
    copyToClipboard(`Command: ${commandString}\nDuration: ${formatDuration(result.duration)}\nStatus: ${result.exitCode === 0 ? 'Success' : 'Failed'}`);
    console.log(colorize('📋 Copied to clipboard', 'green'));
  }

  playBell();
  sendNotification('Timer Complete', `${formatDuration(result.duration)} - ${commandString.slice(0, 30)}`);
  process.exit(result.exitCode);
}

main();