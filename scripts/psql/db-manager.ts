#!/usr/bin/env node

import { spawn, exec, execSync } from 'child_process';
import { promisify } from 'util';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

type TDatabaseInstance = {
    name: string;
    type: 'local' | 'docker';
    status: string;
    ports?: string;
    image?: string;
    containerId?: string;
};

type TEnvironmentInfo = {
    DATABASE_URL: string | null;
    DATABASE_AUTH_TOKEN: string | null;
    NODE_ENV: string;
    currentWorkingDir: string;
};

type TMenuItem = {
    text: string;
    value: string;
    indicator?: string;
};

type TSeedFile = {
    name: string;
    path: string;
    size: number;
};

const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
};

class DatabaseManager {
    private selectedIndex: number = 0;
    private multiSelect: Set<number> = new Set();
    private currentView: string = 'main';
    private prevView: string = '';
    private rl: readline.Interface;
    private isRunning: boolean = true;

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

    async checkDependencies(): Promise<void> {
        try {
            execSync('docker --version', { stdio: 'ignore' });
        } catch (error) {
            this.clearScreen();
            this.printHeader();
            console.log(`${COLORS.yellow}⚠ Warning: Docker is not installed or not running${COLORS.reset}`);
            console.log('Some features may not be available.\n');
            await this.waitForKey();
        }
    }

    private clearScreen(): void {
        console.clear();
    }

    private printHeader(): void {
        console.log(`${COLORS.cyan}${COLORS.bright}`);
        console.log('╔════════════════════════════════════════════════════════════════════╗');
        console.log('║                                                                    ║');
        console.log('║     ██████╗  ██████╗ ███████╗████████╗ ██████╗ ██████╗ ███████╗  ║');
        console.log('║     ██╔══██╗██╔════╝ ██╔════╝╚══██╔══╝██╔════╝ ██╔══██╗██╔════╝  ║');
        console.log('║     ██████╔╝██║  ███╗███████╗   ██║   ██║  ███╗██████╔╝█████╗    ║');
        console.log('║     ██╔═══╝ ██║   ██║╚════██║   ██║   ██║   ██║██╔══██╗██╔══╝    ║');
        console.log('║     ██║     ╚██████╔╝███████║   ██║   ╚██████╔╝██║  ██║███████╗  ║');
        console.log('║     ╚═╝      ╚═════╝ ╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝  ║');
        console.log('║                                                                    ║');
        console.log('║              PostgreSQL Database Manager CLI v1.0                 ║');
        console.log('║                                                                    ║');
        console.log('╚════════════════════════════════════════════════════════════════════╝');
        console.log(`${COLORS.reset}\n`);
    }

    private printMenuItem(index: number, text: string, isSelected: boolean, hasIndicator?: boolean): void {
        const prefix = isSelected ? `${COLORS.bgCyan}${COLORS.bright} ▶ ` : '   ';
        const suffix = isSelected ? ` ${COLORS.reset}` : '';
        const indicator = hasIndicator && this.multiSelect.has(index) ? ` ${COLORS.green}✓${COLORS.reset}` : '';
        
        console.log(`${prefix}${text}${indicator}${suffix}`);
    }

    private printFooter(customHelp?: string): void {
        console.log('\n' + '─'.repeat(70));
        if (customHelp) {
            console.log(`${COLORS.dim}${customHelp}${COLORS.reset}`);
        } else {
            console.log(`${COLORS.dim}↑↓: Navigate | Enter: Select | q: Quit | Backspace: Back${COLORS.reset}`);
        }
    }

    async showMainMenu(): Promise<void> {
        this.currentView = 'main';
        this.selectedIndex = 0;

        const options: TMenuItem[] = [
            { text: '📊 View Databases', value: 'view' },
            { text: '➕ Create Database', value: 'create' },
            { text: '🌍 Environment & Connections', value: 'env' },
            { text: '��️  Database Tools', value: 'tools' },
            { text: '❌ Exit', value: 'exit' }
        ];

        while (this.isRunning) {
            this.clearScreen();
            this.printHeader();
            console.log(`${COLORS.bright}${COLORS.white}MAIN MENU${COLORS.reset}\n`);

            for (let i = 0; i < options.length; i++) {
                this.printMenuItem(i, options[i].text, i === this.selectedIndex);
            }

            this.printFooter();

            const action = await this.handleNavigation(options, async (selected: TMenuItem) => {
                switch (selected.value) {
                    case 'view':
                        await this.showDatabasesView();
                        break;
                    case 'create':
                        await this.showCreateDatabaseMenu();
                        break;
                    case 'env':
                        await this.showEnvironmentMenu();
                        break;
                    case 'tools':
                        await this.showToolsMenu();
                        break;
                    case 'exit':
                        this.isRunning = false;
                        break;
                }
            });

            if (action === 'quit') {
                this.isRunning = false;
            }
        }
    }

    async showDatabasesView(): Promise<void> {
        this.prevView = this.currentView;
        this.currentView = 'databases';
        this.selectedIndex = 0;

        while (this.currentView === 'databases') {
            const databases = await this.getRunningPostgres();
            
            this.clearScreen();
            this.printHeader();
            console.log(`${COLORS.bright}${COLORS.white}DATABASES${COLORS.reset}`);
            console.log(`${COLORS.dim}Main Menu > View Databases${COLORS.reset}\n`);

            if (databases.length === 0) {
                console.log(`${COLORS.yellow}No running PostgreSQL databases found.${COLORS.reset}\n`);
                console.log('Press any key to return...');
                await this.waitForKey();
                this.currentView = this.prevView;
                return;
            }

            const options: TMenuItem[] = databases.map((db, idx) => ({
                text: `${db.type === 'docker' ? '🐳' : '💻'} ${db.name} (${db.status})${db.ports ? ` - Port: ${db.ports}` : ''}`,
                value: idx.toString()
            }));
            options.push({ text: '⬅️  Back to Main Menu', value: 'back' });

            for (let i = 0; i < options.length; i++) {
                this.printMenuItem(i, options[i].text, i === this.selectedIndex);
            }

            this.printFooter('↑↓: Navigate | Enter: Details | d: Delete | c: Copy URL | Backspace: Back');

            const action = await this.handleNavigation(options, async (selected: TMenuItem) => {
                if (selected.value === 'back') {
                    this.currentView = this.prevView;
                    return;
                }
                const dbIndex = parseInt(selected.value);
                await this.showDatabaseDetails(databases[dbIndex]);
            }, async (key: string) => {
                if (key === 'd') {
                    const dbIndex = this.selectedIndex;
                    if (dbIndex < databases.length) {
                        await this.deleteDatabase(databases[dbIndex]);
                    }
                } else if (key === 'c') {
                    const dbIndex = this.selectedIndex;
                    if (dbIndex < databases.length) {
                        await this.copyConnectionUrl(databases[dbIndex]);
                    }
                }
            });

            if (action === 'back' || action === 'quit') {
                this.currentView = this.prevView;
            }
        }
    }

    async showDatabaseDetails(db: TDatabaseInstance): Promise<void> {
        this.clearScreen();
        this.printHeader();
        console.log(`${COLORS.bright}${COLORS.white}DATABASE DETAILS${COLORS.reset}`);
        console.log(`${COLORS.dim}Main Menu > View Databases > ${db.name}${COLORS.reset}\n`);

        console.log(`${COLORS.cyan}Name:${COLORS.reset} ${db.name}`);
        console.log(`${COLORS.cyan}Type:${COLORS.reset} ${db.type}`);
        console.log(`${COLORS.cyan}Status:${COLORS.reset} ${db.status === 'running' ? `${COLORS.green}${db.status}${COLORS.reset}` : `${COLORS.red}${db.status}${COLORS.reset}`}`);
        
        if (db.ports) {
            console.log(`${COLORS.cyan}Ports:${COLORS.reset} ${db.ports}`);
            const port = db.ports.split('->')[0].split(':')[1] || '5432';
            const connectionUrl = `postgresql://postgres:password@localhost:${port}/${db.name}`;
            console.log(`${COLORS.cyan}Connection URL:${COLORS.reset} ${this.maskDatabaseUrl(connectionUrl)}`);
        }
        
        if (db.image) {
            console.log(`${COLORS.cyan}Image:${COLORS.reset} ${db.image}`);
        }

        console.log('\n' + '─'.repeat(70));
        console.log(`${COLORS.dim}Press any key to return...${COLORS.reset}`);

        await this.waitForKey();
    }

    async showCreateDatabaseMenu(): Promise<void> {
        this.clearScreen();
        this.printHeader();
        console.log(`${COLORS.bright}${COLORS.white}CREATE DATABASE${COLORS.reset}`);
        console.log(`${COLORS.dim}Main Menu > Create Database${COLORS.reset}\n`);

        const name = await this.prompt('Database name: ');
        if (!name) return;

        const port = await this.prompt('Port (default 5432): ');
        const portNum = port ? parseInt(port) : 5432;

        const password = await this.prompt('Password (default "password"): ');
        const dbPassword = password || 'password';

        console.log(`\n${COLORS.yellow}Creating database...${COLORS.reset}`);

        try {
            await this.createDockerPostgres(name, dbPassword, portNum);
            console.log(`${COLORS.green}✓ Database created successfully!${COLORS.reset}`);
            console.log(`${COLORS.cyan}Connection URL:${COLORS.reset} postgresql://postgres:${dbPassword}@localhost:${portNum}/${name}`);
        } catch (error) {
            console.log(`${COLORS.red}✗ Failed to create database: ${error}${COLORS.reset}`);
        }

        console.log('\n' + '─'.repeat(70));
        console.log(`${COLORS.dim}Press any key to return...${COLORS.reset}`);
        await this.waitForKey();
    }

    async showEnvironmentMenu(): Promise<void> {
        this.prevView = this.currentView;
        this.currentView = 'environment';
        this.selectedIndex = 0;

        while (this.currentView === 'environment') {
            this.clearScreen();
            this.printHeader();
            console.log(`${COLORS.bright}${COLORS.white}ENVIRONMENT & CONNECTIONS${COLORS.reset}`);
            console.log(`${COLORS.dim}Main Menu > Environment & Connections${COLORS.reset}\n`);

            const options: TMenuItem[] = [
                { text: '📋 View Current Environment', value: 'current' },
                { text: '📄 View .env Files', value: 'dotenv' },
                { text: '🔧 View Database Configuration', value: 'config' },
                { text: '💾 Check SQLite Files', value: 'sqlite' },
                { text: '⬅️  Back to Main Menu', value: 'back' }
            ];

            for (let i = 0; i < options.length; i++) {
                this.printMenuItem(i, options[i].text, i === this.selectedIndex);
            }

            this.printFooter();

            const action = await this.handleNavigation(options, async (selected: TMenuItem) => {
                switch (selected.value) {
                    case 'current':
                        await this.showCurrentEnvironment();
                        break;
                    case 'dotenv':
                        await this.showDotenvFiles();
                        break;
                    case 'config':
                        await this.showDatabaseConfig();
                        break;
                    case 'sqlite':
                        await this.showSqliteFiles();
                        break;
                    case 'back':
                        this.currentView = this.prevView;
                        break;
                }
            });

            if (action === 'back' || action === 'quit') {
                this.currentView = this.prevView;
            }
        }
    }

    async showToolsMenu(): Promise<void> {
        this.prevView = this.currentView;
        this.currentView = 'tools';
        this.selectedIndex = 0;

        while (this.currentView === 'tools') {
            this.clearScreen();
            this.printHeader();
            console.log(`${COLORS.bright}${COLORS.white}DATABASE TOOLS${COLORS.reset}`);
            console.log(`${COLORS.dim}Main Menu > Database Tools${COLORS.reset}\n`);

            const options: TMenuItem[] = [
                { text: '🌱 Seed Database', value: 'seed' },
                { text: '💾 Backup Database', value: 'backup' },
                { text: '📥 Restore Database', value: 'restore' },
                { text: '📊 Database Statistics', value: 'stats' },
                { text: '⬅️  Back to Main Menu', value: 'back' }
            ];

            for (let i = 0; i < options.length; i++) {
                this.printMenuItem(i, options[i].text, i === this.selectedIndex);
            }

            this.printFooter();

            const action = await this.handleNavigation(options, async (selected: TMenuItem) => {
                switch (selected.value) {
                    case 'seed':
                        await this.showSeedMenu();
                        break;
                    case 'backup':
                        await this.showBackupMenu();
                        break;
                    case 'restore':
                        await this.showRestoreMenu();
                        break;
                    case 'stats':
                        await this.showDatabaseStats();
                        break;
                    case 'back':
                        this.currentView = this.prevView;
                        break;
                }
            });

            if (action === 'back' || action === 'quit') {
                this.currentView = this.prevView;
            }
        }
    }

    async showCurrentEnvironment(): Promise<void> {
        const envInfo = this.getEnvironmentInfo();

        this.clearScreen();
        this.printHeader();
        console.log(`${COLORS.bright}${COLORS.white}CURRENT ENVIRONMENT${COLORS.reset}`);
        console.log(`${COLORS.dim}Main Menu > Environment & Connections > Current Environment${COLORS.reset}\n`);

        console.log(`${COLORS.cyan}Working Directory:${COLORS.reset} ${envInfo.currentWorkingDir}`);
        console.log(`${COLORS.cyan}NODE_ENV:${COLORS.reset} ${envInfo.NODE_ENV || 'not set'}`);
        console.log(`${COLORS.cyan}DATABASE_URL:${COLORS.reset} ${envInfo.DATABASE_URL ? this.maskDatabaseUrl(envInfo.DATABASE_URL) : 'not set'}`);
        console.log(`${COLORS.cyan}DATABASE_AUTH_TOKEN:${COLORS.reset} ${envInfo.DATABASE_AUTH_TOKEN ? this.maskAuthToken(envInfo.DATABASE_AUTH_TOKEN) : 'not set'}`);

        console.log('\n' + '─'.repeat(70));
        console.log(`${COLORS.dim}Press any key to return...${COLORS.reset}`);
        await this.waitForKey();
    }

    async showDotenvFiles(): Promise<void> {
        this.clearScreen();
        this.printHeader();
        console.log(`${COLORS.bright}${COLORS.white}.ENV FILES${COLORS.reset}`);
        console.log(`${COLORS.dim}Main Menu > Environment & Connections > .env Files${COLORS.reset}\n`);

        const envFiles = this.findEnvFiles();

        if (envFiles.length === 0) {
            console.log(`${COLORS.yellow}No .env files found in current directory.${COLORS.reset}`);
        } else {
            envFiles.forEach(file => {
                console.log(`${COLORS.green}📄 ${file}${COLORS.reset}`);
                try {
                    const content = fs.readFileSync(file, 'utf-8');
                    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
                    lines.forEach(line => {
                        const [key, value] = line.split('=');
                        if (key && value) {
                            const displayValue = key.includes('PASSWORD') || key.includes('TOKEN') || key.includes('SECRET')
                                ? this.maskAuthToken(value.trim())
                                : value.trim();
                            console.log(`  ${COLORS.dim}${key.trim()}=${displayValue}${COLORS.reset}`);
                        }
                    });
                } catch (error) {
                    console.log(`  ${COLORS.red}Error reading file${COLORS.reset}`);
                }
                console.log();
            });
        }

        console.log('─'.repeat(70));
        console.log(`${COLORS.dim}Press any key to return...${COLORS.reset}`);
        await this.waitForKey();
    }

    async showDatabaseConfig(): Promise<void> {
        this.clearScreen();
        this.printHeader();
        console.log(`${COLORS.bright}${COLORS.white}DATABASE CONFIGURATION${COLORS.reset}`);
        console.log(`${COLORS.dim}Main Menu > Environment & Connections > Database Configuration${COLORS.reset}\n`);

        const configFiles = ['drizzle.config.ts', 'prisma/schema.prisma', 'knexfile.js'];
        let foundConfig = false;

        for (const configFile of configFiles) {
            if (fs.existsSync(configFile)) {
                foundConfig = true;
                console.log(`${COLORS.green}Found: ${configFile}${COLORS.reset}\n`);
            }
        }

        if (!foundConfig) {
            console.log(`${COLORS.yellow}No common database configuration files found.${COLORS.reset}`);
        }

        console.log('\n' + '─'.repeat(70));
        console.log(`${COLORS.dim}Press any key to return...${COLORS.reset}`);
        await this.waitForKey();
    }

    async showSqliteFiles(): Promise<void> {
        this.clearScreen();
        this.printHeader();
        console.log(`${COLORS.bright}${COLORS.white}SQLITE FILES${COLORS.reset}`);
        console.log(`${COLORS.dim}Main Menu > Environment & Connections > SQLite Files${COLORS.reset}\n`);

        const sqliteFiles = this.findSqliteFiles();

        if (sqliteFiles.length === 0) {
            console.log(`${COLORS.yellow}No SQLite database files found.${COLORS.reset}`);
        } else {
            sqliteFiles.forEach(file => {
                const stats = fs.statSync(file);
                console.log(`${COLORS.green}💾 ${file}${COLORS.reset}`);
                console.log(`  ${COLORS.dim}Size: ${this.formatFileSize(stats.size)}${COLORS.reset}`);
                console.log();
            });
        }

        console.log('─'.repeat(70));
        console.log(`${COLORS.dim}Press any key to return...${COLORS.reset}`);
        await this.waitForKey();
    }

    async showSeedMenu(): Promise<void> {
        this.clearScreen();
        this.printHeader();
        console.log(`${COLORS.bright}${COLORS.white}SEED DATABASE${COLORS.reset}`);
        console.log(`${COLORS.dim}Main Menu > Database Tools > Seed Database${COLORS.reset}\n`);

        const databases = await this.getRunningPostgres();
        if (databases.length === 0) {
            console.log(`${COLORS.yellow}No running databases found.${COLORS.reset}`);
            await this.waitForKey();
            return;
        }

        const seedFiles = this.findSeedFiles();
        if (seedFiles.length === 0) {
            console.log(`${COLORS.yellow}No seed files found in ./seed directory.${COLORS.reset}`);
            await this.waitForKey();
            return;
        }

        console.log('Available databases:');
        databases.forEach((db, idx) => {
            console.log(`${idx + 1}. ${db.name}`);
        });

        console.log('\nAvailable seed files:');
        seedFiles.forEach((file, idx) => {
            console.log(`${idx + 1}. ${file.name} (${this.formatFileSize(file.size)})`);
        });

        console.log(`\n${COLORS.dim}Feature coming soon...${COLORS.reset}`);
        console.log('\n' + '─'.repeat(70));
        console.log(`${COLORS.dim}Press any key to return...${COLORS.reset}`);
        await this.waitForKey();
    }

    async showBackupMenu(): Promise<void> {
        this.clearScreen();
        this.printHeader();
        console.log(`${COLORS.bright}${COLORS.white}BACKUP DATABASE${COLORS.reset}`);
        console.log(`${COLORS.dim}Main Menu > Database Tools > Backup Database${COLORS.reset}\n`);

        console.log(`${COLORS.dim}Feature coming soon...${COLORS.reset}`);
        console.log('\n' + '─'.repeat(70));
        console.log(`${COLORS.dim}Press any key to return...${COLORS.reset}`);
        await this.waitForKey();
    }

    async showRestoreMenu(): Promise<void> {
        this.clearScreen();
        this.printHeader();
        console.log(`${COLORS.bright}${COLORS.white}RESTORE DATABASE${COLORS.reset}`);
        console.log(`${COLORS.dim}Main Menu > Database Tools > Restore Database${COLORS.reset}\n`);

        console.log(`${COLORS.dim}Feature coming soon...${COLORS.reset}`);
        console.log('\n' + '─'.repeat(70));
        console.log(`${COLORS.dim}Press any key to return...${COLORS.reset}`);
        await this.waitForKey();
    }

    async showDatabaseStats(): Promise<void> {
        this.clearScreen();
        this.printHeader();
        console.log(`${COLORS.bright}${COLORS.white}DATABASE STATISTICS${COLORS.reset}`);
        console.log(`${COLORS.dim}Main Menu > Database Tools > Database Statistics${COLORS.reset}\n`);

        const databases = await this.getRunningPostgres();
        
        console.log(`${COLORS.cyan}Total Running Databases:${COLORS.reset} ${databases.length}`);
        console.log(`${COLORS.cyan}Docker Instances:${COLORS.reset} ${databases.filter(db => db.type === 'docker').length}`);
        console.log(`${COLORS.cyan}Local Instances:${COLORS.reset} ${databases.filter(db => db.type === 'local').length}`);

        console.log('\n' + '─'.repeat(70));
        console.log(`${COLORS.dim}Press any key to return...${COLORS.reset}`);
        await this.waitForKey();
    }

    async getRunningPostgres(): Promise<TDatabaseInstance[]> {
        const databases: TDatabaseInstance[] = [];

        try {
            const { stdout } = await execAsync('docker ps --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Ports}}|{{.Image}}"');
            const lines = stdout.trim().split('\n').filter(line => line);

            for (const line of lines) {
                const [containerId, name, status, ports, image] = line.split('|');
                if (image.includes('postgres')) {
                    databases.push({
                        name,
                        type: 'docker',
                        status: status.includes('Up') ? 'running' : 'stopped',
                        ports,
                        image,
                        containerId
                    });
                }
            }
        } catch (error) {
        }

        return databases;
    }

    async createDockerPostgres(name: string, password: string, port: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const cmd = `docker run -d --name ${name} -e POSTGRES_PASSWORD=${password} -e POSTGRES_DB=${name} -p ${port}:5432 postgres:latest`;
            
            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    reject(error.message);
                    return;
                }
                resolve();
            });
        });
    }

    async deleteDatabase(db: TDatabaseInstance): Promise<void> {
        this.clearScreen();
        this.printHeader();
        console.log(`${COLORS.red}${COLORS.bright}DELETE DATABASE${COLORS.reset}\n`);
        
        console.log(`${COLORS.yellow}⚠ Warning: You are about to delete the database "${db.name}".${COLORS.reset}`);
        console.log(`${COLORS.yellow}This action cannot be undone.${COLORS.reset}\n`);
        
        const confirm = await this.prompt(`Type "${db.name}" to confirm: `);
        
        if (confirm === db.name) {
            try {
                if (db.type === 'docker' && db.containerId) {
                    await execAsync(`docker stop ${db.containerId}`);
                    await execAsync(`docker rm ${db.containerId}`);
                    console.log(`${COLORS.green}✓ Database deleted successfully.${COLORS.reset}`);
                } else {
                    console.log(`${COLORS.red}✗ Cannot delete this database type.${COLORS.reset}`);
                }
            } catch (error) {
                console.log(`${COLORS.red}✗ Failed to delete database.${COLORS.reset}`);
            }
        } else {
            console.log(`${COLORS.yellow}Deletion cancelled.${COLORS.reset}`);
        }

        await this.waitForKey();
    }

    async copyConnectionUrl(db: TDatabaseInstance): Promise<void> {
        if (db.ports) {
            const port = db.ports.split('->')[0].split(':')[1] || '5432';
            const connectionUrl = `postgresql://postgres:password@localhost:${port}/${db.name}`;
            
            this.clearScreen();
            this.printHeader();
            console.log(`${COLORS.green}✓ Connection URL:${COLORS.reset}\n`);
            console.log(`${connectionUrl}\n`);
            console.log(`${COLORS.dim}(Copy this URL manually)${COLORS.reset}`);
            await this.waitForKey();
        }
    }

    async handleNavigation(
        options: TMenuItem[],
        onSelect: (selected: TMenuItem) => Promise<void>,
        onAction?: (key: string) => Promise<void>
    ): Promise<string> {
        return new Promise((resolve) => {
            const keyHandler = async (str: string, key: any) => {
                if (key.name === 'up') {
                    this.selectedIndex = Math.max(0, this.selectedIndex - 1);
                    resolve('navigate');
                } else if (key.name === 'down') {
                    this.selectedIndex = Math.min(options.length - 1, this.selectedIndex + 1);
                    resolve('navigate');
                } else if (key.name === 'return') {
                    process.stdin.removeListener('keypress', keyHandler);
                    await onSelect(options[this.selectedIndex]);
                    resolve('select');
                } else if (key.name === 'backspace') {
                    process.stdin.removeListener('keypress', keyHandler);
                    resolve('back');
                } else if (str === 'q' || (key.ctrl && key.name === 'c')) {
                    process.stdin.removeListener('keypress', keyHandler);
                    resolve('quit');
                } else if (onAction && (str === 'd' || str === 'c' || str === 'v')) {
                    process.stdin.removeListener('keypress', keyHandler);
                    await onAction(str);
                    resolve('action');
                }
            };

            process.stdin.on('keypress', keyHandler);
        });
    }

    private getEnvironmentInfo(): TEnvironmentInfo {
        return {
            DATABASE_URL: process.env.DATABASE_URL || null,
            DATABASE_AUTH_TOKEN: process.env.DATABASE_AUTH_TOKEN || null,
            NODE_ENV: process.env.NODE_ENV || 'development',
            currentWorkingDir: process.cwd()
        };
    }

    private maskDatabaseUrl(url: string): string {
        return url.replace(/(:\/\/)([^:]+):([^@]+)(@)/, '$1$2:****$4');
    }

    private maskAuthToken(token: string): string {
        if (token.length <= 8) return '****';
        return token.substring(0, 4) + '****' + token.substring(token.length - 4);
    }

    private formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    private findEnvFiles(): string[] {
        const files: string[] = [];
        const envPatterns = ['.env', '.env.local', '.env.development', '.env.production'];
        
        envPatterns.forEach(pattern => {
            if (fs.existsSync(pattern)) {
                files.push(pattern);
            }
        });

        return files;
    }

    private findSqliteFiles(): string[] {
        const files: string[] = [];
        const extensions = ['.db', '.sqlite', '.sqlite3'];

        function searchDirectory(dir: string, depth: number = 0): void {
            if (depth > 2) return;

            try {
                const items = fs.readdirSync(dir);
                items.forEach(item => {
                    const fullPath = path.join(dir, item);
                    try {
                        const stat = fs.statSync(fullPath);
                        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                            searchDirectory(fullPath, depth + 1);
                        } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
                            files.push(fullPath);
                        }
                    } catch (err) {
                    }
                });
            } catch (err) {
            }
        }

        searchDirectory('.');
        return files;
    }

    private findSeedFiles(): TSeedFile[] {
        const seedDir = path.join(process.cwd(), 'seed');
        const files: TSeedFile[] = [];

        if (!fs.existsSync(seedDir)) {
            return files;
        }

        try {
            const items = fs.readdirSync(seedDir);
            items.forEach(item => {
                if (item.endsWith('.sql')) {
                    const fullPath = path.join(seedDir, item);
                    const stats = fs.statSync(fullPath);
                    files.push({
                        name: item,
                        path: fullPath,
                        size: stats.size
                    });
                }
            });
        } catch (err) {
        }

        return files;
    }

    private async prompt(question: string): Promise<string> {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            process.stdin.setRawMode(false);
            
            rl.question(question, (answer) => {
                rl.close();
                if (process.stdin.isTTY) {
                    process.stdin.setRawMode(true);
                }
                resolve(answer.trim());
            });
        });
    }

    private async waitForKey(): Promise<void> {
        return new Promise((resolve) => {
            const keyHandler = () => {
                process.stdin.removeListener('keypress', keyHandler);
                resolve();
            };
            process.stdin.once('keypress', keyHandler);
        });
    }

    private cleanup(): void {
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
        this.rl.close();
        this.clearScreen();
        console.log(`${COLORS.cyan}Thank you for using PostgreSQL Database Manager!${COLORS.reset}\n`);
    }
}

async function main(): Promise<void> {
    const manager = new DatabaseManager();
    await manager.start();
    process.exit(0);
}

if (require.main === module) {
    main().catch((error) => {
        console.error(`${COLORS.red}Fatal error: ${error}${COLORS.reset}`);
        process.exit(1);
    });
}

export { DatabaseManager };
