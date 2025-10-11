import readline from 'readline';
import * as DockerUtils from './docker-utils.js';
import * as UI from './ui-components.js';
import { clearScreen, COLORS, printError, printSuccess, printWarning } from './ui-utils.js';
export class TerminalManager {
    constructor() {
        this.selectedIndex = 0;
        this.multiSelect = new Set();
        this.currentView = 'main';
        this.previousView = 'main';
        this.currentContainer = null;
        this.containers = [];
        this.isRunning = true;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
    }
    async start() {
        await this.checkDependencies();
        await this.showMainMenu();
        this.cleanup();
    }
    async checkDependencies() {
        const result = await DockerUtils.checkDockerDaemon();
        if (!result.ok) {
            clearScreen();
            UI.printHeader();
            printError('Docker daemon is not running');
            console.log('Please start Docker and try again.\n');
            process.exit(1);
        }
    }
    async refreshContainers() {
        const result = await DockerUtils.listContainers();
        if (result.ok) {
            this.containers = result.value;
        }
        else {
            printError(result.error);
        }
    }
    async showMainMenu() {
        this.currentView = 'main';
        this.selectedIndex = 0;
        while (this.isRunning && this.currentView === 'main') {
            clearScreen();
            UI.printHeader();
            UI.printMainMenu(this.selectedIndex);
            UI.printCommands(this.currentView);
            const key = await this.handleKeypress();
            if (key === 'return') {
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
                    case 4: // Cleanup System
                        await this.performCleanup();
                        break;
                    case 5: // Exit
                        this.isRunning = false;
                        break;
                }
            }
        }
    }
    async showContainerList(mode = 'view') {
        this.previousView = this.currentView;
        this.currentView = 'containers';
        this.selectedIndex = 0;
        this.multiSelect.clear();
        while (this.currentView === 'containers') {
            await this.refreshContainers();
            clearScreen();
            UI.printHeader();
            UI.printContainerList(this.containers, this.selectedIndex, this.multiSelect);
            UI.printCommands(this.currentView);
            const key = await this.handleKeypress();
            switch (key) {
                case 'return': {
                    const container = this.containers[this.selectedIndex];
                    if (container) {
                        switch (mode) {
                            case 'view':
                                await this.showContainerDetails(container);
                                break;
                            case 'toggle':
                                await this.toggleContainer(container);
                                break;
                            case 'remove':
                                await this.removeContainer(container);
                                break;
                            case 'stats':
                                await this.showContainerStats(container);
                                break;
                        }
                    }
                    break;
                }
                case 'space': {
                    const index = this.selectedIndex;
                    if (this.multiSelect.has(index)) {
                        this.multiSelect.delete(index);
                    }
                    else {
                        this.multiSelect.add(index);
                    }
                    break;
                }
                case 's': {
                    if (this.multiSelect.size > 0) {
                        const selectedContainers = Array.from(this.multiSelect)
                            .map(index => this.containers[index])
                            .filter(Boolean);
                        await this.toggleContainers(selectedContainers);
                    }
                    else {
                        const container = this.containers[this.selectedIndex];
                        if (container) {
                            await this.toggleContainer(container);
                        }
                    }
                    break;
                }
                case 'd': {
                    if (this.multiSelect.size > 0) {
                        const selectedContainers = Array.from(this.multiSelect)
                            .map(index => this.containers[index])
                            .filter(Boolean);
                        await this.removeContainers(selectedContainers);
                    }
                    else {
                        const container = this.containers[this.selectedIndex];
                        if (container) {
                            await this.removeContainer(container);
                        }
                    }
                    break;
                }
                case 'back':
                    this.currentView = this.previousView;
                    break;
            }
        }
    }
    async showContainerDetails(container) {
        this.previousView = this.currentView;
        this.currentView = 'details';
        this.currentContainer = container;
        while (this.currentView === 'details') {
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
                    // Copy container ID to clipboard
                    break;
                case 'back':
                    this.currentView = this.previousView;
                    break;
            }
        }
    }
    async showContainerLogs(container) {
        this.previousView = this.currentView;
        this.currentView = 'logs';
        clearScreen();
        UI.printHeader();
        console.log(`${COLORS.BRIGHT}${COLORS.WHITE}CONTAINER LOGS: ${container.name}${COLORS.RESET}\n`);
        const result = await DockerUtils.getContainerLogs(container.id);
        if (result.ok) {
            UI.printContainerLogs(result.value);
        }
        else {
            printError(result.error);
        }
        UI.printCommands(this.currentView);
        await this.waitForKey();
        this.currentView = this.previousView;
    }
    async showContainerStats(container) {
        clearScreen();
        UI.printHeader();
        const result = await DockerUtils.getContainerStats(container.id);
        if (result.ok) {
            UI.printContainerStats(container, result.value);
        }
        else {
            printError(result.error);
        }
        UI.printCommands('details');
        await this.waitForKey();
    }
    async toggleContainer(container) {
        const operation = container.status === 'running' ? 'stop' : 'start';
        const result = await (operation === 'start'
            ? DockerUtils.startContainer(container.id)
            : DockerUtils.stopContainer(container.id));
        if (result.ok) {
            printSuccess(`Container ${operation}ed successfully`);
        }
        else {
            printError(result.error);
        }
        await this.waitForKey();
    }
    async toggleContainers(containers) {
        const operation = containers[0].status === 'running' ? 'stop' : 'start';
        const result = await DockerUtils.performBulkOperation(containers.map(c => c.id), operation);
        if (result.ok) {
            printSuccess(`${containers.length} containers ${operation}ed successfully`);
        }
        else {
            printError(result.error);
        }
        await this.waitForKey();
    }
    async removeContainer(container) {
        printWarning(`Are you sure you want to remove container "${container.name}"?`);
        printWarning('This action cannot be undone.');
        const confirm = await this.prompt('Type the container name to confirm: ');
        if (confirm === container.name) {
            const result = await DockerUtils.removeContainer(container.id);
            if (result.ok) {
                printSuccess('Container removed successfully');
            }
            else {
                printError(result.error);
            }
        }
        else {
            printWarning('Operation cancelled');
        }
        await this.waitForKey();
    }
    async removeContainers(containers) {
        printWarning(`Are you sure you want to remove ${containers.length} containers?`);
        printWarning('This action cannot be undone.');
        const confirm = await this.prompt('Type "yes" to confirm: ');
        if (confirm.toLowerCase() === 'yes') {
            const result = await DockerUtils.performBulkOperation(containers.map(c => c.id), 'remove');
            if (result.ok) {
                printSuccess(`${containers.length} containers removed successfully`);
            }
            else {
                printError(result.error);
            }
        }
        else {
            printWarning('Operation cancelled');
        }
        await this.waitForKey();
    }
    async performCleanup() {
        printWarning('This will remove all stopped containers, unused networks, and dangling images.');
        const confirm = await this.prompt('Type "yes" to confirm: ');
        if (confirm.toLowerCase() === 'yes') {
            const result = await DockerUtils.cleanupSystem();
            if (result.ok) {
                printSuccess('System cleanup completed successfully');
            }
            else {
                printError(result.error);
            }
        }
        else {
            printWarning('Operation cancelled');
        }
        await this.waitForKey();
    }
    handleKeypress() {
        return new Promise((resolve) => {
            const handler = (str, key) => {
                process.stdin.removeListener('keypress', handler);
                if (key.name === 'return') {
                    resolve('return');
                }
                else if (key.name === 'backspace') {
                    resolve('back');
                }
                else if (key.name === 'up' && this.selectedIndex > 0) {
                    this.selectedIndex--;
                    resolve('up');
                }
                else if (key.name === 'down' && this.selectedIndex < this.containers.length - 1) {
                    this.selectedIndex++;
                    resolve('down');
                }
                else if (str === ' ') {
                    resolve('space');
                }
                else if (str === 'q' || (key.ctrl && key.name === 'c')) {
                    this.isRunning = false;
                    resolve('quit');
                }
                else if (str === 's') {
                    resolve('s');
                }
                else if (str === 'd') {
                    resolve('d');
                }
                else if (str === 'l') {
                    resolve('l');
                }
                else if (str === 'c') {
                    resolve('c');
                }
            };
            process.stdin.on('keypress', handler);
        });
    }
    async prompt(question) {
        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer.trim());
            });
        });
    }
    async waitForKey() {
        console.log('\nPress any key to continue...');
        await this.handleKeypress();
    }
    cleanup() {
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
        this.rl.close();
        clearScreen();
        console.log(`${COLORS.CYAN}Thank you for using Docker Container Manager!${COLORS.RESET}\n`);
    }
}
//# sourceMappingURL=terminal-manager.js.map