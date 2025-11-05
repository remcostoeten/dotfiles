#!/usr/bin/env node

/**
 * Universal ASCII Art Generator
 *
 * This script generates consistent ASCII art headers for different scripts
 * across multiple languages (bash, fish, python, node.js).
 *
 * Usage:
 *   node ascii-generator.js --type=docker   # Generate Docker ASCII
 *   node ascii-generator.js --type=android  # Generate Android ASCII
 *   node ascii-generator.js --type=ports    # Generate Ports ASCII
 *   node ascii-generator.js --type=custom --name="My App" --art="custom"
 */

const fs = require('fs');
const path = require('path');

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
    local text_len=${#text}

    if [ $text_len -eq 0 ]; then
        echo "$text"
        return
    fi

    for ((i=0; i<text_len; i++)); do
        local position=$((i * 100 / (text_len - 1)))
        local color_index=$((position * (${#colors[@]} - 1) / 100))
        result+="${colors[$color_index]}${text:$i:1}"
    done
    printf '%b' "${result}${NC}"
}

show_banner() {
    local version=$(get_version)
    local tagline="${tagline:-"$defaultTagline"}"
    local gradient_tagline=$(create_gradient_text "$tagline")

    # ASCII art with gradient colors
    local ascii_lines=(`;

  asciiArt.forEach((line, index) => {
    const color = colors[index % colors.length];
    script += `\n        "    ${color}${line}${NC}"`;
  });

  if (name) {
    script += `
        "    ${PASTEL_COLORS.PINK}╔══════════════════════════════════════════════════════════════╗${NC}"
        "    ${PASTEL_COLORS.MAGENTA}║ ${name.padEnd(55)} ║${NC}"
        "    ${PASTEL_COLORS.PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"`;
  }

  script += `    )

    # Calculate padding for centered tagline
    local max_width=0
    for line in "${ascii_lines[@]}"; do
        local clean_line=$(remove_ansi "$line")
        local line_length=${#clean_line}
        if [ $line_length -gt $max_width ]; then
            max_width=$line_length
        fi
    done

    local tagline_length=${#tagline}
    local left_pad=$(((max_width - tagline_length) / 2))

    # Print ASCII art and tagline
    for line in "${ascii_lines[@]}"; do
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
    set tagline "${tagline:-"$defaultTagline"}"

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
    tagline = "${tagline or defaultTagline}"
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
  const tagline = "${tagline || defaultTagline}";
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
    fs.writeFileSync(output, header);
    console.log(`ASCII header generated and saved to: ${output}`);
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