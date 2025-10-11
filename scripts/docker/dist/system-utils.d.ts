import type { TResult } from './types.js';
type TNotificationType = 'success' | 'error' | 'warning' | 'info';
/**
 * Copies text to the system clipboard
 */
export declare function copyToClipboard(text: string): Promise<TResult<void, string>>;
/**
 * Shows a system notification
 */
export declare function notifyUser(message: string, type?: TNotificationType): Promise<TResult<void, string>>;
/**
 * Creates a progress updater function for long-running operations
 */
export declare function createProgressUpdater(operation: string, onUpdate?: (progress: number) => void): () => void;
/**
 * Wrapper for long-running operations with progress indication
 */
export declare function withProgress<T>(operation: string, task: () => Promise<T>): Promise<T>;
export {};
