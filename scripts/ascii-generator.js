#!/usr/bin/env node

/**
 * Universal ASCII Art Generator
 *
 * This script generates consistent ASCII art headers for different scripts
 * across multiple languages (bash, fish, python, node.js).
 *
 * Usage:
 *   node ascii-generator.js [options]
 *   node ascii-generator.js --interactive
 *
 * Options:
 *   --help, -h              Show this help message
 *   --interactive, -i       Run in interactive mode
 *   --type=<type>           ASCII art type (docker, android, ports, generic)
 *   --lang=<language>       Target language (bash, fish, python, node)
 *   --name=<name>           Custom name to display under ASCII art
 *   --tagline=<text>        Custom tagline (default: "By Remco Stoeten v<version>")
 *   --output=<file>         Save output to file instead of stdout
 *
 * Examples:
 *   node ascii-generator.js --type=docker
 *   node ascii-generator.js --type=android --lang=fish --name="Android Manager"
 *   node ascii-generator.js --type=ports --output=header.sh
 *   node ascii-generator.js --type=generic --name="My App" --tagline="Custom Application"
 *   node ascii-generator.js --interactive
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PASTEL_COLORS = {
  PINK: '\x1b[38;2;250;162;193m',
  MAGENTA: '\x1b[38;2;212;187;248m',
  PURPLE: '\x1b[38;2;165;216;255m',
  BLUE: '\x1b[38;2;178;242;187m',
  CYAN: '\x1b[38;2;255;236;153m',
  GREEN: '\x1b[38;2;255;216;168m',
  ORANGE: '\x1b[38;2;255;135;135m',
  RED: '\x1b[38;2;137;220;235m',
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
    '██████╔╝███████╗   ██║',
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

function removeAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

function createGradientText(text, colors = [PASTEL_COLORS.PINK, PASTEL_COLORS.MAGENTA, PASTEL_COLORS.PURPLE, PASTEL_COLORS.BLUE, PASTEL_COLORS.CYAN, PASTEL_COLORS.GREEN]) {
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

function generateBashHeader(options = {}) {
  const { type = 'generic', name = '', tagline = null } = options;
  const version = getVersion();
  const defaultTagline = tagline || `By Remco Stoeten v${version}`;

  const asciiArt = ASCII_TEMPLATES[type] || ASCII_TEMPLATES.generic;
  const colors = ['PASTEL_PINK', 'PASTEL_MAGENTA', 'PASTEL_PURPLE', 'PASTEL_BLUE', 'PASTEL_CYAN', 'PASTEL_GREEN'];

  let script = `#!/usr/bin/env bash

# Pastel colors matching cfg/docker scripts
PASTEL_PINK='\\033[38;2;250;162;193m'
PASTEL_MAGENTA='\\033[38;2;212;187;248m'
PASTEL_PURPLE='\\033[38;2;165;216;255m'
PASTEL_BLUE='\\033[38;2;178;242;187m'
PASTEL_CYAN='\\033[38;2;255;236;153m'
PASTEL_GREEN='\\033[38;2;255;216;168m'
NC='\\033[0m' # No Color

get_version() {
    local version_file="$(dirname "$0")/../VERSION"
    if [ -f "$version_file" ]; then
        cat "$version_file" | tr -d '\\n'
    else
        echo "unknown"
    fi
}

remove_ansi() {
    echo -e "$1" | sed 's/\\x1b\\[[0-9;]*m//g'
}

create_gradient_text() {
    local text="$1"
    local colors=("$PASTEL_PINK" "$PASTEL_MAGENTA" "$PASTEL_PURPLE" "$PASTEL_BLUE" "$PASTEL_CYAN" "$PASTEL_GREEN")
    local result=""
    local text_len=\${#text}

    if [ $text_len -eq 0 ]; then
        echo "$text"
        return
    fi

    for ((i=0; i<text_len; i++)); do
        local position=$((i * 100 / (text_len - 1)))
        local color_index=$((position * (\${#colors[@]} - 1) / 100))
        result+="\${colors[\$color_index]}\${text:\$i:1}"
    done
    printf '%b' "\${result}\${NC}"
}

show_banner() {
    local version=$(get_version)
    local tagline="\${tagline:-"$defaultTagline"}"
    local gradient_tagline=$(create_gradient_text "$tagline")

    # ASCII art with gradient colors
    local ascii_lines=(`;

  asciiArt.forEach((line, index) => {
    const color = colors[index % colors.length];
    script += `\n        "    ${color}${line}\${NC}"`;
  });

  if (name) {
    script += `
        "    $PASTEL_PINK╔══════════════════════════════════════════════════════════════╗\${NC}"
        "    $PASTEL_MAGENTA║ ${name.padEnd(55)} ║\${NC}"
        "    $PASTEL_PURPLE╚══════════════════════════════════════════════════════════════╝\${NC}"`;
  }

  script += `    )

    # Calculate padding for centered tagline
    local max_width=0
    for line in "\${ascii_lines[@]}"; do
        local clean_line=$(remove_ansi "$line")
        local line_length=\${#clean_line}
        if [ $line_length -gt $max_width ]; then
            max_width=$line_length
        fi
    done

    local tagline_length=\${#tagline}
    local left_pad=$(((max_width - tagline_length) / 2))

    # Print ASCII art and tagline
    for line in "\${ascii_lines[@]}"; do
        echo -e "$line"
    done
    echo "$(printf ' %.0s' $(seq 1 $((left_pad + 1))))$gradient_tagline"
    echo ""
}

# Usage: show_banner
show_banner
`;

  return script;
}

function generateFishHeader(options = {}) {
  const { type = 'generic', name = '', tagline = null } = options;
  const version = getVersion();
  const defaultTagline = tagline || `By Remco Stoeten v${version}`;

  const asciiArt = ASCII_TEMPLATES[type] || ASCII_TEMPLATES.generic;

  let script = `#!/usr/bin/env fish

# Pastel colors matching cfg/docker scripts
set -l PASTEL_PINK (set_color faa2c1)
set -l PASTEL_MAGENTA (set_color d4bbf8)
set -l PASTEL_PURPLE (set_color a5d8ff)
set -l PASTEL_BLUE (set_color b2f2bb)
set -l PASTEL_CYAN (set_color ffec99)
set -l PASTEL_GREEN (set_color ffd8a8)
set -l PASTEL_YELLOW (set_color ffd43b)
set -l PASTEL_ORANGE (set_color ff8787)
set -l normal (set_color normal)

function get_version
    set version_file (dirname (status --current-filename))/../VERSION
    if test -f $version_file
        cat $version_file | tr -d '\\n'
    else
        echo "unknown"
    end
end

function show_banner
    set version (get_version)
    set tagline "\${tagline:-"$defaultTagline"}"

    # ASCII art with gradient colors
    `;

  asciiArt.forEach((line, index) => {
    const colorVars = ['$PASTEL_PINK', '$PASTEL_MAGENTA', '$PASTEL_PURPLE', '$PASTEL_BLUE', '$PASTEL_CYAN', '$PASTEL_GREEN'];
    const color = colorVars[index % colorVars.length];
    script += `\n    echo -n '    '; echo $color'$line'$normal;`;
  });

  if (name) {
    script += `\n    echo -n '    '; echo $PASTEL_PINK'╔══════════════════════════════════════════════════════════════╗'$normal`;
    script += `\n    echo -n '    '; echo $PASTEL_MAGENTA'║ ${name.padEnd(55)} ║'$normal`;
    script += `\n    echo -n '    '; echo $PASTEL_PURPLE'╚══════════════════════════════════════════════════════════════╝'$normal`;
  }

  script += `

    # Show footer info
    echo -n "  "
    echo -n "$PASTEL_YELLOW" "updated "
    echo -n "$PASTEL_ORANGE" "(just now)"
    echo -n "$PASTEL_PINK" " · $version"
    echo -n "$PASTEL_CYAN" "  │  "
    echo -n "$PASTEL_BLUE" "$tagline"
    echo "$normal"
end

# Usage: show_banner
show_banner
`;

  return script;
}

function generatePythonHeader(options = {}) {
  const { type = 'generic', name = '', tagline = null } = options;
  const version = getVersion();
  const defaultTagline = tagline || `By Remco Stoeten v${version}`;

  const asciiArt = ASCII_TEMPLATES[type] || ASCII_TEMPLATES.generic;

  let script = `#!/usr/bin/env python3

import os
import sys
from pathlib import Path

# Pastel colors matching cfg/docker scripts
class Colors:
    RESET = '\\033[0m'
    PASTEL_PINK = '\\033[38;2;250;162;193m'
    PASTEL_MAGENTA = '\\033[38;2;212;187;248m'
    PASTEL_PURPLE = '\\033[38;2;165;216;255m'
    PASTEL_BLUE = '\\033[38;2;178;242;187m'
    PASTEL_CYAN = '\\033[38;2;255;236;153m'
    PASTEL_GREEN = '\\033[38;2;255;216;168m'

def get_version():
    version_file = Path(__file__).parent.parent / 'VERSION'
    if version_file.exists():
        return version_file.read_text().strip()
    return "unknown"

def remove_ansi(text):
    import re
    return re.sub(r'\\x1b\\[[0-9;]*m', '', text)

def create_gradient_text(text):
    colors = [Colors.PASTEL_PINK, Colors.PASTEL_MAGENTA, Colors.PASTEL_PURPLE,
              Colors.PASTEL_BLUE, Colors.PASTEL_CYAN, Colors.PASTEL_GREEN]

    if not text:
        return text

    result = ""
    text_length = len(text)

    for i, char in enumerate(text):
        position = (i / (text_length - 1 or 1)) * 100
        color_index = int((position / 100) * (len(colors) - 1))
        result += colors[color_index] + char

    return result + Colors.RESET

def show_banner():
    version = get_version()
    tagline = "\${tagline or defaultTagline}"
    gradient_tagline = create_gradient_text(tagline)

    # ASCII art with gradient colors
    ascii_lines = [`;

  asciiArt.forEach((line, index) => {
    const colorVars = ['Colors.PASTEL_PINK', 'Colors.PASTEL_MAGENTA', 'Colors.PASTEL_PURPLE', 'Colors.PASTEL_BLUE', 'Colors.PASTEL_CYAN', 'Colors.PASTEL_GREEN'];
    const color = colorVars[index % colorVars.length];
    script += `\n        f"    {color}{line}{Colors.RESET}",`;
  });

  if (name) {
    script += `\n        f"    {Colors.PASTEL_PINK}╔══════════════════════════════════════════════════════════════╗{Colors.RESET}",`;
    script += `\n        f"    {Colors.PASTEL_MAGENTA}║ {name.padEnd(55)} ║{Colors.RESET}",`;
    script += `\n        f"    {Colors.PASTEL_PURPLE}╚══════════════════════════════════════════════════════════════╝{Colors.RESET}",`;
  }

  script += `    ]

    # Calculate padding for centered tagline
    max_width = max(len(remove_ansi(line)) for line in ascii_lines)
    tagline_length = len(tagline)
    left_pad = (max_width - tagline_length) // 2

    # Print ASCII art and tagline
    for line in ascii_lines:
        print(line)
    print(' ' * (left_pad + 4) + gradient_tagline)
    print()

if __name__ == "__main__":
    show_banner()
`;

  return script;
}

function generateNodeHeader(options = {}) {
  const { type = 'generic', name = '', tagline = null } = options;
  const version = getVersion();
  const defaultTagline = tagline || `By Remco Stoeten v${version}`;

  const asciiArt = ASCII_TEMPLATES[type] || ASCII_TEMPLATES.generic;

  let script = `#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Pastel colors matching cfg/docker scripts
const COLORS = {
  RESET: '\\x1b[0m',
  PASTEL_PINK: '\\x1b[38;2;250;162;193m',
  PASTEL_MAGENTA: '\\x1b[38;2;212;187;248m',
  PASTEL_PURPLE: '\\x1b[38;2;165;216;255m',
  PASTEL_BLUE: '\\x1b[38;2;178;242;187m',
  PASTEL_CYAN: '\\x1b[38;2;255;236;153m',
  PASTEL_GREEN: '\\x1b[38;2;255;216;168m',
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

function removeAnsi(text) {
  return text.replace(/\\x1b\\[[0-9;]*m/g, '');
}

function createGradientText(text) {
  const colors = [
    COLORS.PASTEL_PINK,
    COLORS.PASTEL_MAGENTA,
    COLORS.PASTEL_PURPLE,
    COLORS.PASTEL_BLUE,
    COLORS.PASTEL_CYAN,
    COLORS.PASTEL_GREEN,
  ];

  if (text.length === 0) return text;

  let result = '';
  const textLength = text.length;

  for (let i = 0; i < textLength; i++) {
    const position = (i / (textLength - 1 || 1)) * 100;
    const colorIndex = Math.floor((position / 100) * (colors.length - 1));
    result += colors[colorIndex] + text[i];
  }

  return result + COLORS.RESET;
}

function showBanner() {
  const version = getVersion();
  const tagline = "\${tagline || defaultTagline}";
  const gradientTagline = createGradientText(tagline);

  // ASCII art with gradient colors
  const asciiLines = [`;

  asciiArt.forEach((line, index) => {
    const colorVars = ['COLORS.PASTEL_PINK', 'COLORS.PASTEL_MAGENTA', 'COLORS.PASTEL_PURPLE', 'COLORS.PASTEL_BLUE', 'COLORS.PASTEL_CYAN', 'COLORS.PASTEL_GREEN'];
    const color = colorVars[index % colorVars.length];
    script += `\n    \`    \${${color}}${line}\${COLORS.RESET}\`,`;
  });

  if (name) {
    script += `\n    \`    \${COLORS.PASTEL_PINK}╔══════════════════════════════════════════════════════════════╗\${COLORS.RESET}\`,`;
    script += `\n    \`    \${COLORS.PASTEL_MAGENTA}║ ${name.padEnd(55)} ║\${COLORS.RESET}\`,`;
    script += `\n    \`    \${COLORS.PASTEL_PURPLE}╚══════════════════════════════════════════════════════════════╝\${COLORS.RESET}\`,`;
  }

  script += `  ];

  // Calculate padding for centered tagline
  const maxWidth = Math.max(...asciiLines.map(line => removeAnsi(line).length));
  const taglineLength = tagline.length;
  const leftPad = Math.floor((maxWidth - taglineLength) / 2);

  // Print ASCII art and tagline
  for (const line of asciiLines) {
    console.log(line);
  }
  console.log(' '.repeat(leftPad + 4) + gradientTagline);
  console.log();
}

// Usage: showBanner()
showBanner();
`;

  return script;
}

function showHelp() {
  console.log('\n' + createGradientText('ASCII Art Generator') + ` - ${PASTEL_COLORS.CYAN}v${getVersion()}${PASTEL_COLORS.RESET}

${PASTEL_COLORS.PINK}USAGE:${PASTEL_COLORS.RESET}
  node ascii-generator.js [options]
  node ascii-generator.js --interactive

${PASTEL_COLORS.PINK}OPTIONS:${PASTEL_COLORS.RESET}
  ${PASTEL_COLORS.MAGENTA}--help, -h${PASTEL_COLORS.RESET}              Show this help message
  ${PASTEL_COLORS.MAGENTA}--interactive, -i${PASTEL_COLORS.RESET}       Run in interactive mode
  ${PASTEL_COLORS.MAGENTA}--type=<type>${PASTEL_COLORS.RESET}           ASCII art type (docker, android, ports, generic)
  ${PASTEL_COLORS.MAGENTA}--lang=<language>${PASTEL_COLORS.RESET}       Target language (bash, fish, python, node)
  ${PASTEL_COLORS.MAGENTA}--name=<name>${PASTEL_COLORS.RESET}           Custom name to display under ASCII art
  ${PASTEL_COLORS.MAGENTA}--tagline=<text>${PASTEL_COLORS.RESET}        Custom tagline
  ${PASTEL_COLORS.MAGENTA}--output=<file>${PASTEL_COLORS.RESET}         Save output to file instead of stdout

${PASTEL_COLORS.PINK}AVAILABLE TYPES:${PASTEL_COLORS.RESET}
  ${PASTEL_COLORS.CYAN}• docker${PASTEL_COLORS.RESET}   Docker whale ASCII art
  ${PASTEL_COLORS.CYAN}• android${PASTEL_COLORS.RESET}  Android robot ASCII art
  ${PASTEL_COLORS.CYAN}• ports${PASTEL_COLORS.RESET}    "PORTS" text ASCII art
  ${PASTEL_COLORS.CYAN}• generic${PASTEL_COLORS.RESET}  Generic box ASCII art

${PASTEL_COLORS.PINK}SUPPORTED LANGUAGES:${PASTEL_COLORS.RESET}
  ${PASTEL_COLORS.GREEN}• bash${PASTEL_COLORS.RESET}    Bash shell script
  ${PASTEL_COLORS.GREEN}• fish${PASTEL_COLORS.RESET}    Fish shell script
  ${PASTEL_COLORS.GREEN}• python${PASTEL_COLORS.RESET}  Python 3 script
  ${PASTEL_COLORS.GREEN}• node${PASTEL_COLORS.RESET}    Node.js script

${PASTEL_COLORS.PINK}EXAMPLES:${PASTEL_COLORS.RESET}
  ${PASTEL_COLORS.YELLOW}# Generate Docker header for Bash${PASTEL_COLORS.RESET}
  node ascii-generator.js --type=docker

  ${PASTEL_COLORS.YELLOW}# Generate Android header for Fish with custom name${PASTEL_COLORS.RESET}
  node ascii-generator.js --type=android --lang=fish --name="Android Manager"

  ${PASTEL_COLORS.YELLOW}# Generate Ports header and save to file${PASTEL_COLORS.RESET}
  node ascii-generator.js --type=ports --output=header.sh

  ${PASTEL_COLORS.YELLOW}# Generate generic header with custom tagline${PASTEL_COLORS.RESET}
  node ascii-generator.js --type=generic --name="My App" --tagline="Custom Application"

  ${PASTEL_COLORS.YELLOW}# Run in interactive mode${PASTEL_COLORS.RESET}
  node ascii-generator.js --interactive
`);
}

// Interactive mode interface
async function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise(resolve => {
    rl.question(prompt, resolve);
  });

  const showWelcome = () => {
    console.log('\n' + createGradientText('ASCII Art Generator - Interactive Mode'));
    console.log(`${PASTEL_COLORS.CYAN}Let's create your perfect ASCII header!${PASTEL_COLORS.RESET}\n`);
  };

  const showTypes = () => {
    console.log(`${PASTEL_COLORS.PINK}Available ASCII Art Types:${PASTEL_COLORS.RESET}`);
    const types = Object.keys(ASCII_TEMPLATES);
    types.forEach((type, index) => {
      const preview = type.charAt(0).toUpperCase() + type.slice(1);
      console.log(`  ${PASTEL_COLORS.GREEN}${index + 1}.${PASTEL_COLORS.RESET} ${PASTEL_COLORS.CYAN}${preview}${PASTEL_COLORS.RESET}`);
    });
    console.log('');
  };

  const showLanguages = () => {
    console.log(`${PASTEL_COLORS.PINK}Supported Languages:${PASTEL_COLORS.RESET}`);
    const languages = [
      { name: 'bash', desc: 'Bash shell script' },
      { name: 'fish', desc: 'Fish shell script' },
      { name: 'python', desc: 'Python 3 script' },
      { name: 'node', desc: 'Node.js script' }
    ];
    languages.forEach((lang, index) => {
      console.log(`  ${PASTEL_COLORS.GREEN}${index + 1}.${PASTEL_COLORS.RESET} ${PASTEL_COLORS.CYAN}${lang.name.padEnd(7)}${PASTEL_COLORS.RESET} - ${lang.desc}`);
    });
    console.log('');
  };

  const getTypeChoice = async () => {
    showTypes();
    const promptText = `${PASTEL_COLORS.YELLOW}Choose ASCII art type (1-${Object.keys(ASCII_TEMPLATES).length}) [1]:${PASTEL_COLORS.RESET} `;
    const choice = await question(promptText);
    const types = Object.keys(ASCII_TEMPLATES);
    const index = parseInt(choice) - 1;

    if (isNaN(index) || index < 0 || index >= types.length) {
      console.log(`${PASTEL_COLORS.GREEN}Using default: generic${PASTEL_COLORS.RESET}`);
      return 'generic';
    }

    return types[index];
  };

  const getLanguageChoice = async () => {
    showLanguages();
    const promptText = `${PASTEL_COLORS.YELLOW}Choose target language (1-4) [1]:${PASTEL_COLORS.RESET} `;
    const choice = await question(promptText);
    const languages = ['bash', 'fish', 'python', 'node'];
    const index = parseInt(choice) - 1;

    if (isNaN(index) || index < 0 || index >= languages.length) {
      console.log(`${PASTEL_COLORS.GREEN}Using default: bash${PASTEL_COLORS.RESET}`);
      return 'bash';
    }

    return languages[index];
  };

  const getName = async () => {
    const promptText = `${PASTEL_COLORS.YELLOW}Enter custom name (optional, press Enter to skip):${PASTEL_COLORS.RESET} `;
    const name = await question(promptText);
    return name.trim();
  };

  const getTagline = async () => {
    const version = getVersion();
    const defaultTagline = `By Remco Stoeten v${version}`;
    const promptText = `${PASTEL_COLORS.YELLOW}Enter custom tagline [${defaultTagline}]:${PASTEL_COLORS.RESET} `;
    const tagline = await question(promptText);
    return tagline.trim() || null;
  };

  const getOutputFile = async () => {
    const promptText = `${PASTEL_COLORS.YELLOW}Save to file (optional, press Enter to print to console):${PASTEL_COLORS.RESET} `;
    const output = await question(promptText);
    return output.trim() || null;
  };

  const askToSaveToFile = async () => {
    console.log(`\n${PASTEL_COLORS.PINK}Would you like to save this ASCII art to an executable file?${PASTEL_COLORS.RESET}`);
    console.log(`  ${PASTEL_COLORS.GREEN}Y${PASTEL_COLORS.RESET} - Yes, save to file`);
    console.log(`  ${PASTEL_COLORS.GREEN}n${PASTEL_COLORS.RESET} - No, just show me the output`);
    console.log(`  ${PASTEL_COLORS.GREEN}c${PASTEL_COLORS.RESET} - Copy to clipboard`);

    const choice = await question(`${PASTEL_COLORS.YELLOW}Your choice (Y/n/c):${PASTEL_COLORS.RESET} `);
    return choice.trim().toLowerCase();
  };

  const getPathChoice = async () => {
    console.log(`\n${PASTEL_COLORS.PINK}Where would you like to save the file?${PASTEL_COLORS.RESET}`);
    console.log(`  ${PASTEL_COLORS.GREEN}1${PASTEL_COLORS.RESET} - Current directory (auto-generated filename)`);
    console.log(`  ${PASTEL_COLORS.GREEN}2${PASTEL_COLORS.RESET} - Custom path`);

    const choice = await question(`${PASTEL_COLORS.YELLOW}Your choice (1/2) [1]:${PASTEL_COLORS.RESET} `);
    return choice.trim() || '1';
  };

  const getCustomPath = async () => {
    const promptText = `${PASTEL_COLORS.YELLOW}Enter custom file path:${PASTEL_COLORS.RESET} `;
    const path = await question(promptText);
    return path.trim();
  };

  const generateFileName = (type) => {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    return `ascii-banner-${type}-${date}.sh`;
  };

  const makeExecutable = async (filePath) => {
    try {
      const { execSync } = require('child_process');
      execSync(`chmod +x "${filePath}"`, { stdio: 'ignore' });
      console.log(`${PASTEL_COLORS.GREEN}✓ Made file executable: ${PASTEL_COLORS.CYAN}${filePath}${PASTEL_COLORS.RESET}`);
    } catch (error) {
      console.log(`${PASTEL_COLORS.YELLOW}⚠ Could not make file executable: ${error.message}${PASTEL_COLORS.RESET}`);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      const { execSync } = require('child_process');

      // Try different clipboard methods based on what's available
      if (process.platform === 'darwin') {
        // macOS
        execSync('pbcopy', { input: text });
        console.log(`${PASTEL_COLORS.GREEN}✓ ASCII header copied to clipboard${PASTEL_COLORS.RESET}`);
      } else if (process.platform === 'linux') {
        // Linux - try xclip first, then xsel
        try {
          execSync('which xclip', { stdio: 'ignore' });
          execSync('xclip -selection clipboard', { input: text });
          console.log(`${PASTEL_COLORS.GREEN}✓ ASCII header copied to clipboard${PASTEL_COLORS.RESET}`);
        } catch {
          try {
            execSync('which xsel', { stdio: 'ignore' });
            execSync('xsel --clipboard --input', { input: text });
            console.log(`${PASTEL_COLORS.GREEN}✓ ASCII header copied to clipboard${PASTEL_COLORS.RESET}`);
          } catch {
            console.log(`${PASTEL_COLORS.YELLOW}⚠ Clipboard not available. Please install xclip or xsel${PASTEL_COLORS.RESET}`);
            return false;
          }
        }
      } else {
        console.log(`${PASTEL_COLORS.YELLOW}⚠ Clipboard not supported on this platform${PASTEL_COLORS.RESET}`);
        return false;
      }
      return true;
    } catch (error) {
      console.log(`${PASTEL_COLORS.YELLOW}⚠ Could not copy to clipboard: ${error.message}${PASTEL_COLORS.RESET}`);
      return false;
    }
  };

  const generateAndShow = async (options) => {
    const { type, lang, name, tagline, output } = options;

    console.log(`\n${PASTEL_COLORS.PINK}Generating ASCII header...${PASTEL_COLORS.RESET}\n`);

    let header;
    switch (lang) {
      case 'fish':
        header = generateFishHeader({ type, name, tagline });
        break;
      case 'python':
      case 'py':
        header = generatePythonHeader({ type, name, tagline });
        break;
      case 'node':
      case 'js':
        header = generateNodeHeader({ type, name, tagline });
        break;
      case 'bash':
      default:
        header = generateBashHeader({ type, name, tagline });
        break;
    }

    // If output was specified directly, use that behavior
    if (output) {
      try {
        fs.writeFileSync(output, header);
        console.log(`${PASTEL_COLORS.GREEN}✓ ASCII header generated and saved to: ${PASTEL_COLORS.CYAN}${output}${PASTEL_COLORS.RESET}`);
        await makeExecutable(output);
        console.log('');
      } catch (error) {
        console.error(`${PASTEL_COLORS.RED}Error writing to file '${output}': ${error.message}${PASTEL_COLORS.RESET}\n`);
      }
      return;
    }

    // New interactive behavior for file saving
    const saveChoice = await askToSaveToFile();

    if (saveChoice === 'y' || saveChoice === 'yes' || saveChoice === '') {
      // User wants to save to file
      const pathChoice = await getPathChoice();
      let filePath;

      if (pathChoice === '1') {
        // Current directory with auto-generated filename
        filePath = generateFileName(type);
      } else {
        // Custom path
        const customPath = await getCustomPath();
        if (customPath) {
          filePath = customPath;
        } else {
          console.log(`${PASTEL_COLORS.YELLOW}No path specified. Using current directory.${PASTEL_COLORS.RESET}`);
          filePath = generateFileName(type);
        }
      }

      try {
        fs.writeFileSync(filePath, header);
        console.log(`${PASTEL_COLORS.GREEN}✓ ASCII header generated and saved to: ${PASTEL_COLORS.CYAN}${filePath}${PASTEL_COLORS.RESET}`);
        await makeExecutable(filePath);
        console.log('');
      } catch (error) {
        console.error(`${PASTEL_COLORS.RED}Error writing to file '${filePath}': ${error.message}${PASTEL_COLORS.RESET}\n`);
        console.log(`${PASTEL_COLORS.CYAN}--- Generated ASCII Header ---${PASTEL_COLORS.RESET}\n`);
        console.log(header);
      }
    } else if (saveChoice === 'c') {
      // Copy to clipboard
      const success = await copyToClipboard(header);
      if (!success) {
        console.log(`${PASTEL_COLORS.CYAN}--- Generated ASCII Header ---${PASTEL_COLORS.RESET}\n`);
        console.log(header);
      }
    } else {
      // Just show the output
      console.log(`${PASTEL_COLORS.CYAN}--- Generated ASCII Header ---${PASTEL_COLORS.RESET}\n`);
      console.log(header);
    }
  };

  // Main interactive flow
  showWelcome();

  const type = await getTypeChoice();
  const lang = await getLanguageChoice();
  const name = await getName();
  const tagline = await getTagline();

  await generateAndShow({ type, lang, name, tagline });

  rl.close();
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  const options = {};

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      showHelp();
      return;
    }

    if (arg === '--interactive' || arg === '-i') {
      interactiveMode();
      return;
    }

    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      options[key] = value || true;
    }
  }

  // Validate options
  if (options.type && !Object.keys(ASCII_TEMPLATES).includes(options.type)) {
    console.error(`${PASTEL_COLORS.RED}Error: Invalid type '${options.type}'${PASTEL_COLORS.RESET}`);
    console.error(`${PASTEL_COLORS.YELLOW}Available types: ${Object.keys(ASCII_TEMPLATES).join(', ')}${PASTEL_COLORS.RESET}`);
    process.exit(1);
  }

  if (options.lang && !['bash', 'fish', 'python', 'node', 'py', 'js'].includes(options.lang)) {
    console.error(`${PASTEL_COLORS.RED}Error: Invalid language '${options.lang}'${PASTEL_COLORS.RESET}`);
    console.error(`${PASTEL_COLORS.YELLOW}Available languages: bash, fish, python, node${PASTEL_COLORS.RESET}`);
    process.exit(1);
  }

  const { type = 'generic', lang = 'bash', name = '', tagline = null, output = null } = options;

  let header;
  switch (lang) {
    case 'fish':
      header = generateFishHeader({ type, name, tagline });
      break;
    case 'python':
    case 'py':
      header = generatePythonHeader({ type, name, tagline });
      break;
    case 'node':
    case 'js':
      header = generateNodeHeader({ type, name, tagline });
      break;
    case 'bash':
    default:
      header = generateBashHeader({ type, name, tagline });
      break;
  }

  if (output) {
    try {
      fs.writeFileSync(output, header);
      console.log(`${PASTEL_COLORS.GREEN}✓ ASCII header generated and saved to: ${PASTEL_COLORS.CYAN}${output}${PASTEL_COLORS.RESET}`);

      // Make the file executable
      const { execSync } = require('child_process');
      try {
        execSync(`chmod +x "${output}"`, { stdio: 'ignore' });
        console.log(`${PASTEL_COLORS.GREEN}✓ Made file executable${PASTEL_COLORS.RESET}`);
      } catch (error) {
        console.log(`${PASTEL_COLORS.YELLOW}⚠ Could not make file executable: ${error.message}${PASTEL_COLORS.RESET}`);
      }
    } catch (error) {
      console.error(`${PASTEL_COLORS.RED}Error writing to file '${output}': ${error.message}${PASTEL_COLORS.RESET}`);
      process.exit(1);
    }
  } else {
    console.log(header);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  generateBashHeader,
  generateFishHeader,
  generatePythonHeader,
  generateNodeHeader,
  ASCII_TEMPLATES,
  PASTEL_COLORS,
};