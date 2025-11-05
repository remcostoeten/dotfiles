import { readFileSync } from 'fs';
import type { TContainer, TContainerStats, TViewState } from './types.js';
import {
    COLORS, printMenuItem,
    printDivider, colorizeStatus
} from './ui-utils.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
/**
 * Creates a gradient effect on text by applying colors character by character
 */
function createGradientText(text: string, colors: string[]): string {
    if (text.length === 0) return text;
    if (colors.length === 1) return colors[0] + text + COLORS.RESET;

    const result: string[] = [];
    const colorCount = colors.length;

    for (let i = 0; i < text.length; i++) {
        // Calculate color index with smooth interpolation
        const position = i / (text.length - 1 || 1); // 0 to 1
        const colorIndex = position * (colorCount - 1);

        // Get the two colors to interpolate between
        const color1Index = Math.floor(colorIndex);
        const color2Index = Math.ceil(colorIndex);
        const t = colorIndex - color1Index;

        let color: string;
        if (color1Index === color2Index) {
            color = colors[color1Index];
        } else {
            color = interpolateColors(colors[color1Index], colors[color2Index], t);
        }

        result.push(color + text[i]);
    }

    return result.join('') + COLORS.RESET;
}

/**
 * Interpolates between two RGB ANSI color codes
 */
function interpolateColors(color1: string, color2: string, t: number): string {
    // Extract RGB values from ANSI codes like \x1b[38;2;250;162;193m
    const extractRGB = (color: string) => {
        const match = color.match(/\x1b\[38;2;(\d+);(\d+);(\d+)m/);
        if (match) {
            return {
                r: parseInt(match[1]),
                g: parseInt(match[2]),
                b: parseInt(match[3])
            };
        }
        // Fallback to pastel colors
        return { r: 200, g: 200, b: 200 };
    };

    const rgb1 = extractRGB(color1);
    const rgb2 = extractRGB(color2);

    // Linear interpolation
    const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * t);
    const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * t);
    const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * t);

    return COLORS.RGB(r, g, b);
}

/**
 * Prints the Docker whale ASCII art header with pastel colors.
 * ASCII art positioning stays fixed, only tagline is centered
 * relative to the ASCII width.
 */
export function printHeader(): void {
    const pink = COLORS.PASTEL_PINK;
    const magenta = COLORS.PASTEL_MAGENTA;
    const purple = COLORS.PASTEL_PURPLE;
    const blue = COLORS.PASTEL_BLUE;
    const cyan = COLORS.PASTEL_CYAN;
    const green = COLORS.PASTEL_GREEN;
    const reset = COLORS.RESET;

    // Determine path to VERSION that works anywhere
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    let v = 'unknown';
    try {
        const absolutePath = join(__dirname, '..', '..', '..', 'VERSION');
        v = readFileSync(absolutePath, 'utf-8').trim();
    } catch {
        v = 'unknown';
    }

    const asciiLines = [
        '    ' + pink + '██████╗  ██████╗  ██████╗██╗  ██╗███████╗██████╗ ' + reset,
        '    ' + magenta + '██╔══██╗██╔═══██╗██╔════╝██║ ██╔╝██╔════╝██╔══██╗' + reset,
        '    ' + purple + '██║  ██║██║   ██║██║     █████╔╝ █████╗  ██████╔╝' + reset,
        '    ' + blue + '██║  ██║██║   ██║██║     ██╔═██╗ ██╔══╝  ██╔══██╗' + reset,
        '    ' + cyan + '██████╔╝╚██████╔╝╚██████╗██║  ██╗███████╗██║  ██║' + reset,
        '    ' + green + '╚═════╝  ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝' + reset,
    ];

    // Define gradient colors for the tagline (pastel rainbow)
    const gradientColors = [
        COLORS.PASTEL_PINK,
        COLORS.PASTEL_MAGENTA,
        COLORS.PASTEL_PURPLE,
        COLORS.PASTEL_BLUE,
        COLORS.PASTEL_CYAN,
        COLORS.PASTEL_GREEN,
    ];

    const taglineText = `By Remco Stoeten v${v}`;
    const gradientTagline = createGradientText(taglineText, gradientColors);

    // Compute visible width of ASCII (remove ANSI and measure longest line)
    const maxWidth = Math.max(...asciiLines.map(line => removeAnsi(line).length));

    // Compute padding to center tagline relative to ASCII art width
    const leftPad = Math.max(0, Math.floor((maxWidth - taglineText.length) / 2));
    console.log(' '.repeat(leftPad + 4) + gradientTagline); // +4 for the ASCII "    " indent

    // Print fixed-position ASCII art (unchanged)
    asciiLines.forEach(line => console.log(line));
}

/**
 * Removes ANSI color codes from a string so centering is calculated correctly
 */
function removeAnsi(text: string): string {
    return text.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
}

/**
 * Prints container details in a formatted view
 */
export function printContainerDetails(container: TContainer): void {
    console.log(`${COLORS.CYAN}ID:${COLORS.RESET} ${container.id}`);
    console.log(`${COLORS.CYAN}Name:${COLORS.RESET} ${container.name}`);
    console.log(`${COLORS.CYAN}Image:${COLORS.RESET} ${container.image}`);
    console.log(
        `${COLORS.CYAN}Status:${COLORS.RESET} ${colorizeStatus(container.status)}`
    );
    console.log(`${COLORS.CYAN}Created:${COLORS.RESET} ${container.created}`);
    console.log(`${COLORS.CYAN}Size:${COLORS.RESET} ${container.size}`);

    if (container.ports.length > 0) {
        console.log(`${COLORS.CYAN}Ports:${COLORS.RESET}`);
        container.ports.forEach((port) => console.log(`  ${port}`));
    }
}

/**
 * Displays container statistics in a formatted view
 */
export function printContainerStats(
    container: TContainer,
    stats: TContainerStats
): void {
    console.log(`${COLORS.BRIGHT}${COLORS.WHITE}CONTAINER STATISTICS${COLORS.RESET}`);
    console.log(`${COLORS.DIM}Container: ${container.name}${COLORS.RESET}\n`);

    console.log(`${COLORS.CYAN}CPU Usage:${COLORS.RESET} ${stats.cpu}`);

    const memoryBar = createProgressBar(stats.memory.percent, 40);
    console.log(`${COLORS.CYAN}Memory Usage:${COLORS.RESET}`);
    console.log(
        `  ${stats.memory.usage} / ${stats.memory.limit} (${stats.memory.percent.toFixed(
            1
        )}%)`
    );
    console.log(`  ${memoryBar}`);

    console.log(`${COLORS.CYAN}Network I/O:${COLORS.RESET}`);
    console.log(`  ↓ ${stats.network.rx}  ↑ ${stats.network.tx}`);

    console.log(`${COLORS.CYAN}Block I/O:${COLORS.RESET}`);
    console.log(`  Read: ${stats.blockIO.read}  Write: ${stats.blockIO.write}`);

    console.log(`${COLORS.CYAN}Running Processes:${COLORS.RESET} ${stats.pids}`);
}

/**
 * Creates a visual progress bar
 */
function createProgressBar(percent: number, width: number): string {
    const filled = Math.round(width * (percent / 100));
    const empty = width - filled;

    let color: string = COLORS.GREEN;
    if (percent > 80) color = COLORS.RED;
    else if (percent > 60) color = COLORS.YELLOW;

    return `${color}${'█'.repeat(filled)}${COLORS.DIM}${'░'.repeat(empty)}${COLORS.RESET}`;
}

/**
 * Prints a list of containers with their status
 */
export function printContainerList(
    containers: TContainer[],
    selectedIndex: number,
    multiSelect: Set<number>
): void {
    if (containers.length === 0) {
        console.log(`${COLORS.YELLOW}No containers found.${COLORS.RESET}\n`);
        return;
    }

    containers.forEach((container, index) => {
        const selected = index === selectedIndex;
        const indicator = multiSelect.has(index)
            ? `${COLORS.GREEN}✓${COLORS.RESET}`
            : '';
        const status = colorizeStatus(container.status);
        const text = `${container.name} (${status}) - ${container.image}`;
        printMenuItem(index, text, selected, indicator);
    });
}

/**
 * Prints container logs in a formatted view
 */
export function printContainerLogs(logs: string[]): void {
    if (logs.length === 0) {
        console.log(`${COLORS.YELLOW}No logs available.${COLORS.RESET}\n`);
        return;
    }

    logs.forEach((line) => {
        let color: string = COLORS.RESET;
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes('error') || lowerLine.includes('fail')) {
            color = COLORS.RED;
        } else if (lowerLine.includes('warn')) {
            color = COLORS.YELLOW;
        } else if (lowerLine.includes('info')) {
            color = COLORS.CYAN;
        }

        console.log(`${color}${line}${COLORS.RESET}`);
    });
}

/**
 * Prints the main menu options
 */
export function printMainMenu(selectedIndex: number): void {
    const options = [
        ' View Containers',
        ' Start/Stop Container',
        ' Remove Container',
        ' Container Stats',
        ' Quick Actions',
        ' Create PostgreSQL DB',
        ' Cleanup System',
        ' Exit',
    ];






    const addArrowToSelected = (option: string, index: number) => {
        const isSelected = index === selectedIndex;
        if (!isSelected) {
            return option;
        }
        return `${COLORS.BG_MAGENTA}${COLORS.BRIGHT} ▶ ${option}${COLORS.RESET}`;
    };

    options.forEach((option, index) => {
        printMenuItem(index, addArrowToSelected(option, index), false);
    });
}
/**
 * Prints loading indicator
 */
export function printLoading(message: string): void {
    console.log(`${COLORS.CYAN}⟳ ${message}...${COLORS.RESET}`);
}

/**
 * Prints command help based on current view
 */
export function printCommands(view: TViewState): void {
    const commonCommands = [
        '↑/↓ : Navigate',
        'Enter : Select',
        'Space : Toggle',
        'q : Quit',
        '⮜ Esc / ⤺ Backspace : Go Back',
    ];

    let commands: string[] = [...commonCommands];

    switch (view) {
        case 'containers':
            commands = [
                'Space: Toggle',
                's: Start/Stop',
                'r: Restart',
                'd: Delete',
                '/: Search',
                'c: Copy Env',
                'e: Exec',
                ...commonCommands,
            ];
            break;
        case 'logs':
            commands = ['f: Follow', 'c: Clear', 'u: Update', ...commonCommands];
            break;
        case 'details':
            commands = [
                'r: Refresh',
                'l: Logs',
                's: Stats',
                'c: Copy ID',
                'e: Copy Env',
                'x: Exec',
                ...commonCommands,
            ];
            break;
        case 'quick-actions':
            commands = ['Enter: Select Action', ...commonCommands];
            break;
        case 'create-postgres':
            commands = ['Tab: Next Field', 'Enter: Create', ...commonCommands];
            break;
    }

    printDivider();
    console.log(`${COLORS.DIM}${commands.join(' | ')}${COLORS.RESET}`);
}
