#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Pastel colors matching cfg/docker scripts
const COLORS = {
  RESET: '\x1b[0m',
  PASTEL_PINK: '\x1b[38;2;250;162;193m',
  PASTEL_MAGENTA: '\x1b[38;2;212;187;248m',
  PASTEL_PURPLE: '\x1b[38;2;165;216;255m',
  PASTEL_BLUE: '\x1b[38;2;178;242;187m',
  PASTEL_CYAN: '\x1b[38;2;255;236;153m',
  PASTEL_GREEN: '\x1b[38;2;255;216;168m',
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
  const asciiLines = [
    `    ${COLORS.PASTEL_PINK}██████╗ ██████╗  ██████╗ ████████╗${COLORS.RESET}`,
    `    ${COLORS.PASTEL_MAGENTA}██╔══██╗██╔══██╗██╔═══██╗╚══██╔══╝${COLORS.RESET}`,
    `    ${COLORS.PASTEL_PURPLE}██████╔╝██████╔╝██║   ██║   ██║${COLORS.RESET}`,
    `    ${COLORS.PASTEL_BLUE}██╔══██╗██╔══██╗██║   ██║   ██║${COLORS.RESET}`,
    `    ${COLORS.PASTEL_CYAN}██████╔╝██████╔╝╚██████╔╝   ██║${COLORS.RESET}`,
    `    ${COLORS.PASTEL_GREEN}╚═════╝ ╚═════╝  ╚═════╝    ╚═╝${COLORS.RESET}`,
    `    ${COLORS.PASTEL_PINK}╔══════════════════════════════════════════════════════════════╗${COLORS.RESET}`,
    `    ${COLORS.PASTEL_MAGENTA}║ Jan                                                     ║${COLORS.RESET}`,
    `    ${COLORS.PASTEL_PURPLE}╚══════════════════════════════════════════════════════════════╝${COLORS.RESET}`,  ];

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
