// ANSI color codes for terminal output
export const COLORS = {
    RESET: '\x1b[0m',
    BRIGHT: '\x1b[1m',
    DIM: '\x1b[2m',
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[38;2;178;242;187m',    // Using pastel green for softer look
    BLUE: '\x1b[34m',
    MAGENTA: '\x1b[35m',
    CYAN: '\x1b[36m',
    WHITE: '\x1b[37m',
    BG_RED: '\x1b[41m',
    BG_GREEN: '\x1b[42m',
    BG_YELLOW: '\x1b[43m',
    BG_BLUE: '\x1b[44m',
    BG_MAGENTA: '\x1b[45m',
    BG_CYAN: '\x1b[46m',
    HEX: (hex: string) => `\x1b[38;5;${hex}m`,
    BG_HEX: (hex: string) => `\x1b[48;5;${hex}m`,
    // Pastel colors matching cfg fish colors (RGB true color)
    RGB: (r: number, g: number, b: number) => `\x1b[38;2;${r};${g};${b}m`,
    PASTEL_PINK: '\x1b[38;2;250;162;193m',      // faa2c1
    PASTEL_MAGENTA: '\x1b[38;2;245;194;231m',  // f5c2e7
    PASTEL_PURPLE: '\x1b[38;2;212;187;248m',   // d4bbf8
    PASTEL_BLUE: '\x1b[38;2;165;216;255m',     // a5d8ff
    PASTEL_CYAN: '\x1b[38;2;137;220;235m',     // 89dceb
    PASTEL_GREEN: '\x1b[38;2;178;242;187m',    // b2f2bb
} as const;
/**
 * Clears the terminal screen
 */
export function clearScreen(): void {
    console.clear();
}

/**
 * Prints a header section with specified text
 * @param text - The header text to display
 */
export function printSectionHeader(text: string): void {
    console.log(`${COLORS.BRIGHT}${COLORS.WHITE}${text}${COLORS.RESET}\n`);
}

/**
 * Prints the breadcrumb navigation
 * @param path - Array of navigation items
 */
export function printBreadcrumb(path: string[]): void {
    console.log(`${COLORS.DIM}${path.join(' > ')}${COLORS.RESET}\n`);
}

/**
 * Creates a horizontal divider line
 * @param length - Length of the divider (default: 70)
 */
export function printDivider(length: number = 70): void {
    console.log('\n' + '─'.repeat(length));
}

/**
 * Formats a status string with appropriate color
 * @param status - The status string to format
 */
export function colorizeStatus(status: string): string {
    switch (status.toLowerCase()) {
        case 'running':
            return `${COLORS.GREEN}${status}${COLORS.RESET}`;
        case 'stopped':
        case 'exited':
            return `${COLORS.RED}${status}${COLORS.RESET}`;
        default:
            return `${COLORS.YELLOW}${status}${COLORS.RESET}`;
    }
}

/**
 * Prints a menu item with optional selection indicator
 * @param index - Menu item index
 * @param text - Menu item text
 * @param isSelected - Whether the item is currently selected
 * @param indicator - Optional indicator to show after the text
 */
export function printMenuItem(index: number, text: string, isSelected: boolean, indicator?: string): void {
    const prefix = isSelected ? `${COLORS.BG_CYAN}${COLORS.BRIGHT} ▶ ` : '   ';
    const suffix = isSelected ? ` ${COLORS.RESET}` : '';
    const indicatorText = indicator ? ` ${indicator}` : '';

    console.log(`${prefix}${text}${indicatorText}${suffix}`);
}

/**
 * Prints the footer with available commands
 * @param commands - Array of command descriptions
 */
export function printFooter(commands: string[]): void {
    printDivider();
    console.log(`${COLORS.DIM}${commands.join(' | ')}${COLORS.RESET}`);
}

/**
 * Shows a success message
 * @param message - The success message to display
 */
export function printSuccess(message: string): void {
    console.log(`${COLORS.GREEN}✓ ${message}${COLORS.RESET}`);
}

/**
 * Shows an error message
 * @param message - The error message to display
 */
export function printError(message: string): void {
    console.log(`${COLORS.RED}✗ ${message}${COLORS.RESET}`);
}

/**
 * Shows a warning message
 * @param message - The warning message to display
 */
export function printWarning(message: string): void {
    console.log(`${COLORS.YELLOW}⚠ ${message}${COLORS.RESET}`);
}

/**
 * Formats a file size in bytes to a human-readable string
 * @param bytes - The size in bytes
 */
export function formatSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Formats elapsed time in seconds to a human-readable string
 * @param seconds - The number of seconds
 */
export function formatElapsedTime(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}
