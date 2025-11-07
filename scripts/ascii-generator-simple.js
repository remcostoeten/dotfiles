#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const PASTEL_COLORS = {
  PINK: '\x1b[38;2;250;162;193m',
  MAGENTA: '\x1b[38;2;212;187;248m',
  PURPLE: '\x1b[38;2;165;216;255m',
  BLUE: '\x1b[38;2;178;242;187m',
  CYAN: '\x1b[38;2;255;236;153m',
  GREEN: '\x1b[38;2;255;216;168m',
  RESET: '\x1b[0m',
};

const ASCII_TEMPLATES = {
  docker: [
    '██████╗  ██████╗  ██████╗██╗  ██╗███████╗██████╗ ',
    '██╔══██╗██╔═══██╗██╔════╝██║ ██╔╝██╔════╝██╔══██╗',
    '██║  ██║██║   ██║██║     █████╔╝ █████╗  ██████╔╝',
    '██║  ██║██║   ██║██║     ██╔═██╗ ██╔══╝  ██╔══██╗',
    '██████╔╝╚██████╔╝╚██████╗██║  ██╗███████╗██║  ██║',
    '╚═════╝  ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝',
  ],
  android: [
    '██████╗ ███████╗████████╗',
    '██╔══██╗██╔════╝╚══██╔══╝',
    '██████╔╝███████║   ██║',
    '██╔══██╗╚════██║   ██║',
    '██║  ██║███████║   ██║',
    '╚═╝  ╚═╝╚══════╝   ╚═╝',
  ],
  ports: [
    '██████╗ ██╗  ██╗ █████╗ ████████╗██╗ ██████╗ ███╗   ██╗',
    '██╔══██╗██║  ██║██╔══██╗╚══██╔══╝██║██╔═══██╗████╗  ██║',
    '██████╔╝███████║███████║   ██║   ██║██║   ██║██╔██╗ ██║',
    '██╔══██╗██╔══██║██╔══██║   ██║   ██║██║   ██║██║╚██╗██║',
    '██║  ██║██║  ██║██║  ██║   ██║   ██║╚██████╔╝██║ ╚████║',
    '╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝',
  ],
  generic: [
    '██████╗ ██████╗  ██████╗ ████████╗',
    '██╔══██╗██╔══██╗██╔═══██╗╚══██╔══╝',
    '██████╔╝██████╔╝██║   ██║   ██║',
    '██╔══██╗██╔══██╗██║   ██║   ██║',
    '██████╔╝██████╔╝╚██████╔╝   ██║',
    '╚═════╝ ╚═════╝  ╚═════╝    ╚═╝',
  ]
};

function getVersion() {
  const versionFile = path.join(__dirname, '..', 'VERSION');
  try {
    if (fs.existsSync(versionFile)) {
      return fs.readFileSync(versionFile, 'utf8').trim();
    }
  } catch (error) {
    // ignore
  }
  return "unknown";
}

function createGradientText(text, colors) {
  if (!colors) {
    colors = [PASTEL_COLORS.PINK, PASTEL_COLORS.MAGENTA, PASTEL_COLORS.PURPLE, PASTEL_COLORS.BLUE, PASTEL_COLORS.CYAN, PASTEL_COLORS.GREEN];
  }

  if (text.length === 0) return text;

  let result = '';
  const textLength = text.length;

  for (let i = 0; i < textLength; i++) {
    const position = (i / (textLength - 1 || 1)) * 100;
    const colorIndex = Math.floor((position / 100) * (colors.length - 1));
    result += colors[colorIndex] + text[i];
  }

  return result + PASTEL_COLORS.RESET;
}

function showBanner(options) {
  const type = options.type || 'generic';
  const name = options.name || '';
  const tagline = options.tagline || `By Remco Stoeten v${getVersion()}`;

  const asciiArt = ASCII_TEMPLATES[type] || ASCII_TEMPLATES.generic;
  const colors = [PASTEL_COLORS.PINK, PASTEL_COLORS.MAGENTA, PASTEL_COLORS.PURPLE, PASTEL_COLORS.BLUE, PASTEL_COLORS.CYAN, PASTEL_COLORS.GREEN];

  console.log('\n' + '='.repeat(80));

  asciiArt.forEach((line, index) => {
    const color = colors[index % colors.length];
    console.log(`    ${color}${line}${PASTEL_COLORS.RESET}`);
  });

  if (name) {
    console.log(`    ${PASTEL_COLORS.PINK}╔══════════════════════════════════════════════════════════════╗${PASTEL_COLORS.RESET}`);
    console.log(`    ${PASTEL_COLORS.MAGENTA}║ ${name.padEnd(55)} ║${PASTEL_COLORS.RESET}`);
    console.log(`    ${PASTEL_COLORS.PURPLE}╚══════════════════════════════════════════════════════════════╝${PASTEL_COLORS.RESET}`);
  }

  const gradientTagline = createGradientText(tagline);
  console.log(' '.repeat(20) + gradientTagline);
  console.log('='.repeat(80) + '\n');
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      options[key] = value || true;
    }
  }

  showBanner(options);
}

if (require.main === module) {
  main();
}

module.exports = {
  showBanner,
  ASCII_TEMPLATES,
  PASTEL_COLORS,
};