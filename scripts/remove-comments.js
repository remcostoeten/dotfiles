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
  -i, --interactive      Interactive mode with fuzzy search
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

function parseArgs(args) {
  const config = {
    dryRun: false,
    extensions: ['ts', 'tsx'],
    interactive: false,
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
  const cwd = process.cwd();
  const items = fs.readdirSync(cwd)
    .filter(item => {
      const stat = fs.statSync(path.join(cwd, item));
      return stat.isDirectory() && !shouldIgnore(item);
    });

  if (items.length === 0) {
    console.log('No directories found');
    return;
  }

  const selected = await fuzzySearch(items);
  return selected;
}

async function main() {
  const args = process.argv.slice(2);
  const config = parseArgs(args);

  if (config.showHelp) {
    printHelp();
    return;
  }

  if (config.revert) {
    revertChanges();
    return;
  }

  let target = config.target;

  if (config.interactive) {
    target = await interactiveMode(config.extensions);
    if (!target) {
      return;
    }
  }

  const files = findFiles(target, config.extensions);

  if (files.length === 0) {
    console.log('No files found');
    return;
  }

  console.log(`Processing ${files.length} files...`);
  if (config.dryRun) {
    console.log('DRY RUN MODE\n');
  }

  const changes = [];

  for (const file of files) {
    const result = processFile(file, config.dryRun);
    if (result) {
      changes.push(result);
      console.log(`${config.dryRun ? '[DRY] ' : ''}Modified: ${file}`);
    }
  }

  if (changes.length === 0) {
    console.log('\nNo changes needed');
  } else {
    console.log(`\n${changes.length} files ${config.dryRun ? 'would be' : ''} modified`);
    if (!config.dryRun) {
      saveHistory(changes);
    }
  }
}

main().catch(console.error);
