import { exec } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';
import type { TResult } from './types';
import { COLORS } from './ui-utils';

const execAsync = promisify(exec);

type TNotificationType = 'success' | 'error' | 'warning' | 'info';

/**
 * Copies text to the system clipboard
 */
export async function copyToClipboard(text: string): Promise<TResult<void, string>> {
    const system = platform().toLowerCase();
    
    try {
        switch (system) {
            case 'linux': {
                // Try xclip first (X11)
                try {
                    await execAsync('which xclip');
                    await execAsync(`echo -n "${text}" | xclip -selection clipboard`);
                    return { ok: true, value: undefined };
                } catch {
                    // Try wl-copy (Wayland)
                    try {
                        await execAsync('which wl-copy');
                        await execAsync(`echo -n "${text}" | wl-copy`);
                        return { ok: true, value: undefined };
                    } catch {
                        return { ok: false, error: 'Please install xclip (X11) or wl-copy (Wayland) for clipboard support' };
                    }
                }
            }
            case 'darwin':
                await execAsync(`echo -n "${text}" | pbcopy`);
                return { ok: true, value: undefined };
            case 'win32':
                await execAsync(`echo ${text} | clip`);
                return { ok: true, value: undefined };
            default:
                return { ok: false, error: `Clipboard operations not supported on ${system}` };
        }
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to copy to clipboard' };
    }
}

/**
 * Shows a system notification
 */
export async function notifyUser(
    message: string,
    type: TNotificationType = 'info'
): Promise<TResult<void, string>> {
    const system = platform().toLowerCase();

    let icon = '🐳'; // Default Docker icon
    switch (type) {
        case 'success':
            icon = '✅';
            break;
        case 'error':
            icon = '❌';
            break;
        case 'warning':
            icon = '⚠️';
            break;
        case 'info':
            icon = 'ℹ️';
            break;
    }

    const title = 'Docker Manager';
    const fullMessage = `${icon} ${message}`;

    try {
        switch (system) {
            case 'linux': {
                // Try notify-send (Linux)
                try {
                    await execAsync('which notify-send');
                    await execAsync(`notify-send "${title}" "${fullMessage}"`);
                    return { ok: true, value: undefined };
                } catch {
                    // Fall back to console output if notify-send is not available
                    console.log(`\n${COLORS.BRIGHT}${title}${COLORS.RESET}`);
                    console.log(fullMessage);
                    return { ok: true, value: undefined };
                }
            }
            case 'darwin': {
                // Try terminal-notifier (macOS)
                try {
                    await execAsync('which terminal-notifier');
                    await execAsync(`terminal-notifier -title "${title}" -message "${fullMessage}"`);
                    return { ok: true, value: undefined };
                } catch {
                    // Fall back to osascript
                    await execAsync(`osascript -e 'display notification "${fullMessage}" with title "${title}"'`);
                    return { ok: true, value: undefined };
                }
            }
            default:
                // Fall back to console output for unsupported platforms
                console.log(`\n${COLORS.BRIGHT}${title}${COLORS.RESET}`);
                console.log(fullMessage);
                return { ok: true, value: undefined };
        }
    } catch (error) {
        // Even if notification fails, still show in console
        console.log(`\n${COLORS.BRIGHT}${title}${COLORS.RESET}`);
        console.log(fullMessage);
        return { ok: true, value: undefined };
    }
}

/**
 * Creates a progress updater function for long-running operations
 */
export function createProgressUpdater(
    operation: string,
    onUpdate?: (progress: number) => void
): () => void {
    let running = true;
    let dots = 0;

    // Start progress animation
    const interval = setInterval(() => {
        if (!running) return;

        dots = (dots + 1) % 4;
        const line = `${operation}${'.'.repeat(dots)}${' '.repeat(3 - dots)}`;
        
        // Clear line and write progress
        process.stdout.write(`\r${COLORS.CYAN}${line}${COLORS.RESET}`);
        
        if (onUpdate) {
            onUpdate(dots / 3);
        }
    }, 500);

    // Return cleanup function
    return () => {
        running = false;
        clearInterval(interval);
        process.stdout.write('\r' + ' '.repeat(operation.length + 3) + '\r'); // Clear progress line
    };
}

/**
 * Wrapper for long-running operations with progress indication
 */
export async function withProgress<T>(
    operation: string,
    task: () => Promise<T>
): Promise<T> {
    const stopProgress = createProgressUpdater(operation);
    try {
        const result = await task();
        stopProgress();
        return result;
    } catch (error) {
        stopProgress();
        throw error;
    }
}