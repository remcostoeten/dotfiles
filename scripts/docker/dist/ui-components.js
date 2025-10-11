import { COLORS, printMenuItem, printDivider, colorizeStatus } from './ui-utils.js';
/**
 * Prints the Docker whale ASCII art header
 */
export function printHeader() {
    console.log(`${COLORS.CYAN}${COLORS.BRIGHT}`);
    console.log('╔════════════════════════════════════════════════════════════════════╗');
    console.log('║                                                                    ║');
    console.log('║     ██████╗  ██████╗  ██████╗██╗  ██╗███████╗██████╗             ║');
    console.log('║     ██╔══██╗██╔═══██╗██╔════╝██║ ██╔╝██╔════╝██╔══██╗            ║');
    console.log('║     ██║  ██║██║   ██║██║     █████╔╝ █████╗  ██████╔╝            ║');
    console.log('║     ██║  ██║██║   ██║██║     ██╔═██╗ ██╔══╝  ██╔══██╗            ║');
    console.log('║     ██████╔╝╚██████╔╝╚██████╗██║  ██╗███████╗██║  ██║            ║');
    console.log('║     ╚═════╝  ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝            ║');
    console.log('║                                                                    ║');
    console.log('║                Container Management Interface v1.0                 ║');
    console.log('║                                                                    ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝');
    console.log(`${COLORS.RESET}\n`);
}
/**
 * Prints container details in a formatted view
 */
export function printContainerDetails(container) {
    console.log(`${COLORS.CYAN}ID:${COLORS.RESET} ${container.id}`);
    console.log(`${COLORS.CYAN}Name:${COLORS.RESET} ${container.name}`);
    console.log(`${COLORS.CYAN}Image:${COLORS.RESET} ${container.image}`);
    console.log(`${COLORS.CYAN}Status:${COLORS.RESET} ${colorizeStatus(container.status)}`);
    console.log(`${COLORS.CYAN}Created:${COLORS.RESET} ${container.created}`);
    console.log(`${COLORS.CYAN}Size:${COLORS.RESET} ${container.size}`);
    if (container.ports.length > 0) {
        console.log(`${COLORS.CYAN}Ports:${COLORS.RESET}`);
        container.ports.forEach(port => console.log(`  ${port}`));
    }
}
/**
 * Displays container statistics in a formatted view
 */
export function printContainerStats(container, stats) {
    console.log(`${COLORS.BRIGHT}${COLORS.WHITE}CONTAINER STATISTICS${COLORS.RESET}`);
    console.log(`${COLORS.DIM}Container: ${container.name}${COLORS.RESET}\n`);
    // CPU Usage
    console.log(`${COLORS.CYAN}CPU Usage:${COLORS.RESET} ${stats.cpu}`);
    // Memory Usage
    const memoryBar = createProgressBar(stats.memory.percent, 40);
    console.log(`${COLORS.CYAN}Memory Usage:${COLORS.RESET}`);
    console.log(`  ${stats.memory.usage} / ${stats.memory.limit} (${stats.memory.percent.toFixed(1)}%)`);
    console.log(`  ${memoryBar}`);
    // Network I/O
    console.log(`${COLORS.CYAN}Network I/O:${COLORS.RESET}`);
    console.log(`  ↓ ${stats.network.rx}  ↑ ${stats.network.tx}`);
    // Block I/O
    console.log(`${COLORS.CYAN}Block I/O:${COLORS.RESET}`);
    console.log(`  Read: ${stats.blockIO.read}  Write: ${stats.blockIO.write}`);
    // PIDs
    console.log(`${COLORS.CYAN}Running Processes:${COLORS.RESET} ${stats.pids}`);
}
/**
 * Creates a visual progress bar
 */
function createProgressBar(percent, width) {
    const filled = Math.round(width * (percent / 100));
    const empty = width - filled;
    let color = COLORS.GREEN;
    if (percent > 80)
        color = COLORS.RED;
    else if (percent > 60)
        color = COLORS.YELLOW;
    return `${color}${'█'.repeat(filled)}${COLORS.DIM}${'░'.repeat(empty)}${COLORS.RESET}`;
}
/**
 * Prints a list of containers with their status
 */
export function printContainerList(containers, selectedIndex, multiSelect) {
    if (containers.length === 0) {
        console.log(`${COLORS.YELLOW}No containers found.${COLORS.RESET}\n`);
        return;
    }
    containers.forEach((container, index) => {
        const selected = index === selectedIndex;
        const indicator = multiSelect.has(index) ? `${COLORS.GREEN}✓${COLORS.RESET}` : '';
        const status = colorizeStatus(container.status);
        const text = `${container.name} (${status}) - ${container.image}`;
        printMenuItem(index, text, selected, indicator);
    });
}
/**
 * Prints container logs in a formatted view
 */
export function printContainerLogs(logs) {
    if (logs.length === 0) {
        console.log(`${COLORS.YELLOW}No logs available.${COLORS.RESET}\n`);
        return;
    }
    logs.forEach(line => {
        // Try to detect log level from the line content
        let color = COLORS.RESET;
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes('error') || lowerLine.includes('fail')) {
            color = COLORS.RED;
        }
        else if (lowerLine.includes('warn')) {
            color = COLORS.YELLOW;
        }
        else if (lowerLine.includes('info')) {
            color = COLORS.CYAN;
        }
        console.log(`${color}${line}${COLORS.RESET}`);
    });
}
/**
 * Prints the main menu options
 */
export function printMainMenu(selectedIndex) {
    const options = [
        '📋 View Containers',
        '🔄 Start/Stop Container',
        '🗑️  Remove Container',
        '📊 Container Stats',
        '🧹 Cleanup System',
        '❌ Exit'
    ];
    options.forEach((option, index) => {
        printMenuItem(index, option, index === selectedIndex);
    });
}
/**
 * Prints loading indicator
 */
export function printLoading(message) {
    console.log(`${COLORS.CYAN}⟳ ${message}...${COLORS.RESET}`);
}
/**
 * Prints command help based on current view
 */
export function printCommands(view) {
    const commonCommands = ['↑↓: Navigate', 'Enter: Select', 'q: Quit', 'Backspace: Back'];
    let commands = [...commonCommands];
    switch (view) {
        case 'containers':
            commands = ['Space: Toggle Select', 'd: Delete', 's: Start/Stop', ...commonCommands];
            break;
        case 'logs':
            commands = ['f: Follow', 'c: Clear', ...commonCommands];
            break;
        case 'details':
            commands = ['r: Refresh', 'c: Copy ID', ...commonCommands];
            break;
    }
    printDivider();
    console.log(`${COLORS.DIM}${commands.join(' | ')}${COLORS.RESET}`);
}
//# sourceMappingURL=ui-components.js.map