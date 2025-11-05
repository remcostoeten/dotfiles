export declare const COLORS: {
    readonly RESET: "\u001B[0m";
    readonly BRIGHT: "\u001B[1m";
    readonly DIM: "\u001B[2m";
    readonly RED: "\u001B[31m";
    readonly GREEN: "\u001B[32m";
    readonly YELLOW: "\u001B[38;2;178;242;187m";
    readonly BLUE: "\u001B[34m";
    readonly MAGENTA: "\u001B[35m";
    readonly CYAN: "\u001B[36m";
    readonly WHITE: "\u001B[37m";
    readonly BG_RED: "\u001B[41m";
    readonly BG_GREEN: "\u001B[42m";
    readonly BG_YELLOW: "\u001B[43m";
    readonly BG_BLUE: "\u001B[44m";
    readonly BG_MAGENTA: "\u001B[45m";
    readonly BG_CYAN: "\u001B[46m";
    readonly HEX: (hex: string) => string;
    readonly BG_HEX: (hex: string) => string;
    readonly RGB: (r: number, g: number, b: number) => string;
    readonly PASTEL_PINK: "\u001B[38;2;250;162;193m";
    readonly PASTEL_MAGENTA: "\u001B[38;2;245;194;231m";
    readonly PASTEL_PURPLE: "\u001B[38;2;212;187;248m";
    readonly PASTEL_BLUE: "\u001B[38;2;165;216;255m";
    readonly PASTEL_CYAN: "\u001B[38;2;137;220;235m";
    readonly PASTEL_GREEN: "\u001B[38;2;178;242;187m";
};
/**
 * Clears the terminal screen
 */
export declare function clearScreen(): void;
/**
 * Prints a header section with specified text
 * @param text - The header text to display
 */
export declare function printSectionHeader(text: string): void;
/**
 * Prints the breadcrumb navigation
 * @param path - Array of navigation items
 */
export declare function printBreadcrumb(path: string[]): void;
/**
 * Creates a horizontal divider line
 * @param length - Length of the divider (default: 70)
 */
export declare function printDivider(length?: number): void;
/**
 * Formats a status string with appropriate color
 * @param status - The status string to format
 */
export declare function colorizeStatus(status: string): string;
/**
 * Prints a menu item with optional selection indicator
 * @param index - Menu item index
 * @param text - Menu item text
 * @param isSelected - Whether the item is currently selected
 * @param indicator - Optional indicator to show after the text
 */
export declare function printMenuItem(index: number, text: string, isSelected: boolean, indicator?: string): void;
/**
 * Prints the footer with available commands
 * @param commands - Array of command descriptions
 */
export declare function printFooter(commands: string[]): void;
/**
 * Shows a success message
 * @param message - The success message to display
 */
export declare function printSuccess(message: string): void;
/**
 * Shows an error message
 * @param message - The error message to display
 */
export declare function printError(message: string): void;
/**
 * Shows a warning message
 * @param message - The warning message to display
 */
export declare function printWarning(message: string): void;
/**
 * Formats a file size in bytes to a human-readable string
 * @param bytes - The size in bytes
 */
export declare function formatSize(bytes: number): string;
/**
 * Formats elapsed time in seconds to a human-readable string
 * @param seconds - The number of seconds
 */
export declare function formatElapsedTime(seconds: number): string;
