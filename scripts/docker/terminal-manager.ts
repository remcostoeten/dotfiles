import readline from 'readline';
import type { TContainer, TViewState } from './types.js';
import * as DockerUtils from './docker-utils.js';
import * as UI from './ui-components.js';
import * as SystemUtils from './system-utils.js';
import { clearScreen, COLORS, printError, printSuccess, printWarning, printMenuItem } from './ui-utils.js';
export class TerminalManager {
    private selectedIndex: number = 0;
    private multiSelect: Set<number> = new Set();
    private currentView: TViewState = 'main';
    private previousView: TViewState = 'main';
    private currentContainer: TContainer | null = null;
    private containers: TContainer[] = [];
    private filteredContainers: TContainer[] = [];
    private isRunning: boolean = true;
    private rl: readline.Interface;
    private searchQuery: string = '';
    private isSearching: boolean = false;
    private maxVisibleItems: number = 10;
    private scrollOffset: number = 0;

    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
    }

    async start(): Promise<void> {
        await this.checkDependencies();
        await this.showMainMenu();
        this.cleanup();
    }

    private async checkDependencies(): Promise<void> {
        const result = await DockerUtils.checkDockerDaemon();
        if (!result.ok) {
            clearScreen();
            UI.printHeader();
            printError('Docker daemon is not running');
            console.log('Please start Docker and try again.\n');
            process.exit(1);
        }
    }

    private async refreshContainers(): Promise<void> {
        const result = await DockerUtils.listContainers();
        if (result.ok) {
            this.containers = result.value;
            this.applyFilter();
        } else {
            printError(result.error);
            this.containers = [];
            this.filteredContainers = [];
        }
    }

    private applyFilter(): void {
        if (!this.searchQuery) {
            this.filteredContainers = this.containers;
        } else {
            const query = this.searchQuery.toLowerCase();
            this.filteredContainers = this.containers.filter(
                c => c.name.toLowerCase().includes(query) || c.image.toLowerCase().includes(query)
            );
        }
        // Reset selection if out of bounds
        if (this.selectedIndex >= this.filteredContainers.length) {
            this.selectedIndex = Math.max(0, this.filteredContainers.length - 1);
        }
        // Adjust scroll offset
        this.adjustScrollOffset();
    }

    private adjustScrollOffset(): void {
        const totalItems = this.filteredContainers.length;
        if (totalItems === 0) {
            this.scrollOffset = 0;
            return;
        }

        // If selected item is above visible area, scroll up
        if (this.selectedIndex < this.scrollOffset) {
            this.scrollOffset = this.selectedIndex;
        }
        // If selected item is below visible area, scroll down
        else if (this.selectedIndex >= this.scrollOffset + this.maxVisibleItems) {
            this.scrollOffset = this.selectedIndex - this.maxVisibleItems + 1;
        }

        // Ensure scroll offset is valid
        this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, totalItems - this.maxVisibleItems));
    }

    private getVisibleContainers(): TContainer[] {
        return this.filteredContainers.slice(this.scrollOffset, this.scrollOffset + this.maxVisibleItems);
    }

    private async showMainMenu(): Promise<void> {
        this.currentView = 'main';
        this.selectedIndex = 0;
        const maxIndex = 7; // 8 menu items (0-7)

        while (this.isRunning && this.currentView === 'main') {
            clearScreen();
            UI.printHeader();
            UI.printMainMenu(this.selectedIndex);
            UI.printCommands(this.currentView);

            const key = await this.handleKeypress();

            if (key === 'up') {
                this.selectedIndex = this.selectedIndex > 0 ? this.selectedIndex - 1 : maxIndex;
            } else if (key === 'down') {
                this.selectedIndex = this.selectedIndex < maxIndex ? this.selectedIndex + 1 : 0;
            } else if (key === 'return') {
                switch (this.selectedIndex) {
                    case 0: // View Containers
                        await this.showContainerList();
                        break;
                    case 1: // Start/Stop Container
                        await this.showContainerList('toggle');
                        break;
                    case 2: // Remove Container
                        await this.showContainerList('remove');
                        break;
                    case 3: // Container Stats
                        await this.showContainerList('stats');
                        break;
                    case 4: // Quick Actions
                        await this.showQuickActions();
                        break;
                    case 5: // Create PostgreSQL DB
                        await this.createPostgresDialog();
                        break;
                    case 6: // Cleanup System
                        await this.performCleanup();
                        break;
                    case 7: // Exit
                        this.isRunning = false;
                        break;
                }
            }
        }
    }

    private async showContainerList(mode: 'view' | 'toggle' | 'remove' | 'stats' = 'view'): Promise<void> {
        this.previousView = this.currentView;
        this.currentView = 'containers';
        this.selectedIndex = 0;
        this.multiSelect.clear();
        this.searchQuery = '';
        this.isSearching = false;
        await this.refreshContainers();

        while (this.currentView === 'containers' && this.isRunning) {
            await this.refreshContainers();

            clearScreen();
            UI.printHeader();

            if (this.isSearching) {
                console.log(`${COLORS.CYAN}Search: ${this.searchQuery}${COLORS.RESET}${COLORS.DIM}_${COLORS.RESET}\n`);
            } else if (this.searchQuery) {
                console.log(`${COLORS.DIM}Search: ${this.searchQuery} (Press / to search again)${COLORS.RESET}\n`);
            }

            if (this.filteredContainers.length === 0) {
                console.log(`${COLORS.YELLOW}No containers found${this.searchQuery ? ` matching "${this.searchQuery}"` : ''}.${COLORS.RESET}`);
                console.log(`${COLORS.DIM}Press Enter to go back${COLORS.RESET}\n`);
            } else {
                const visibleContainers = this.getVisibleContainers();
                const adjustedIndices = visibleContainers.map((_, i) => this.scrollOffset + i);

                visibleContainers.forEach((container, displayIndex) => {
                    const actualIndex = adjustedIndices[displayIndex];
                    const selected = actualIndex === this.selectedIndex;
                    const indicator = this.multiSelect.has(actualIndex) ? `${COLORS.GREEN}✓${COLORS.RESET}` : '';
                    const status = container.status === 'running'
                        ? `${COLORS.GREEN}${container.status}${COLORS.RESET}`
                        : `${COLORS.RED}${container.status}${COLORS.RESET}`;
                    const text = `${container.name} (${status}) - ${container.image}`;
                    printMenuItem(actualIndex, text, selected, indicator);
                });

                if (this.filteredContainers.length > this.maxVisibleItems) {
                    console.log(`\n${COLORS.DIM}Showing ${this.scrollOffset + 1}-${Math.min(this.scrollOffset + this.maxVisibleItems, this.filteredContainers.length)} of ${this.filteredContainers.length} containers${COLORS.RESET}`);
                }
            }

            UI.printCommands(this.currentView);

            const key = await this.handleKeypress();

            switch (key) {
                case 'return': {
                    if (this.filteredContainers.length === 0) {
                        this.currentView = this.previousView;
                        break;
                    }
                    const container = this.filteredContainers[this.selectedIndex];
                    if (container) {
                        switch (mode) {
                            case 'view':
                                await this.showContainerDetails(container);
                                break;
                            case 'toggle':
                                await this.toggleContainer(container);
                                await this.refreshContainers();
                                break;
                            case 'remove':
                                await this.removeContainer(container);
                                await this.refreshContainers();
                                break;
                            case 'stats':
                                await this.showContainerStats(container);
                                break;
                        }
                    }
                    break;
                }
                case 'space': {
                    if (this.filteredContainers.length === 0) break;
                    const index = this.selectedIndex;
                    if (this.multiSelect.has(index)) {
                        this.multiSelect.delete(index);
                    } else {
                        this.multiSelect.add(index);
                    }
                    break;
                }
                case 's': {
                    if (this.filteredContainers.length === 0) break;
                    if (this.multiSelect.size > 0) {
                        const selectedContainers = Array.from(this.multiSelect)
                            .map(index => this.filteredContainers[index])
                            .filter(Boolean);
                        await this.toggleContainers(selectedContainers);
                    } else {
                        const container = this.filteredContainers[this.selectedIndex];
                        if (container) {
                            await this.toggleContainer(container);
                        }
                    }
                    await this.refreshContainers();
                    break;
                }
                case 'r': {
                    if (this.filteredContainers.length === 0) break;
                    const container = this.filteredContainers[this.selectedIndex];
                    if (container) {
                        await this.restartContainer(container);
                        await this.refreshContainers();
                    }
                    break;
                }
                case 'd': {
                    if (this.filteredContainers.length === 0) break;
                    if (this.multiSelect.size > 0) {
                        const selectedContainers = Array.from(this.multiSelect)
                            .map(index => this.filteredContainers[index])
                            .filter(Boolean);
                        await this.removeContainers(selectedContainers);
                    } else {
                        const container = this.filteredContainers[this.selectedIndex];
                        if (container) {
                            await this.removeContainer(container);
                        }
                    }
                    await this.refreshContainers();
                    break;
                }
                case 'search':
                    await this.handleSearch();
                    break;
                case 'c': {
                    if (this.filteredContainers.length === 0) break;
                    const container = this.filteredContainers[this.selectedIndex];
                    if (container) {
                        await this.copyContainerEnv(container);
                    }
                    break;
                }
                case 'e': {
                    if (this.filteredContainers.length === 0) break;
                    const container = this.filteredContainers[this.selectedIndex];
                    if (container && container.status === 'running') {
                        await this.execInContainer(container);
                    } else {
                        printWarning('Container must be running to execute commands');
                        await this.waitForKey();
                    }
                    break;
                }
                case 'back':
                    this.currentView = this.previousView;
                    break;
            }
        }
    }

    private async handleSearch(): Promise<void> {
        this.isSearching = true;
        clearScreen();
        UI.printHeader();
        console.log(`${COLORS.CYAN}Search containers:${COLORS.RESET}`);
        console.log(`${COLORS.DIM}Enter search query (name or image)${COLORS.RESET}\n`);

        const query = await this.prompt('> ');
        this.searchQuery = query;
        this.isSearching = false;
        this.selectedIndex = 0;
        this.scrollOffset = 0;
        this.multiSelect.clear();
    }

    private async showContainerDetails(container: TContainer): Promise<void> {
        this.previousView = this.currentView;
        this.currentView = 'details';
        this.currentContainer = container;

        while (this.currentView === 'details' && this.isRunning) {
            // Refresh container data
            await this.refreshContainers();
            const updated = this.containers.find(c => c.id === container.id);
            if (updated) {
                container = updated;
                this.currentContainer = updated;
            }

            clearScreen();
            UI.printHeader();
            UI.printContainerDetails(container);
            UI.printCommands(this.currentView);

            const key = await this.handleKeypress();

            switch (key) {
                case 'l':
                    await this.showContainerLogs(container);
                    break;
                case 's':
                    await this.showContainerStats(container);
                    break;
                case 'c':
                    await this.copyToClipboard(container.id, 'Container ID');
                    break;
                case 'e':
                    await this.copyContainerEnv(container);
                    break;
                case 'x':
                    if (container.status === 'running') {
                        await this.execInContainer(container);
                    } else {
                        printWarning('Container must be running to execute commands');
                        await this.waitForKey();
                    }
                    break;
                case 'r':
                    await this.restartContainer(container);
                    await this.refreshContainers();
                    const refreshed = this.containers.find(c => c.id === container.id);
                    if (refreshed) container = refreshed;
                    break;
                case 'back':
                    this.currentView = this.previousView;
                    break;
            }
        }
    }

    private async showContainerLogs(container: TContainer): Promise<void> {
        this.previousView = this.currentView;
        this.currentView = 'logs';

        while (this.currentView === 'logs' && this.isRunning) {
            clearScreen();
            UI.printHeader();
            console.log(`${COLORS.BRIGHT}${COLORS.WHITE}CONTAINER LOGS: ${container.name}${COLORS.RESET}\n`);

            const result = await DockerUtils.getContainerLogs(container.id, 200);
            if (result.ok) {
                UI.printContainerLogs(result.value);
            } else {
                printError(result.error);
            }

            UI.printCommands(this.currentView);
            const key = await this.handleKeypress();

            switch (key) {
                case 'f':
                    // Follow logs (stream)
                    await this.followLogs(container);
                    break;
                case 'c':
                    // Clear logs (not implemented in Docker, but we can show empty)
                    clearScreen();
                    UI.printHeader();
                    console.log(`${COLORS.BRIGHT}${COLORS.WHITE}CONTAINER LOGS: ${container.name}${COLORS.RESET}\n`);
                    console.log(`${COLORS.DIM}Logs cleared from view${COLORS.RESET}\n`);
                    UI.printCommands(this.currentView);
                    await this.waitForKey();
                    break;
                case 'u':
                    // Update/refresh logs
                    break;
                case 'back':
                    this.currentView = this.previousView;
                    break;
            }
        }
    }

    private async followLogs(container: TContainer): Promise<void> {
        clearScreen();
        UI.printHeader();
        console.log(`${COLORS.BRIGHT}${COLORS.WHITE}FOLLOWING LOGS: ${container.name}${COLORS.RESET}`);
        console.log(`${COLORS.DIM}Press 'q' to stop following${COLORS.RESET}\n`);

        // This would require streaming docker logs, simplified for now
        const result = await DockerUtils.getContainerLogs(container.id, 50);
        if (result.ok) {
            UI.printContainerLogs(result.value);
        }

        await this.waitForKey();
    }

    private async showContainerStats(container: TContainer): Promise<void> {
        clearScreen();
        UI.printHeader();

        const result = await DockerUtils.getContainerStats(container.id);
        if (result.ok) {
            UI.printContainerStats(container, result.value);
        } else {
            printError(result.error);
        }

        UI.printCommands('details');
        await this.waitForKey();
    }

    private async toggleContainer(container: TContainer): Promise<void> {
        if (container.status === 'running') {
            const result = await DockerUtils.stopContainer(container.id);
            if (result.ok) {
                printSuccess(`Container "${container.name}" stopped successfully`);
                await SystemUtils.notifyUser(`Container ${container.name} stopped`, 'info');
            } else {
                printError(result.error);
            }
        } else {
            const result = await DockerUtils.startContainer(container.id);
            if (result.ok) {
                printSuccess(`Container "${container.name}" started successfully`);
                await SystemUtils.notifyUser(`Container ${container.name} started`, 'success');
            } else {
                printError(result.error);
            }
        }
        await this.waitForKey();
    }

    private async restartContainer(container: TContainer): Promise<void> {
        UI.printLoading('Restarting container');
        const result = await DockerUtils.restartContainer(container.id);
        if (result.ok) {
            printSuccess(`Container "${container.name}" restarted successfully`);
            await SystemUtils.notifyUser(`Container ${container.name} restarted`, 'success');
        } else {
            printError(result.error);
        }
        await this.waitForKey();
    }

    private async toggleContainers(containers: TContainer[]): Promise<void> {
        if (containers.length === 0) return;

        const operation = containers[0].status === 'running' ? 'stop' : 'start';
        UI.printLoading(`${operation === 'start' ? 'Starting' : 'Stopping'} ${containers.length} containers`);

        const result = await DockerUtils.performBulkOperation(
            containers.map(c => c.id),
            operation
        );

        if (result.ok) {
            printSuccess(`${containers.length} containers ${operation}ed successfully`);
        } else {
            printError(result.error);
        }
        await this.waitForKey();
    }

    private async removeContainer(container: TContainer): Promise<void> {
        clearScreen();
        UI.printHeader();
        printWarning(`Are you sure you want to remove container "${container.name}"?`);
        printWarning('This action cannot be undone.');

        const confirm = await this.prompt(`\nType "${container.name}" to confirm: `);
        if (confirm === container.name) {
            UI.printLoading('Removing container');
            const result = await DockerUtils.removeContainer(container.id);
            if (result.ok) {
                printSuccess('Container removed successfully');
                await SystemUtils.notifyUser(`Container ${container.name} removed`, 'info');
            } else {
                printError(result.error);
            }
        } else {
            printWarning('Operation cancelled');
        }
        await this.waitForKey();
    }

    private async removeContainers(containers: TContainer[]): Promise<void> {
        clearScreen();
        UI.printHeader();
        printWarning(`Are you sure you want to remove ${containers.length} containers?`);
        printWarning('This action cannot be undone.');
        containers.forEach(c => console.log(`  - ${c.name}`));

        const confirm = await this.prompt('\nType "yes" to confirm: ');
        if (confirm.toLowerCase() === 'yes') {
            UI.printLoading(`Removing ${containers.length} containers`);
            const result = await DockerUtils.performBulkOperation(
                containers.map(c => c.id),
                'remove'
            );
            if (result.ok) {
                printSuccess(`${containers.length} containers removed successfully`);
            } else {
                printError(result.error);
            }
        } else {
            printWarning('Operation cancelled');
        }
        await this.waitForKey();
    }

    private async copyContainerEnv(container: TContainer): Promise<void> {
        if (container.status !== 'running') {
            printWarning('Container must be running to get environment variables');
            await this.waitForKey();
            return;
        }

        UI.printLoading('Fetching environment variables');
        const result = await DockerUtils.getContainerEnv(container.id);

        if (!result.ok) {
            printError(result.error);
            await this.waitForKey();
            return;
        }

        clearScreen();
        UI.printHeader();
        console.log(`${COLORS.BRIGHT}${COLORS.WHITE}Environment Variables: ${container.name}${COLORS.RESET}\n`);

        const envVars = Object.entries(result.value);
        if (envVars.length === 0) {
            printWarning('No environment variables found');
        } else {
            envVars.forEach(([key, value]) => {
                console.log(`${COLORS.CYAN}${key}${COLORS.RESET}=${value}`);
            });

            console.log(`\n${COLORS.DIM}Select an environment variable to copy:${COLORS.RESET}`);
            console.log(`${COLORS.DIM}Or type "all" to copy all as .env format${COLORS.RESET}\n`);

            const selection = await this.prompt('> ');

            if (selection.toLowerCase() === 'all') {
                const envFormat = envVars.map(([k, v]) => `${k}=${v}`).join('\n');
                await this.copyToClipboard(envFormat, 'All environment variables');
            } else {
                const found = envVars.find(([k]) => k.toLowerCase() === selection.toLowerCase());
                if (found) {
                    await this.copyToClipboard(found[1], `Environment variable ${found[0]}`);
                } else {
                    printWarning('Environment variable not found');
                }
            }
        }

        await this.waitForKey();
    }

    private async execInContainer(container: TContainer): Promise<void> {
        clearScreen();
        UI.printHeader();
        console.log(`${COLORS.BRIGHT}${COLORS.WHITE}Execute Command in: ${container.name}${COLORS.RESET}\n`);
        console.log(`${COLORS.DIM}Enter command to execute (e.g., "bash", "ps aux", "ls -la")${COLORS.RESET}\n`);

        const command = await this.prompt('> ');
        if (!command.trim()) {
            printWarning('No command entered');
            await this.waitForKey();
            return;
        }

        UI.printLoading(`Executing: ${command}`);
        const result = await DockerUtils.execInContainer(container.id, command);

        clearScreen();
        UI.printHeader();
        console.log(`${COLORS.BRIGHT}${COLORS.WHITE}Command Output: ${container.name}${COLORS.RESET}\n`);
        console.log(`${COLORS.DIM}$ ${command}${COLORS.RESET}\n`);

        if (result.ok) {
            console.log(result.value);
        } else {
            printError(result.error);
        }

        await this.waitForKey();
    }

    private async showQuickActions(): Promise<void> {
        this.previousView = this.currentView;
        this.currentView = 'quick-actions';
        this.selectedIndex = 0;

        const actions = [
            '🔄 Restart All Running Containers',
            '🛑 Stop All Running Containers',
            '▶️  Start All Stopped Containers',
            '🗑️  Remove All Stopped Containers',
            '📊 Show System Stats',
            '📄 Generate Docker Compose',
            '🔙 Back'
        ];

        while (this.currentView === 'quick-actions' && this.isRunning) {
            clearScreen();
            UI.printHeader();
            console.log(`${COLORS.BRIGHT}${COLORS.WHITE}Quick Actions${COLORS.RESET}\n`);

            actions.forEach((action, index) => {
                printMenuItem(index, action, index === this.selectedIndex);
            });

            UI.printCommands(this.currentView);

            const key = await this.handleKeypress();

            if (key === 'up') {
                this.selectedIndex = this.selectedIndex > 0 ? this.selectedIndex - 1 : actions.length - 1;
            } else if (key === 'down') {
                this.selectedIndex = this.selectedIndex < actions.length - 1 ? this.selectedIndex + 1 : 0;
            } else if (key === 'return') {
                switch (this.selectedIndex) {
                    case 0:
                        await this.restartAllRunning();
                        break;
                    case 1:
                        await this.stopAllRunning();
                        break;
                    case 2:
                        await this.startAllStopped();
                        break;
                    case 3:
                        await this.removeAllStopped();
                        break;
                    case 4:
                        await this.showSystemStats();
                        break;
                    case 5:
                        await this.generateDockerCompose();
                        break;
                    case 6:
                        this.currentView = this.previousView;
                        break;
                }
            } else if (key === 'back') {
                this.currentView = this.previousView;
            }
        }
    }

    private async restartAllRunning(): Promise<void> {
        await this.refreshContainers();
        const running = this.containers.filter(c => c.status === 'running');
        if (running.length === 0) {
            printWarning('No running containers to restart');
            console.log(`${COLORS.DIM}Press any key to go back${COLORS.RESET}`);
            await this.waitForKey();
            return;
        }

        clearScreen();
        UI.printHeader();
        printWarning(`Restart ${running.length} running containers?`);
        const confirm = await this.prompt('Type "yes" to confirm: ');

        if (confirm.toLowerCase() === 'yes') {
            UI.printLoading(`Restarting ${running.length} containers`);
            const result = await DockerUtils.performBulkOperation(
                running.map(c => c.id),
                'stop'
            );
            if (result.ok) {
                await DockerUtils.performBulkOperation(running.map(c => c.id), 'start');
                printSuccess(`${running.length} containers restarted`);
            } else {
                printError(result.error);
            }
        }
        await this.waitForKey();
    }

    private async stopAllRunning(): Promise<void> {
        await this.refreshContainers();
        const running = this.containers.filter(c => c.status === 'running');
        if (running.length === 0) {
            printWarning('No running containers to stop');
            console.log(`${COLORS.DIM}Press any key to go back${COLORS.RESET}`);
            await this.waitForKey();
            return;
        }

        clearScreen();
        UI.printHeader();
        printWarning(`Stop ${running.length} running containers?`);
        const confirm = await this.prompt('Type "yes" to confirm: ');

        if (confirm.toLowerCase() === 'yes') {
            UI.printLoading(`Stopping ${running.length} containers`);
            const result = await DockerUtils.performBulkOperation(
                running.map(c => c.id),
                'stop'
            );
            if (result.ok) {
                printSuccess(`${running.length} containers stopped`);
            } else {
                printError(result.error);
            }
        }
        await this.waitForKey();
    }

    private async startAllStopped(): Promise<void> {
        await this.refreshContainers();
        const stopped = this.containers.filter(c => c.status !== 'running');
        if (stopped.length === 0) {
            printWarning('No stopped containers to start');
            console.log(`${COLORS.DIM}Press any key to go back${COLORS.RESET}`);
            await this.waitForKey();
            return;
        }

        UI.printLoading(`Starting ${stopped.length} containers`);
        const result = await DockerUtils.performBulkOperation(
            stopped.map(c => c.id),
            'start'
        );
        if (result.ok) {
            printSuccess(`${stopped.length} containers started`);
        } else {
            printError(result.error);
        }
        await this.waitForKey();
    }

    private async removeAllStopped(): Promise<void> {
        await this.refreshContainers();
        const stopped = this.containers.filter(c => c.status !== 'running');
        if (stopped.length === 0) {
            printWarning('No stopped containers to remove');
            console.log(`${COLORS.DIM}Press any key to go back${COLORS.RESET}`);
            await this.waitForKey();
            return;
        }

        clearScreen();
        UI.printHeader();
        printWarning(`Remove ${stopped.length} stopped containers?`);
        printWarning('This action cannot be undone.');
        const confirm = await this.prompt('Type "yes" to confirm: ');

        if (confirm.toLowerCase() === 'yes') {
            UI.printLoading(`Removing ${stopped.length} containers`);
            const result = await DockerUtils.performBulkOperation(
                stopped.map(c => c.id),
                'remove'
            );
            if (result.ok) {
                printSuccess(`${stopped.length} containers removed`);
            } else {
                printError(result.error);
            }
        }
        await this.waitForKey();
    }

    private async showSystemStats(): Promise<void> {
        clearScreen();
        UI.printHeader();
        console.log(`${COLORS.BRIGHT}${COLORS.WHITE}Docker System Stats${COLORS.RESET}\n`);

        try {
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);

            const [diskUsage, containers, images, networks] = await Promise.all([
                execAsync('/usr/bin/docker system df'),
                execAsync('/usr/bin/docker ps -a --format "{{.Status}}" | wc -l'),
                execAsync('/usr/bin/docker images --format "{{.Repository}}" | wc -l'),
                execAsync('/usr/bin/docker network ls --format "{{.Name}}" | wc -l')
            ]);

            console.log(diskUsage.stdout);
            console.log(`\n${COLORS.CYAN}Containers:${COLORS.RESET} ${containers.stdout.trim()}`);
            console.log(`${COLORS.CYAN}Images:${COLORS.RESET} ${images.stdout.trim()}`);
            console.log(`${COLORS.CYAN}Networks:${COLORS.RESET} ${networks.stdout.trim()}`);
        } catch (error) {
            printError(error instanceof Error ? error.message : 'Failed to get system stats');
        }

        await this.waitForKey();
    }

    private async createPostgresDialog(): Promise<void> {
        this.previousView = this.currentView;
        this.currentView = 'create-postgres';

        clearScreen();
        UI.printHeader();
        console.log(`${COLORS.BRIGHT}${COLORS.WHITE}Create PostgreSQL Container${COLORS.RESET}\n`);

        const name = await this.prompt('Container name (default: postgres): ') || 'postgres';
        const password = await this.prompt('PostgreSQL password (required): ');

        if (!password) {
            printError('Password is required');
            await this.waitForKey();
            this.currentView = this.previousView;
            return;
        }

        const portInput = await this.prompt('Port (default: 5432): ') || '5432';
        const port = parseInt(portInput, 10) || 5432;

        const database = await this.prompt('Database name (default: postgres): ') || 'postgres';

        UI.printLoading('Creating PostgreSQL container');
        const result = await DockerUtils.createPostgresContainer(name, password, port, database);

        clearScreen();
        UI.printHeader();

        if (result.ok) {
            printSuccess('PostgreSQL container created successfully!');
            console.log(`\n${COLORS.CYAN}Container ID:${COLORS.RESET} ${result.value.id}`);
            console.log(`${COLORS.CYAN}Connection String:${COLORS.RESET} ${result.value.connectionString}\n`);

            const copyConn = await this.prompt('Copy connection string to clipboard? (y/n): ');
            if (copyConn.toLowerCase() === 'y') {
                await this.copyToClipboard(result.value.connectionString, 'PostgreSQL connection string');
            }

            await SystemUtils.notifyUser(`PostgreSQL container ${name} created`, 'success');
        } else {
            printError(result.error);
        }

        await this.waitForKey();
        this.currentView = this.previousView;
    }

    private async performCleanup(): Promise<void> {
        clearScreen();
        UI.printHeader();
        printWarning('This will remove all stopped containers, unused networks, and dangling images.');
        const confirm = await this.prompt('Type "yes" to confirm: ');

        if (confirm.toLowerCase() === 'yes') {
            UI.printLoading('Cleaning up system');
            const result = await DockerUtils.cleanupSystem();
            if (result.ok) {
                printSuccess('System cleanup completed successfully');
                await SystemUtils.notifyUser('Docker system cleanup completed', 'success');
            } else {
                printError(result.error);
            }
        } else {
            printWarning('Operation cancelled');
        }
        await this.waitForKey();
    }

    private async copyToClipboard(text: string, description: string): Promise<void> {
        const result = await SystemUtils.copyToClipboard(text);
        if (result.ok) {
            printSuccess(`${description} copied to clipboard`);
            await SystemUtils.notifyUser(`${description} copied`, 'success');
        } else {
            printError(result.error);
        }
    }

    private handleKeypress(): Promise<string> {
        return new Promise((resolve) => {
            const handler = (str: string, key: any) => {
                process.stdin.removeListener('keypress', handler);

                // Handle escape sequences
                if (key.sequence === '\x1b') {
                    // Arrow keys or escape
                    resolve('escape');
                    return;
                }

                if (key.name === 'return') {
                    resolve('return');
                } else if (key.name === 'backspace' || key.name === 'escape') {
                    resolve('back');
                } else if (key.name === 'up') {
                    if (this.currentView === 'main' || this.currentView === 'quick-actions') {
                        resolve('up');
                    } else if (this.currentView === 'containers' && this.filteredContainers.length > 0) {
                        this.selectedIndex = this.selectedIndex > 0 ? this.selectedIndex - 1 : this.filteredContainers.length - 1;
                        this.adjustScrollOffset();
                        resolve('up');
                    } else {
                        resolve('up');
                    }
                } else if (key.name === 'down') {
                    if (this.currentView === 'main' || this.currentView === 'quick-actions') {
                        resolve('down');
                    } else if (this.currentView === 'containers' && this.filteredContainers.length > 0) {
                        this.selectedIndex = this.selectedIndex < this.filteredContainers.length - 1 ? this.selectedIndex + 1 : 0;
                        this.adjustScrollOffset();
                        resolve('down');
                    } else {
                        resolve('down');
                    }
                } else if (str === ' ') {
                    resolve('space');
                } else if (str === 'q' || (key.ctrl && key.name === 'c')) {
                    this.isRunning = false;
                    resolve('quit');
                } else if (str === 's') {
                    resolve('s');
                } else if (str === 'r') {
                    resolve('r');
                } else if (str === 'd') {
                    resolve('d');
                } else if (str === 'l') {
                    resolve('l');
                } else if (str === 'c') {
                    resolve('c');
                } else if (str === 'e' || str === 'x') {
                    resolve('e');
                } else if (str === '/') {
                    resolve('search');
                } else if (str === 'f') {
                    resolve('f');
                } else if (str === 'u') {
                    resolve('u');
                } else {
                    // Re-attach handler for other keys
                    process.stdin.on('keypress', handler);
                }
            };

            process.stdin.on('keypress', handler);
        });
    }

    private async prompt(question: string): Promise<string> {
        // Temporarily disable raw mode for input
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }

        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                // Re-enable raw mode
                if (process.stdin.isTTY) {
                    process.stdin.setRawMode(true);
                }
                resolve(answer.trim());
            });
        });
    }

    private async waitForKey(): Promise<void> {
        console.log(`\n${COLORS.DIM}Press any key to continue...${COLORS.RESET}`);
        await this.handleKeypress();
    }

    private async generateDockerCompose(): Promise<void> {
        await this.refreshContainers();

        if (this.containers.length === 0) {
            printWarning('No containers found to generate docker-compose.yml');
            console.log(`${COLORS.DIM}Press any key to go back${COLORS.RESET}`);
            await this.waitForKey();
            return;
        }

        clearScreen();
        UI.printHeader();
        console.log(`${COLORS.BRIGHT}${COLORS.WHITE}Generate Docker Compose${COLORS.RESET}\n`);

        // Ask if user wants VITE prefix
        console.log(`${COLORS.CYAN}Are you using Vite? (for environment variable prefixes)${COLORS.RESET}`);
        const isViteAnswer = await this.prompt('Type "y" for yes, any other key for no: ');
        const isVite = isViteAnswer.toLowerCase() === 'y';

        // Generate the files
        const dockerComposeContent = DockerUtils.generateDockerCompose(this.containers);
        const envVarsContent = DockerUtils.generateEnvironmentVariables(this.containers, isVite);

        console.log(`\n${COLORS.BRIGHT}${COLORS.GREEN}✓ Generated docker-compose.yml with ${this.containers.length} containers${COLORS.RESET}`);
        console.log(`${COLORS.BRIGHT}${COLORS.GREEN}✓ Generated environment variables${COLORS.RESET}\n`);

        // Show environment variables
        console.log(`${COLORS.BRIGHT}${COLORS.WHITE}Environment Variables:${COLORS.RESET}`);
        console.log(`${COLORS.DIM}${envVarsContent}${COLORS.RESET}\n`);

        // Ask what to do with the files
        console.log(`${COLORS.CYAN}What would you like to do with the generated files?${COLORS.RESET}`);
        console.log(`${COLORS.DIM}1. Save docker-compose.yml to filesystem${COLORS.RESET}`);
        console.log(`${COLORS.DIM}2. Copy docker-compose.yml to clipboard${COLORS.RESET}`);
        console.log(`${COLORS.DIM}3. Copy environment variables to clipboard${COLORS.RESET}`);
        console.log(`${COLORS.DIM}4. Both (save to filesystem and copy env vars to clipboard)${COLORS.RESET}\n`);

        const choice = await this.prompt('Enter your choice (1-4): ');

        switch (choice.trim()) {
            case '1':
                await this.saveDockerComposeToFile(dockerComposeContent);
                break;
            case '2':
                await this.copyToClipboard(dockerComposeContent, 'Docker Compose content');
                break;
            case '3':
                await this.copyToClipboard(envVarsContent, 'Environment variables');
                break;
            case '4':
                await this.saveDockerComposeToFile(dockerComposeContent);
                await this.copyToClipboard(envVarsContent, 'Environment variables');
                break;
            default:
                printWarning('Invalid choice. Files were not saved/copied.');
                await this.waitForKey();
                return;
        }

        await this.waitForKey();
    }

    private async saveDockerComposeToFile(content: string): Promise<void> {
        try {
            const fs = await import('fs');
            const path = await import('path');

            // Ask for filename
            const filename = await this.prompt('Enter filename (default: docker-compose.yml): ') || 'docker-compose.yml';

            // Ensure .yml extension
            const finalFilename = filename.endsWith('.yml') || filename.endsWith('.yaml') ? filename : `${filename}.yml`;

            await fs.promises.writeFile(path.resolve(process.cwd(), finalFilename), content);
            printSuccess(`Docker Compose file saved as ${finalFilename}`);
            await SystemUtils.notifyUser(`Docker Compose saved as ${finalFilename}`, 'success');
        } catch (error) {
            printError(`Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private cleanup(): void {
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
        this.rl.close();
        clearScreen();
        console.log(`${COLORS.CYAN}Thank you for using Docker Container Manager!${COLORS.RESET}\n`);
    }
}
