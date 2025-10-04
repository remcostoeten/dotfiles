#!/usr/bin/env bun

import { readdirSync, statSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { spawn } from 'child_process';
import readline from 'readline';

type TScript = {
    name: string;
    path: string;
};

function clearScreen() {
    process.stdout.write('\x1B[2J\x1B[0f');
}

function showBanner() {
    console.log('\x1b[36m');
    console.log('    ██████╗  ██████╗ ████████╗███████╗██╗██╗     ███████╗███████╗');
    console.log('    ██╔══██╗██╔═══██╗╚══██╔══╝██╔════╝██║██║     ██╔════╝██╔════╝');
    console.log('    ██║  ██║██║   ██║   ██║   █████╗  ██║██║     █████╗  ███████╗');
    console.log('    ██║  ██║██║   ██║   ██║   ██╔══╝  ██║██║     ██╔══╝  ╚════██║');
    console.log('    ██████╔╝╚██████╔╝   ██║   ██║     ██║███████╗███████╗███████║');
    console.log('    ╚═════╝  ╚═════╝    ╚═╝   ╚═╝     ╚═╝╚══════╝╚══════╝╚══════╝');
    console.log('\x1b[0m\n');
}

function collectScripts(dotfilesRoot: string): TScript[] {
    const scripts: TScript[] = [];
    const seen = new Set<string>();
    
    const dirs = ['bin', 'scripts'];
    
    for (const dir of dirs) {
        const fullPath = join(dotfilesRoot, dir);
        
        if (!existsSync(fullPath)) continue;
        
        try {
            const files = readdirSync(fullPath);
            
            for (const file of files) {
                const filePath = join(fullPath, file);
                
                try {
                    const stats = statSync(filePath);
                    
                    if (stats.isFile()) {
                        const name = basename(file);
                        
                        if (!seen.has(name) && name !== 'dotfiles' && name !== 'dotfiles.old.fish') {
                            scripts.push({ name, path: filePath });
                            seen.add(name);
                        }
                    }
                } catch (e) {
                    continue;
                }
            }
        } catch (e) {
            continue;
        }
    }
    
    return scripts.sort((a, b) => a.name.localeCompare(b.name));
}

function displayMenu(scripts: TScript[], selected: number) {
    clearScreen();
    showBanner();
    
    console.log('\x1b[33mSelect a script to run:\x1b[0m\n');
    
    for (let i = 0; i < scripts.length; i++) {
        if (i === selected) {
            console.log(`\x1b[32;1m-> ${scripts[i].name}\x1b[0m`);
        } else {
            console.log(`   ${scripts[i].name}`);
        }
    }
    
    console.log('\n\x1b[90mUse arrow keys to navigate, Enter to select, \'q\' to quit\x1b[0m');
}

async function runInteractiveMenu(scripts: TScript[]) {
    if (scripts.length === 0) {
        console.log('\x1b[31mNo scripts found in bin/ or scripts/ directories!\x1b[0m');
        process.exit(1);
    }
    
    let selected = 0;
    
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    
    displayMenu(scripts, selected);
    
    return new Promise<TScript | null>((resolve) => {
        process.stdin.on('keypress', (str, key) => {
            if (!key) return;
            
            if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
                process.stdin.setRawMode(false);
                clearScreen();
                console.log('\x1b[32mGoodbye!\x1b[0m');
                resolve(null);
            } else if (key.name === 'up') {
                selected = selected > 0 ? selected - 1 : scripts.length - 1;
                displayMenu(scripts, selected);
            } else if (key.name === 'down') {
                selected = selected < scripts.length - 1 ? selected + 1 : 0;
                displayMenu(scripts, selected);
            } else if (key.name === 'return') {
                process.stdin.setRawMode(false);
                clearScreen();
                resolve(scripts[selected]);
            }
        });
    });
}

async function runScript(script: TScript) {
    console.log(`Running ${script.name}...\n`);
    
    const child = spawn(script.path, [], {
        stdio: 'inherit',
        shell: true
    });
    
    return new Promise<number>((resolve) => {
        child.on('exit', (code) => {
            resolve(code || 0);
        });
    });
}

async function main() {
    const dotfilesRoot = process.env.DOTFILES_DIR || join(process.env.HOME!, '.config', 'dotfiles');
    const scripts = collectScripts(dotfilesRoot);
    
    const selected = await runInteractiveMenu(scripts);
    
    if (selected) {
        const exitCode = await runScript(selected);
        process.exit(exitCode);
    }
    
    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});