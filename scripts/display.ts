#!/usr/bin/env bun
import { execSync, spawn } from 'child_process';
import readline from 'readline';

interface Display {
    id: string;
    name: string;
    connected: boolean;
    resolution: string;
    currentResolution: string;
    refreshRate: string;
    physicalSize: string;
    position: string;
    primary: boolean;
    inches?: number;
    zoom?: number;
    isExternal?: boolean;
    brand?: string;
    model?: string;
    nightlightStrength?: number;
}

interface DisplayMode {
    resolution: string;
    refreshRate: string;
    isCurrent: boolean;
}

const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

function c(color: keyof typeof COLORS, text: string): string {
    return `${COLORS[color]}${text}${COLORS.reset}`;
}

// Levenshtein distance implementation for fuzzy matching
function levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[str2.length][str1.length];
}

// Check if input is a close typo of "display"
function isCloseTypo(input: string): { isTypo: boolean; confidence: number } {
    const target = "display";
    const normalizedInput = input.toLowerCase().trim();

    // Exact match
    if (normalizedInput === target) {
        return { isTypo: false, confidence: 0 };
    }

    // Common typos dictionary
    const commonTypos = [
        "disply", "dislpay", "dispay", "diplay", "dispaly",
        "dispay", "disply", "dipslay", "dispaly", "dislpay",
        "displya", "displlay", "displaaay", "displey", "displai",
        "displayy", "displaya", "desplay", "dasplay", "dysplay",
        "dyslpay", "disp", "displa", "displ", "displaay",
        "diisplay", "diisplay", "displa", "dislpay", "desplay",
        "dissplay", "disssplay", "displlay", "displlay"
    ];

    // Check if it's a known typo
    if (commonTypos.includes(normalizedInput)) {
        return { isTypo: true, confidence: 0.8 };
    }

    // Calculate Levenshtein distance
    const distance = levenshteinDistance(normalizedInput, target);
    const maxLen = Math.max(normalizedInput.length, target.length);
    const similarity = 1 - (distance / maxLen);

    // Consider it a typo if similarity is high enough and length is reasonable
    if (similarity >= 0.7 && normalizedInput.length >= 4) {
        return { isTypo: true, confidence: similarity };
    }

    return { isTypo: false, confidence: 0 };
}

// Ask user if they meant "display"
async function askDidYouMean(input: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(
            c('yellow', `Did you mean ${c('bright', c('white', '"display"'))} instead of ${c('bright', c('red', `"${input}"`))}? (Y/n): `),
            (answer) => {
                rl.close();
                const normalizedAnswer = answer.trim().toLowerCase();
                resolve(normalizedAnswer === '' || normalizedAnswer === 'y' || normalizedAnswer === 'yes');
            }
        );
    });
}

function clearScreen() {
    process.stdout.write('\x1B[2J\x1B[0f');
}

function showBanner() {
    console.log(c('cyan', '╔══════════════════════════════════════════════════════════════════════════════╗'));
    console.log(c('cyan', '║') + c('bright', c('white', '                    DISPLAY CONTROL CENTER                         ') + c('cyan', ' ║')));
    console.log(c('cyan', '╚══════════════════════════════════════════════════════════════════════════════╝'));
    console.log();
}

function showHelp() {
    clearScreen();
    showBanner();

    console.log(c('bright', c('cyan', 'USAGE:') + ' ' + c('white', 'display [OPTIONS] [SUBCOMMANDS]')));
    console.log();

    console.log(c('bright', c('cyan', 'OPTIONS:')));
    console.log(c('white', '  help, --help, -h') + c('dim', c('white', '          Show this help message')));
    console.log(c('white', '  interactive') + c('dim', c('white', '             Launch interactive display manager')));
    console.log(c('white', '  list') + c('dim', c('white', '                    List all displays and their information')));
    console.log(c('white', '  info') + c('dim', c('white', '                    Show detailed display information')));
    console.log();

    console.log(c('bright', c('cyan', 'SUBCOMMANDS:')));
    console.log(c('white', '  resolution [display] [mode]') + c('dim', c('white', '    Set display resolution')));
    console.log(c('white', '  brightness [display] [0-100]') + c('dim', c('white', '  Set display brightness')));
    console.log(c('white', '  rotate [display] [rotation]') + c('dim', c('white', '  Rotate display')));
    console.log(c('white', '  nightlight [on/off] [strength]') + c('dim', c('white', ' Control nightlight')));
    console.log(c('white', '  zoom [display] [percentage]') + c('dim', c('white', '  Set display zoom level')));
    console.log(c('white', '  off') + c('dim', c('white', '                     Turn off all displays immediately')));
    console.log(c('white', '  on [display]') + c('dim', c('white', '             Turn on specific display')));
    console.log();

    console.log(c('bright', c('magenta', 'CLI EXAMPLES:')));
    console.log(c('cyan', '  display help') + c('dim', c('white', '                           Show this help')));
    console.log(c('cyan', '  display list') + c('dim', c('white', '                           List all displays')));
    console.log(c('cyan', '  display resolution HDMI-1 1920x1080') + c('dim', c('white', '      Set HDMI-1 to 1080p')));
    console.log(c('cyan', '  display brightness eDP-1 75') + c('dim', c('white', '           Set laptop brightness to 75%')));
    console.log(c('cyan', '  display rotate HDMI-1 left') + c('dim', c('white', '           Rotate HDMI-1 90° left')));
    console.log(c('cyan', '  display nightlight on 80') + c('dim', c('white', '            Enable nightlight at 80%')));
    console.log(c('cyan', '  display nightlight off') + c('dim', c('white', '              Disable nightlight')));
    console.log(c('cyan', '  display zoom HDMI-1 125') + c('dim', c('white', '              Set HDMI-1 zoom to 125%')));
    console.log(c('cyan', '  display off') + c('dim', c('white', '                            Turn off all displays')));
    console.log(c('cyan', '  display on HDMI-1') + c('dim', c('white', '                     Turn on HDMI-1')));
    console.log();

    console.log(c('dim', c('blue', 'Note: This tool requires xrandr for display management. Nightlight works best on GNOME or with redshift installed.')));
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (command === 'help' || command === '--help' || command === '-h') {
        showHelp();
        return;
    }

    if (command === 'interactive' || !command) {
        console.log(c('yellow', 'Interactive mode would launch here'));
        console.log(c('cyan', 'For now, try: display help'));
        return;
    }

    // Check for potential typos
    if (command) {
        const typoCheck = isCloseTypo(command);
        if (typoCheck.isTypo) {
            const confirmed = await askDidYouMean(command);
            if (confirmed) {
                console.log(c('green', '\n✓ Assuming you meant "display"...'));
                console.log(c('cyan', 'For now, try: display help'));
                return;
            } else {
                console.log(c('red', '\n✗ Command not recognized.'));
                showHelp();
                return;
            }
        }
    }

    console.log(c('yellow', `Unknown command: ${command}`));
    console.log(c('cyan', 'Use "display help" to see available commands.'));
    showHelp();
}

main().catch(error => {
    console.error(c('red', 'An error occurred:'), error);
    process.exit(1);
});