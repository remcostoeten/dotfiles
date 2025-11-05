import type { TContainer, TContainerStats, TViewState } from './types.js';
/**
 * Prints the Docker whale ASCII art header with pastel colors.
 * ASCII art positioning stays fixed, only tagline is centered
 * relative to the ASCII width.
 */
export declare function printHeader(): void;
/**
 * Prints container details in a formatted view
 */
export declare function printContainerDetails(container: TContainer): void;
/**
 * Displays container statistics in a formatted view
 */
export declare function printContainerStats(container: TContainer, stats: TContainerStats): void;
/**
 * Prints a list of containers with their status
 */
export declare function printContainerList(containers: TContainer[], selectedIndex: number, multiSelect: Set<number>): void;
/**
 * Prints container logs in a formatted view
 */
export declare function printContainerLogs(logs: string[]): void;
/**
 * Prints the main menu options
 */
export declare function printMainMenu(selectedIndex: number): void;
/**
 * Prints loading indicator
 */
export declare function printLoading(message: string): void;
/**
 * Prints command help based on current view
 */
export declare function printCommands(view: TViewState): void;
