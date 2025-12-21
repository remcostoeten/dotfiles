#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const HISTORY_DIR = path.join(require('os').homedir(), '.dotfiles');
const HISTORY_FILE = path.join(HISTORY_DIR, 'comment-removal.json');

function printHelp() {
  console.log(`
Usage: script [options] [file]

Options:
  -d, --dry              Dry run mode (show changes without applying)
  -e, --extension <ext>  File extensions to process (comma-separated or array)
                         Default: ts,tsx
  -i, --interactive      Interactive mode with fuzzy search (default)
  -r, --revert          Revert last removal
  -h, --help            Show this help

Examples:
  script src/components/something.tsx
  script -e tsx
  script -e tsx,jsx
  script --dry src/
  script --interactive
  script --revert
`);
}

function showWelcome() {
  console.log(`\n🧹 ${colors.green}CSS-in-JS Comment Remover${colors.reset}`);
  console.log(`═════════════════════════════════════════\n`);
  console.log(`${colors.cyan}What this tool does:${colors.reset}`);
  console.log(`• Removes CSS-in-JS style comments from your code`);
  console.log(`• Targets comments like {/* comment */} in JS/JSX`);
  console.log(`• Works on TypeScript and React files by default`);
  console.log(`• Creates backups so you can revert changes\n`);

  console.log(`${colors.yellow}Why you might use this:${colors.reset}`);
  console.log(`• Clean up styled-components or emotion comments`);
  console.log(`• Remove development-only CSS comments`);
  console.log(`• Prepare code for production builds\n`);
}

const colors = {
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function parseArgs(args) {
  const config = {
    dryRun: false,
    extensions: ['ts', 'tsx'],
    interactive: true, // Changed to true by default
    revert: false,
    target: 'src',
    showHelp: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      config.showHelp = true;
    } else if (arg === '-d' || arg === '--dry') {
      config.dryRun = true;
    } else if (arg === '-i' || arg === '--interactive') {
      config.interactive = true;
    } else if (arg === '--no-interactive') {
      config.interactive = false;
    } else if (arg === '-r' || arg === '--revert') {
      config.revert = true;
    } else if (arg === '-e' || arg === '--extension') {
      const next = args[++i];
      if (next) {
        const cleaned = next.replace(/[[\]]/g, '');
        config.extensions = cleaned.split(',').map(e => e.trim());
      }
    } else if (!arg.startsWith('-')) {
      config.target = arg;
    }
  }

  return config;
}

function shouldIgnore(filepath) {
  const parts = filepath.split(path.sep);
  return parts.some(part => 
    part === 'node_modules' || 
    part === '.next' || 
    part.startsWith('.')
  );
}

function findFiles(dir, extensions) {
  const results = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);

    if (shouldIgnore(fullPath)) {
      continue;
    }

    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...findFiles(fullPath, extensions));
    } else {
      const ext = path.extname(item).slice(1);
      if (extensions.includes(ext)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

function removeComments(content) {
  return content.replace(/\s*\{\s*\/[*][^*]*[*]+(?:[^/*][^*]*[*]+)*\/\s*\}\s*/g, '');
}

function processFile(filepath, dryRun) {
  const content = fs.readFileSync(filepath, 'utf8');
  const newContent = removeComments(content);

  if (content === newContent) {
    return null;
  }

  if (!dryRun) {
    fs.writeFileSync(filepath, newContent, 'utf8');
  }

  return { filepath, original: content, modified: newContent };
}

function saveHistory(changes) {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }

  const history = {
    timestamp: new Date().toISOString(),
    changes: changes.map(c => ({
      filepath: c.filepath,
      original: c.original
    }))
  };

  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function revertChanges() {
  if (!fs.existsSync(HISTORY_FILE)) {
    console.log('No history found');
    return;
  }

  const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));

  for (const change of history.changes) {
    if (fs.existsSync(change.filepath)) {
      fs.writeFileSync(change.filepath, change.original, 'utf8');
      console.log(`Reverted: ${change.filepath}`);
    }
  }

  fs.unlinkSync(HISTORY_FILE);
  console.log('\nRevert complete');
}

async function fuzzySearch(items) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('\nAvailable directories:');
    items.forEach((item, i) => console.log(`${i + 1}. ${item}`));
    console.log();

    rl.question('Select directory (number or name): ', (answer) => {
      rl.close();
      const index = parseInt(answer) - 1;
      if (!isNaN(index) && items[index]) {
        resolve(items[index]);
      } else {
        const match = items.find(item => item.includes(answer));
        resolve(match || items[0]);
      }
    });
  });
}

async function interactiveMode(extensions) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(`\n${colors.blue}📁 Let's select a directory to process:${colors.reset}`);
  console.log(`Looking for directories with ${extensions.join(', ')} files...\n`);

  const cwd = process.cwd();
  const items = fs.readdirSync(cwd)
    .filter(item => {
      const stat = fs.statSync(path.join(cwd, item));
      return stat.isDirectory() && !shouldIgnore(item);
    });

  if (items.length === 0) {
    console.log(`${colors.yellow}No directories found in current location.${colors.reset}`);
    console.log(`Make sure you're in a project directory with TypeScript/React files.`);
    rl.close();
    return;
  }

  console.log(`${colors.cyan}Available directories:${colors.reset}`);
  items.forEach((item, i) => {
    const itemCount = findFiles(path.join(cwd, item), extensions).length;
    const icon = itemCount > 0 ? '📂' : '📁';
    console.log(`  ${i + 1}. ${icon} ${item} ${colors.gray}(${itemCount} files)${colors.reset}`);
  });
  console.log();

  return new Promise((resolve) => {
    rl.question(`${colors.yellow}Select a directory (enter number or name):${colors.reset} `, async (answer) => {
      rl.close();

      const index = parseInt(answer) - 1;
      if (!isNaN(index) && items[index]) {
        resolve(items[index]);
      } else {
        const match = items.find(item =>
          item.toLowerCase().includes(answer.toLowerCase())
        );
        if (match) {
          resolve(match);
        } else {
          console.log(`${colors.red}No match found. Using first directory.${colors.reset}`);
          resolve(items[0]);
        }
      }
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const config = parseArgs(args);

  if (config.showHelp) {
    printHelp();
    return;
  }

  if (config.revert) {
    console.log(`${colors.blue}🔄 Reverting last comment removal...${colors.reset}`);
    revertChanges();
    return;
  }

  // Show welcome screen for interactive mode (default)
  if (config.interactive && args.length === 0) {
    showWelcome();
  }

  let target = config.target;

  // Check if target is a file (not a directory)
  const targetStat = fs.existsSync(target) ? fs.statSync(target) : null;
  const isFile = targetStat && targetStat.isFile();

  if (config.interactive && !isFile) {
    target = await interactiveMode(config.extensions);
    if (!target) {
      return;
    }
  }

  // If it's a file, process just that file
  const files = isFile ? [target] : findFiles(target, config.extensions);

  if (files.length === 0) {
    console.log(`${colors.yellow}No ${config.extensions.join(', ')} files found in '${target}'${colors.reset}`);
    return;
  }

  console.log(`\n${colors.blue}🔍 Scanning ${files.length} file(s)...${colors.reset}`);

  if (config.dryRun) {
    console.log(`${colors.yellow}⚠️  DRY RUN MODE - No files will be modified${colors.reset}\n`);
  }

  const changes = [];
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Ask for confirmation if in interactive mode and processing multiple files
  if (config.interactive && !isFile) {
    const answer = await new Promise(resolve => {
      rl.question(`${colors.cyan}Continue processing ${files.length} files? [Y/n]:${colors.reset} `, resolve);
    });

    if (answer.toLowerCase() === 'n' || answer.toLowerCase() === 'no') {
      console.log(`${colors.yellow}Operation cancelled.${colors.reset}`);
      rl.close();
      return;
    }
  }
  rl.close();

  console.log(`${colors.cyan}Processing files...${colors.reset}\n`);

  for (const file of files) {
    const result = processFile(file, config.dryRun);
    if (result) {
      changes.push(result);
      const icon = config.dryRun ? '👁️' : '✅';
      console.log(`  ${icon} ${config.dryRun ? '[DRY] ' : ''}${path.relative(process.cwd(), file)}`);
    }
  }

  if (changes.length === 0) {
    console.log(`\n${colors.green}✨ No CSS comments found - all clean!${colors.reset}`);
  } else {
    const action = config.dryRun ? 'would be modified' : 'modified';
    console.log(`\n${colors.green}🎉 Success! ${changes.length} file(s) ${action}${colors.reset}`);

    if (!config.dryRun) {
      saveHistory(changes);
      console.log(`${colors.blue}💾 Backup created - use '--revert' to undo changes${colors.reset}`);
    }
  }
}

main().catch(console.error);
