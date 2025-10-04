#!/usr/bin/env node

import { TerminalManager } from './terminal-manager';
import { COLORS, printError } from './ui-utils';

// Commands that can be run directly
const COMMANDS = {
    'list': 'List all containers',
    'start': 'Start a container',
    'stop': 'Stop a container',
    'remove': 'Remove a container',
    'logs': 'Show container logs',
    'stats': 'Show container stats',
    'cleanup': 'Clean up system',
    'help': 'Show this help message'
} as const;

type TCommand = keyof typeof COMMANDS;

function showHelp(): void {
    console.log('Docker Container Manager\n');
    console.log('Usage:');
    console.log('  docker-manager              Start interactive mode');
    console.log('  docker-manager <command>    Run a specific command\n');
    console.log('Available commands:');
    Object.entries(COMMANDS).forEach(([cmd, desc]) => {
        console.log(`  ${cmd.padEnd(10)} ${desc}`);
    });
    console.log();
}

function isValidCommand(cmd: string): cmd is TCommand {
    return cmd in COMMANDS;
}

async function main(): Promise<void> {
    try {
        const [,, command] = process.argv;

        if (command === 'help' || command === '--help' || command === '-h') {
            showHelp();
            return;
        }

        if (command && !isValidCommand(command)) {
            console.log(`${COLORS.RED}Error: Unknown command '${command}'${COLORS.RESET}\n`);
            showHelp();
            process.exit(1);
        }

        const manager = new TerminalManager();
        await manager.start();
    } catch (error) {
        printError(error instanceof Error ? error.message : 'An unknown error occurred');
        process.exit(1);
    }
}

// Handle process signals for cleanup
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT. Cleaning up...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM. Cleaning up...');
    process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error(`\n${COLORS.RED}Fatal error: ${error.message}${COLORS.RESET}`);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error(`\n${COLORS.RED}Unhandled rejection: ${reason}${COLORS.RESET}`);
    process.exit(1);
});

// Only run if this is the main module
if (require.main === module) {
    main().catch((error) => {
        console.error(`${COLORS.RED}Fatal error: ${error}${COLORS.RESET}`);
        process.exit(1);
    });
}