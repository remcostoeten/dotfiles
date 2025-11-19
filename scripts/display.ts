#!/usr/bin/env bun
import { execSync, spawn } from 'child_process';
import readline from 'readline';
import { existsSync } from 'fs';

interface Display {
    id: string;
    name: string;
    connected: boolean;
    resolution: string;
    currentResolution: string;
    refreshRate: string;
    physicalSize: string;
    position: string;
    primary: boolean;
    inches?: number;
    zoom?: number;
    isExternal?: boolean;
    brand?: string;
    model?: string;
    nightlightStrength?: number;
}

interface DisplayMode {
    resolution: string;
    refreshRate: string;
    isCurrent: boolean;
}

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
    white: '\x1b[37m'
};

function c(color: keyof typeof COLORS, text: string): string {
    return `${COLORS[color]}${text}${COLORS.reset}`;
}

// Levenshtein distance implementation for fuzzy matching
function levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[str2.length][str1.length];
}

// Check if input is a close typo of "display"
function isCloseTypo(input: string): { isTypo: boolean; confidence: number } {
    const target = "display";
    const normalizedInput = input.toLowerCase().trim();

    // Exact match
    if (normalizedInput === target) {
        return { isTypo: false, confidence: 0 };
    }

    // Common typos dictionary
    const commonTypos = [
        "disply", "dislpay", "dispay", "diplay", "dispaly",
        "dispay", "disply", "dipslay", "dispaly", "dislpay",
        "displya", "displlay", "displaaay", "displey", "displai",
        "displayy", "displaya", "desplay", "dasplay", "dysplay",
        "dyslpay", "disp", "displa", "displ", "displaay",
        "diisplay", "diisplay", "displa", "dislpay", "desplay",
        "dissplay", "disssplay", "displlay", "displlay"
    ];

    // Check if it's a known typo
    if (commonTypos.includes(normalizedInput)) {
        return { isTypo: true, confidence: 0.8 };
    }

    // Calculate Levenshtein distance
    const distance = levenshteinDistance(normalizedInput, target);
    const maxLen = Math.max(normalizedInput.length, target.length);
    const similarity = 1 - (distance / maxLen);

    // Consider it a typo if similarity is high enough and length is reasonable
    if (similarity >= 0.7 && normalizedInput.length >= 4) {
        return { isTypo: true, confidence: similarity };
    }

    return { isTypo: false, confidence: 0 };
}

// Ask user if they meant "display"
async function askDidYouMean(input: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(
            c('yellow', `Did you mean ${c('bright', c('white', '"display"'))} instead of ${c('bright', c('red', `"${input}"`))}? (Y/n): `),
            (answer) => {
                rl.close();
                const normalizedAnswer = answer.trim().toLowerCase();
                resolve(normalizedAnswer === '' || normalizedAnswer === 'y' || normalizedAnswer === 'yes');
            }
        );
    });
}

function clearScreen() {
    process.stdout.write('\x1B[2J\x1B[0f');
}

// Dependency management
function checkDependency(command: string): boolean {
    try {
        execSync(`which ${command}`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

async function installDependency(packageName: string, command: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(
            c('yellow', `❌ ${command} not found. Install ${packageName}? (Y/n): `),
            async (answer) => {
                rl.close();
                const normalizedAnswer = answer.trim().toLowerCase();

                if (normalizedAnswer === '' || normalizedAnswer === 'y' || normalizedAnswer === 'yes') {
                    try {
                        console.log(c('cyan', `📦 Installing ${packageName}...`));

                        // Detect package manager and install
                        let installCmd = '';
                        if (checkDependency('apt-get')) {
                            installCmd = `sudo apt-get update && sudo apt-get install -y ${packageName}`;
                        } else if (checkDependency('dnf')) {
                            installCmd = `sudo dnf install -y ${packageName}`;
                        } else if (checkDependency('pacman')) {
                            installCmd = `sudo pacman -S --noconfirm ${packageName}`;
                        } else if (checkDependency('zypper')) {
                            installCmd = `sudo zypper install -y ${packageName}`;
                        } else {
                            console.log(c('red', `❌ Unsupported package manager. Please install ${packageName} manually.`));
                            resolve(false);
                            return;
                        }

                        execSync(installCmd, { stdio: 'inherit' });

                        if (checkDependency(command)) {
                            console.log(c('green', `✅ ${command} installed successfully!`));
                            resolve(true);
                        } else {
                            console.log(c('red', `❌ Failed to install ${command}. Please install manually.`));
                            resolve(false);
                        }
                    } catch (error) {
                        console.log(c('red', `❌ Failed to install ${packageName}: ${error}`));
                        resolve(false);
                    }
                } else {
                    console.log(c('yellow', `⚠️  Skipping ${command} installation.`));
                    resolve(false);
                }
            }
        );
    });
}

async function ensureDependencies(): Promise<boolean> {
    const dependencies = [
        { command: 'xrandr', package: 'x11-xserver-utils' },
        { command: 'xbacklight', package: 'xbacklight' },
        { command: 'redshift', package: 'redshift' }
    ];

    let missingDeps = 0;
    for (const dep of dependencies) {
        if (!checkDependency(dep.command)) {
            missingDeps++;
        }
    }

    if (missingDeps === 0) {
        return true;
    }

    console.log(c('yellow', `🔍 Found ${missingDeps} missing dependencies...`));

    for (const dep of dependencies) {
        if (!checkDependency(dep.command)) {
            const installed = await installDependency(dep.package, dep.command);
            if (!installed && dep.command === 'xrandr') {
                console.log(c('red', '❌ xrandr is required for display management. Exiting.'));
                return false;
            }
        }
    }

    return true;
}

// Display management functions
function getDisplays(): Display[] {
    try {
        const xrandrOutput = execSync('xrandr', { encoding: 'utf8' });
        const lines = xrandrOutput.split('\n');
        const displays: Display[] = [];

        let currentDisplay: Display | null = null;

        for (const line of lines) {
            if (!line.trim()) continue;

            // Connected display line
            if (line.includes(' connected')) {
                const parts = line.split(/\s+/);
                const name = parts[0];
                const connected = true;
                const primary = line.includes('primary');
                const resolutionMatch = line.match(/(\d+x\d+)\+(\d+)\+(\d+)/);
                const currentResolution = resolutionMatch ? resolutionMatch[1] : 'Unknown';
                const position = resolutionMatch ? `${resolutionMatch[2]},${resolutionMatch[3]}` : 'Unknown';

                // Try to get physical size
                let physicalSize = 'Unknown';
                const sizeMatch = line.match(/(\d+)mm x (\d+)mm/);
                if (sizeMatch) {
                    physicalSize = `${sizeMatch[1]}x${sizeMatch[2]}mm`;
                }

                currentDisplay = {
                    id: name,
                    name,
                    connected,
                    resolution: currentResolution,
                    currentResolution,
                    refreshRate: '60Hz',
                    physicalSize,
                    position,
                    primary,
                    isExternal: !name.includes('eDP-') && !name.includes('LVDS')
                };

                displays.push(currentDisplay);
            }
            // Disconnected display line
            else if (line.includes(' disconnected')) {
                const parts = line.split(/\s+/);
                const name = parts[0];

                displays.push({
                    id: name,
                    name,
                    connected: false,
                    resolution: 'Unknown',
                    currentResolution: 'Unknown',
                    refreshRate: 'Unknown',
                    physicalSize: 'Unknown',
                    position: 'Unknown',
                    primary: false,
                    isExternal: !name.includes('eDP-') && !name.includes('LVDS')
                });
            }
            // Resolution modes
            else if (currentDisplay && line.match(/^\s*\d+x\d+/)) {
                const modeMatch = line.match(/^\s*(\d+x\d+)\s*(\d+(?:\.\d+)?)\*?/);
                if (modeMatch) {
                    // This is a mode for the current display
                    // We could collect modes here if needed
                }
            }
        }

        return displays;
    } catch (error) {
        console.error(c('red', 'Failed to get display information:'), error);
        return [];
    }
}

function getDisplayModes(displayName: string): DisplayMode[] {
    try {
        const xrandrOutput = execSync(`xrandr --query`, { encoding: 'utf8' });
        const lines = xrandrOutput.split('\n');
        const modes: DisplayMode[] = [];
        let foundDisplay = false;

        for (const line of lines) {
            if (line.startsWith(displayName)) {
                foundDisplay = true;
                continue;
            }

            if (foundDisplay && line.match(/^\s*\d+x\d+/)) {
                const modeMatch = line.match(/^\s*(\d+x\d+)\s*(\d+(?:\.\d+)?)(\*)?/);
                if (modeMatch) {
                    modes.push({
                        resolution: modeMatch[1],
                        refreshRate: modeMatch[2] + 'Hz',
                        isCurrent: modeMatch[3] === '*'
                    });
                }
            } else if (foundDisplay && line.match(/^\w+/)) {
                // We've reached the next display
                break;
            }
        }

        return modes;
    } catch (error) {
        console.error(c('red', `Failed to get modes for display ${displayName}:`), error);
        return [];
    }
}

function setDisplayResolution(displayName: string, resolution: string): boolean {
    try {
        execSync(`xrandr --output ${displayName} --mode ${resolution}`, { stdio: 'inherit' });
        return true;
    } catch (error) {
        console.error(c('red', `Failed to set resolution for ${displayName}:`), error);
        return false;
    }
}

function setDisplayBrightness(displayName: string, brightness: number): boolean {
    if (displayName.includes('eDP-') || displayName.includes('LVDS')) {
        // Laptop display - try xbacklight first
        try {
            execSync(`xbacklight -set ${brightness}`, { stdio: 'ignore' });
            return true;
        } catch {
            // Fallback to xrandr (limited support)
            try {
                execSync(`xrandr --output ${displayName} --brightness ${brightness / 100}`, { stdio: 'ignore' });
                return true;
            } catch (error) {
                console.error(c('red', `Failed to set brightness for ${displayName}:`), error);
                return false;
            }
        }
    } else {
        // External display - use xrandr brightness (software dimming)
        try {
            execSync(`xrandr --output ${displayName} --brightness ${brightness / 100}`, { stdio: 'ignore' });
            return true;
        } catch (error) {
            console.error(c('red', `Failed to set brightness for ${displayName}:`), error);
            return false;
        }
    }
}

function rotateDisplay(displayName: string, rotation: string): boolean {
    const validRotations = ['normal', 'left', 'right', 'inverted'];
    if (!validRotations.includes(rotation)) {
        console.error(c('red', `Invalid rotation: ${rotation}. Valid options: ${validRotations.join(', ')}`));
        return false;
    }

    try {
        execSync(`xrandr --output ${displayName} --rotate ${rotation}`, { stdio: 'inherit' });
        return true;
    } catch (error) {
        console.error(c('red', `Failed to rotate ${displayName}:`), error);
        return false;
    }
}

function turnOffDisplay(displayName: string): boolean {
    try {
        execSync(`xrandr --output ${displayName} --off`, { stdio: 'inherit' });
        return true;
    } catch (error) {
        console.error(c('red', `Failed to turn off ${displayName}:`), error);
        return false;
    }
}

function turnOnDisplay(displayName: string): boolean {
    try {
        execSync(`xrandr --output ${displayName} --auto`, { stdio: 'inherit' });
        return true;
    } catch (error) {
        console.error(c('red', `Failed to turn on ${displayName}:`), error);
        return false;
    }
}

function setNightlight(strength: number): boolean {
    try {
        if (checkDependency('redshift')) {
            execSync(`redshift -O ${5500 - (strength * 20)}`, { stdio: 'inherit' });
            return true;
        } else {
            console.log(c('yellow', '⚠️  redshift not found. Nightlight requires redshift package.'));
            return false;
        }
    } catch (error) {
        console.error(c('red', 'Failed to set nightlight:'), error);
        return false;
    }
}

function disableNightlight(): boolean {
    try {
        if (checkDependency('redshift')) {
            execSync('redshift -x', { stdio: 'inherit' });
            return true;
        } else {
            console.log(c('yellow', '⚠️  redshift not found. Nightlight requires redshift package.'));
            return false;
        }
    } catch (error) {
        console.error(c('red', 'Failed to disable nightlight:'), error);
        return false;
    }
}

// Interactive mode functions
async function showInteractiveMenu(): Promise<void> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    while (true) {
        clearScreen();
        showBanner();

        const displays = getDisplays();

        console.log(c('bright', c('cyan', '📺 CONNECTED DISPLAYS:')));
        console.log();

        for (const display of displays.filter(d => d.connected)) {
            const status = display.primary ? c('green', '[PRIMARY]') : c('yellow', '[EXTERNAL]');
            console.log(`${c('white', display.name.padEnd(10))} ${status} ${c('cyan', display.currentResolution)} ${c('dim', display.position)}`);
        }

        console.log();
        console.log(c('bright', c('cyan', '🎛️  INTERACTIVE MENU:')));
        console.log(c('white', '1.') + ' List all displays');
        console.log(c('white', '2.') + ' Change resolution');
        console.log(c('white', '3.') + ' Adjust brightness');
        console.log(c('white', '4.') + ' Rotate display');
        console.log(c('white', '5.') + ' Toggle nightlight');
        console.log(c('white', '6.') + ' Turn display on/off');
        console.log(c('white', 'q.') + ' Quit');
        console.log();

        const answer = await new Promise<string>((resolve) => {
            rl.question(c('cyan', 'Select an option: '), (input) => {
                resolve(input.trim().toLowerCase());
            });
        });

        switch (answer) {
            case '1':
                await showDisplaysList(displays);
                await new Promise(resolve => rl.question(c('dim', '\nPress Enter to continue...')));
                break;
            case '2':
                await handleResolutionChange(displays, rl);
                break;
            case '3':
                await handleBrightnessChange(displays, rl);
                break;
            case '4':
                await handleDisplayRotation(displays, rl);
                break;
            case '5':
                await handleNightlight(rl);
                break;
            case '6':
                await handleDisplayToggle(displays, rl);
                break;
            case 'q':
                rl.close();
                return;
            default:
                console.log(c('red', 'Invalid option. Please try again.'));
                await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

async function showDisplaysList(displays: Display[]): Promise<void> {
    clearScreen();
    showBanner();
    console.log(c('bright', c('cyan', '📺 ALL DISPLAYS:')));
    console.log();

    for (const display of displays) {
        const status = display.connected
            ? (display.primary ? c('green', '● Connected (Primary)') : c('yellow', '● Connected'))
            : c('red', '○ Disconnected');

        console.log(`${c('white', display.name.padEnd(10))} ${status}`);
        if (display.connected) {
            console.log(`  ${c('dim', `Resolution: ${display.currentResolution}`)}`);
            console.log(`  ${c('dim', `Position: ${display.position}`)}`);
            if (display.physicalSize !== 'Unknown') {
                console.log(`  ${c('dim', `Physical: ${display.physicalSize}`)}`);
            }
        }
        console.log();
    }
}

async function handleResolutionChange(displays: Display[], rl: readline.Interface): Promise<void> {
    const connectedDisplays = displays.filter(d => d.connected);
    if (connectedDisplays.length === 0) {
        console.log(c('red', 'No connected displays found.'));
        await new Promise(resolve => rl.question(c('dim', '\nPress Enter to continue...')));
        return;
    }

    console.log(c('cyan', '\nSelect display:'));
    connectedDisplays.forEach((display, index) => {
        console.log(`${c('white', (index + 1).toString() + '.')} ${display.name} (${display.currentResolution})`);
    });

    const displayAnswer = await new Promise<string>((resolve) => {
        rl.question(c('cyan', 'Enter display number: '), resolve);
    });

    const displayIndex = parseInt(displayAnswer) - 1;
    if (displayIndex < 0 || displayIndex >= connectedDisplays.length) {
        console.log(c('red', 'Invalid display selection.'));
        await new Promise(resolve => rl.question(c('dim', '\nPress Enter to continue...')));
        return;
    }

    const selectedDisplay = connectedDisplays[displayIndex];
    const modes = getDisplayModes(selectedDisplay.name);

    console.log(c('cyan', `\nAvailable resolutions for ${selectedDisplay.name}:`));
    modes.forEach((mode, index) => {
        const current = mode.isCurrent ? c('green', ' (current)') : '';
        console.log(`${c('white', (index + 1).toString() + '.')} ${mode.resolution} @ ${mode.refreshRate}${current}`);
    });

    const modeAnswer = await new Promise<string>((resolve) => {
        rl.question(c('cyan', 'Enter resolution number: '), resolve);
    });

    const modeIndex = parseInt(modeAnswer) - 1;
    if (modeIndex < 0 || modeIndex >= modes.length) {
        console.log(c('red', 'Invalid resolution selection.'));
        await new Promise(resolve => rl.question(c('dim', '\nPress Enter to continue...')));
        return;
    }

    const selectedMode = modes[modeIndex];
    if (setDisplayResolution(selectedDisplay.name, selectedMode.resolution)) {
        console.log(c('green', `✅ Resolution changed to ${selectedMode.resolution} for ${selectedDisplay.name}`));
    } else {
        console.log(c('red', `❌ Failed to change resolution`));
    }

    await new Promise(resolve => rl.question(c('dim', '\nPress Enter to continue...')));
}

async function handleBrightnessChange(displays: Display[], rl: readline.Interface): Promise<void> {
    const connectedDisplays = displays.filter(d => d.connected);
    if (connectedDisplays.length === 0) {
        console.log(c('red', 'No connected displays found.'));
        await new Promise(resolve => rl.question(c('dim', '\nPress Enter to continue...')));
        return;
    }

    console.log(c('cyan', '\nSelect display:'));
    connectedDisplays.forEach((display, index) => {
        const type = display.isExternal ? 'External' : 'Internal';
        console.log(`${c('white', (index + 1).toString() + '.')} ${display.name} (${type})`);
    });

    const displayAnswer = await new Promise<string>((resolve) => {
        rl.question(c('cyan', 'Enter display number: '), resolve);
    });

    const displayIndex = parseInt(displayAnswer) - 1;
    if (displayIndex < 0 || displayIndex >= connectedDisplays.length) {
        console.log(c('red', 'Invalid display selection.'));
        await new Promise(resolve => rl.question(c('dim', '\nPress Enter to continue...')));
        return;
    }

    const brightnessAnswer = await new Promise<string>((resolve) => {
        rl.question(c('cyan', 'Enter brightness (0-100): '), resolve);
    });

    const brightness = parseInt(brightnessAnswer);
    if (isNaN(brightness) || brightness < 0 || brightness > 100) {
        console.log(c('red', 'Invalid brightness value. Please enter a number between 0 and 100.'));
        await new Promise(resolve => rl.question(c('dim', '\nPress Enter to continue...')));
        return;
    }

    const selectedDisplay = connectedDisplays[displayIndex];
    if (setDisplayBrightness(selectedDisplay.name, brightness)) {
        console.log(c('green', `✅ Brightness set to ${brightness}% for ${selectedDisplay.name}`));
    } else {
        console.log(c('red', `❌ Failed to set brightness`));
    }

    await new Promise(resolve => rl.question(c('dim', '\nPress Enter to continue...')));
}

async function handleDisplayRotation(displays: Display[], rl: readline.Interface): Promise<void> {
    const connectedDisplays = displays.filter(d => d.connected);
    if (connectedDisplays.length === 0) {
        console.log(c('red', 'No connected displays found.'));
        await new Promise(resolve => rl.question(c('dim', '\nPress Enter to continue...')));
        return;
    }

    console.log(c('cyan', '\nSelect display:'));
    connectedDisplays.forEach((display, index) => {
        console.log(`${c('white', (index + 1).toString() + '.')} ${display.name} (${display.currentResolution})`);
    });

    const displayAnswer = await new Promise<string>((resolve) => {
        rl.question(c('cyan', 'Enter display number: '), resolve);
    });

    const displayIndex = parseInt(displayAnswer) - 1;
    if (displayIndex < 0 || displayIndex >= connectedDisplays.length) {
        console.log(c('red', 'Invalid display selection.'));
        await new Promise(resolve => rl.question(c('dim', '\nPress Enter to continue...')));
        return;
    }

    console.log(c('cyan', '\nSelect rotation:'));
    console.log(c('white', '1.') + ' Normal');
    console.log(c('white', '2.') + ' Left (90° CCW)');
    console.log(c('white', '3.') + ' Right (90° CW)');
    console.log(c('white', '4.') + ' Inverted (180°)');

    const rotationAnswer = await new Promise<string>((resolve) => {
        rl.question(c('cyan', 'Enter rotation number: '), resolve);
    });

    const rotations = ['normal', 'left', 'right', 'inverted'];
    const rotationIndex = parseInt(rotationAnswer) - 1;
    if (rotationIndex < 0 || rotationIndex >= rotations.length) {
        console.log(c('red', 'Invalid rotation selection.'));
        await new Promise(resolve => rl.question(c('dim', '\nPress Enter to continue...')));
        return;
    }

    const selectedDisplay = connectedDisplays[displayIndex];
    const selectedRotation = rotations[rotationIndex];

    if (rotateDisplay(selectedDisplay.name, selectedRotation)) {
        console.log(c('green', `✅ Display ${selectedDisplay.name} rotated to ${selectedRotation}`));
    } else {
        console.log(c('red', `❌ Failed to rotate display`));
    }

    await new Promise(resolve => rl.question(c('dim', '\nPress Enter to continue...')));
}

async function handleNightlight(rl: readline.Interface): Promise<void> {
    console.log(c('cyan', '\nNightlight options:'));
    console.log(c('white', '1.') + ' Enable nightlight');
    console.log(c('white', '2.') + ' Disable nightlight');
    console.log(c('white', '3.') + ' Set custom strength');

    const answer = await new Promise<string>((resolve) => {
        rl.question(c('cyan', 'Enter option: '), resolve);
    });

    switch (answer) {
        case '1':
            if (setNightlight(50)) {
                console.log(c('green', '✅ Nightlight enabled at 50% strength'));
            }
            break;
        case '2':
            if (disableNightlight()) {
                console.log(c('green', '✅ Nightlight disabled'));
            }
            break;
        case '3':
            const strengthAnswer = await new Promise<string>((resolve) => {
                rl.question(c('cyan', 'Enter strength (0-100): '), resolve);
            });
            const strength = parseInt(strengthAnswer);
            if (isNaN(strength) || strength < 0 || strength > 100) {
                console.log(c('red', 'Invalid strength value. Please enter a number between 0 and 100.'));
            } else if (setNightlight(strength)) {
                console.log(c('green', `✅ Nightlight enabled at ${strength}% strength`));
            }
            break;
        default:
            console.log(c('red', 'Invalid option.'));
    }

    await new Promise(resolve => rl.question(c('dim', '\nPress Enter to continue...')));
}

async function handleDisplayToggle(displays: Display[], rl: readline.Interface): Promise<void> {
    const allDisplays = displays; // Include disconnected displays

    console.log(c('cyan', '\nSelect display:'));
    allDisplays.forEach((display, index) => {
        const status = display.connected ? c('green', 'On') : c('red', 'Off');
        console.log(`${c('white', (index + 1).toString() + '.')} ${display.name} (${status})`);
    });

    const displayAnswer = await new Promise<string>((resolve) => {
        rl.question(c('cyan', 'Enter display number: '), resolve);
    });

    const displayIndex = parseInt(displayAnswer) - 1;
    if (displayIndex < 0 || displayIndex >= allDisplays.length) {
        console.log(c('red', 'Invalid display selection.'));
        await new Promise(resolve => rl.question(c('dim', '\nPress Enter to continue...')));
        return;
    }

    console.log(c('cyan', '\nSelect action:'));
    console.log(c('white', '1.') + ' Turn on');
    console.log(c('white', '2.') + ' Turn off');

    const actionAnswer = await new Promise<string>((resolve) => {
        rl.question(c('cyan', 'Enter action number: '), resolve);
    });

    const selectedDisplay = allDisplays[displayIndex];

    if (actionAnswer === '1') {
        if (turnOnDisplay(selectedDisplay.name)) {
            console.log(c('green', `✅ Display ${selectedDisplay.name} turned on`));
        } else {
            console.log(c('red', `❌ Failed to turn on display`));
        }
    } else if (actionAnswer === '2') {
        if (turnOffDisplay(selectedDisplay.name)) {
            console.log(c('green', `✅ Display ${selectedDisplay.name} turned off`));
        } else {
            console.log(c('red', `❌ Failed to turn off display`));
        }
    } else {
        console.log(c('red', 'Invalid action.'));
    }

    await new Promise(resolve => rl.question(c('dim', '\nPress Enter to continue...')));
}

function showBanner() {
    console.log(c('cyan', '╔══════════════════════════════════════════════════════════════════════════════╗'));
    console.log(c('cyan', '║') + c('bright', c('white', '                    DISPLAY CONTROL CENTER                         ') + c('cyan', ' ║')));
    console.log(c('cyan', '╚══════════════════════════════════════════════════════════════════════════════╝'));
    console.log();
}

function showHelp() {
    clearScreen();
    showBanner();

    console.log(c('bright', c('cyan', 'USAGE:') + ' ' + c('white', 'display [OPTIONS] [SUBCOMMANDS]')));
    console.log();

    console.log(c('bright', c('cyan', 'OPTIONS:')));
    console.log(c('white', '  help, --help, -h') + c('dim', c('white', '          Show this help message')));
    console.log(c('white', '  interactive') + c('dim', c('white', '             Launch interactive display manager')));
    console.log(c('white', '  list') + c('dim', c('white', '                    List all displays and their information')));
    console.log(c('white', '  info') + c('dim', c('white', '                    Show detailed display information')));
    console.log();

    console.log(c('bright', c('cyan', 'SUBCOMMANDS:')));
    console.log(c('white', '  resolution [display] [mode]') + c('dim', c('white', '    Set display resolution')));
    console.log(c('white', '  brightness [display] [0-100]') + c('dim', c('white', '  Set display brightness')));
    console.log(c('white', '  rotate [display] [rotation]') + c('dim', c('white', '  Rotate display')));
    console.log(c('white', '  nightlight [on/off] [strength]') + c('dim', c('white', ' Control nightlight')));
    console.log(c('white', '  zoom [display] [percentage]') + c('dim', c('white', '  Set display zoom level')));
    console.log(c('white', '  off') + c('dim', c('white', '                     Turn off all displays immediately')));
    console.log(c('white', '  on [display]') + c('dim', c('white', '             Turn on specific display')));
    console.log();

    console.log(c('bright', c('magenta', 'CLI EXAMPLES:')));
    console.log(c('cyan', '  display help') + c('dim', c('white', '                           Show this help')));
    console.log(c('cyan', '  display list') + c('dim', c('white', '                           List all displays')));
    console.log(c('cyan', '  display resolution HDMI-1 1920x1080') + c('dim', c('white', '      Set HDMI-1 to 1080p')));
    console.log(c('cyan', '  display brightness eDP-1 75') + c('dim', c('white', '           Set laptop brightness to 75%')));
    console.log(c('cyan', '  display rotate HDMI-1 left') + c('dim', c('white', '           Rotate HDMI-1 90° left')));
    console.log(c('cyan', '  display nightlight on 80') + c('dim', c('white', '            Enable nightlight at 80%')));
    console.log(c('cyan', '  display nightlight off') + c('dim', c('white', '              Disable nightlight')));
    console.log(c('cyan', '  display zoom HDMI-1 125') + c('dim', c('white', '              Set HDMI-1 zoom to 125%')));
    console.log(c('cyan', '  display off') + c('dim', c('white', '                            Turn off all displays')));
    console.log(c('cyan', '  display on HDMI-1') + c('dim', c('white', '                     Turn on HDMI-1')));
    console.log();

    console.log(c('dim', c('blue', 'Note: This tool requires xrandr for display management. Nightlight works best on GNOME or with redshift installed.')));
}

// CLI command handlers
function handleListCommand(): void {
    clearScreen();
    showBanner();
    const displays = getDisplays();

    console.log(c('bright', c('cyan', '📺 CONNECTED DISPLAYS:')));
    console.log();

    const connectedDisplays = displays.filter(d => d.connected);
    if (connectedDisplays.length === 0) {
        console.log(c('yellow', 'No connected displays found.'));
        return;
    }

    for (const display of connectedDisplays) {
        const status = display.primary ? c('green', '[PRIMARY]') : c('yellow', '[EXTERNAL]');
        console.log(`${c('white', display.name.padEnd(12))} ${status} ${c('cyan', display.currentResolution.padEnd(12))} ${c('dim', `Pos: ${display.position}`)}`);
        if (display.physicalSize !== 'Unknown') {
            console.log(`  ${c('dim', `Physical: ${display.physicalSize}`)}`);
        }
        console.log();
    }

    const disconnectedDisplays = displays.filter(d => !d.connected);
    if (disconnectedDisplays.length > 0) {
        console.log(c('dim', c('red', '📴 DISCONNECTED DISPLAYS:')));
        for (const display of disconnectedDisplays) {
            console.log(`  ${c('dim', display.name)}`);
        }
    }
}

function handleResolutionCommand(displayName?: string, resolution?: string): void {
    if (!displayName || !resolution) {
        console.log(c('red', '❌ Usage: display resolution <display_name> <resolution>'));
        console.log(c('dim', 'Example: display resolution HDMI-1 1920x1080'));
        console.log(c('cyan', '💡 Use "display list" to see available displays.'));
        return;
    }

    const displays = getDisplays();
    const display = displays.find(d => d.name === displayName && d.connected);

    if (!display) {
        console.log(c('red', `❌ Display "${displayName}" not found or not connected.`));
        console.log(c('cyan', '💡 Use "display list" to see available displays.'));
        return;
    }

    // Check if resolution is available
    const modes = getDisplayModes(displayName);
    const modeExists = modes.some(m => m.resolution === resolution);

    if (!modeExists) {
        console.log(c('red', `❌ Resolution "${resolution}" not available for ${displayName}.`));
        console.log(c('cyan', `Available resolutions: ${modes.map(m => m.resolution).join(', ')}`));
        return;
    }

    if (setDisplayResolution(displayName, resolution)) {
        console.log(c('green', `✅ Resolution changed to ${resolution} for ${displayName}`));
    } else {
        console.log(c('red', `❌ Failed to change resolution`));
    }
}

function handleBrightnessCommand(displayName?: string, brightnessStr?: string): void {
    if (!displayName || brightnessStr === undefined) {
        console.log(c('red', '❌ Usage: display brightness <display_name> <0-100>'));
        console.log(c('dim', 'Example: display brightness eDP-1 75'));
        console.log(c('cyan', '💡 Use "display list" to see available displays.'));
        return;
    }

    const brightness = parseInt(brightnessStr);
    if (isNaN(brightness) || brightness < 0 || brightness > 100) {
        console.log(c('red', '❌ Brightness must be a number between 0 and 100.'));
        return;
    }

    const displays = getDisplays();
    const display = displays.find(d => d.name === displayName && d.connected);

    if (!display) {
        console.log(c('red', `❌ Display "${displayName}" not found or not connected.`));
        console.log(c('cyan', '💡 Use "display list" to see available displays.'));
        return;
    }

    if (setDisplayBrightness(displayName, brightness)) {
        console.log(c('green', `✅ Brightness set to ${brightness}% for ${displayName}`));
    } else {
        console.log(c('red', `❌ Failed to set brightness`));
    }
}

function handleRotateCommand(displayName?: string, rotation?: string): void {
    if (!displayName || !rotation) {
        console.log(c('red', '❌ Usage: display rotate <display_name> <rotation>'));
        console.log(c('dim', 'Example: display rotate HDMI-1 left'));
        console.log(c('cyan', 'Rotations: normal, left, right, inverted'));
        return;
    }

    const displays = getDisplays();
    const display = displays.find(d => d.name === displayName && d.connected);

    if (!display) {
        console.log(c('red', `❌ Display "${displayName}" not found or not connected.`));
        console.log(c('cyan', '💡 Use "display list" to see available displays.'));
        return;
    }

    if (rotateDisplay(displayName, rotation)) {
        console.log(c('green', `✅ Display ${displayName} rotated to ${rotation}`));
    } else {
        console.log(c('red', `❌ Failed to rotate display`));
    }
}

function handleNightlightCommand(state?: string, strengthStr?: string): void {
    if (!state) {
        console.log(c('red', '❌ Usage: display nightlight <on/off> [strength]'));
        console.log(c('dim', 'Example: display nightlight on 80'));
        console.log(c('dim', 'Example: display nightlight off'));
        return;
    }

    if (state === 'off') {
        if (disableNightlight()) {
            console.log(c('green', '✅ Nightlight disabled'));
        } else {
            console.log(c('red', '❌ Failed to disable nightlight'));
        }
    } else if (state === 'on') {
        const strength = strengthStr ? parseInt(strengthStr) : 50;
        if (isNaN(strength) || strength < 0 || strength > 100) {
            console.log(c('red', '❌ Strength must be a number between 0 and 100.'));
            return;
        }

        if (setNightlight(strength)) {
            console.log(c('green', `✅ Nightlight enabled at ${strength}% strength`));
        } else {
            console.log(c('red', '❌ Failed to enable nightlight'));
        }
    } else {
        console.log(c('red', '❌ Invalid state. Use "on" or "off".'));
    }
}

function handleOffCommand(): void {
    const displays = getDisplays();
    const connectedDisplays = displays.filter(d => d.connected);

    if (connectedDisplays.length === 0) {
        console.log(c('yellow', 'No connected displays to turn off.'));
        return;
    }

    console.log(c('yellow', 'Turning off all displays...'));
    for (const display of connectedDisplays) {
        if (turnOffDisplay(display.name)) {
            console.log(c('green', `✅ ${display.name} turned off`));
        } else {
            console.log(c('red', `❌ Failed to turn off ${display.name}`));
        }
    }
}

function handleOnCommand(displayName?: string): void {
    if (!displayName) {
        console.log(c('red', '❌ Usage: display on <display_name>'));
        console.log(c('dim', 'Example: display on HDMI-1'));
        console.log(c('cyan', '💡 Use "display list" to see all displays.'));
        return;
    }

    const displays = getDisplays();
    const display = displays.find(d => d.name === displayName);

    if (!display) {
        console.log(c('red', `❌ Display "${displayName}" not found.`));
        console.log(c('cyan', '💡 Use "display list" to see available displays.'));
        return;
    }

    if (turnOnDisplay(displayName)) {
        console.log(c('green', `✅ Display ${displayName} turned on`));
    } else {
        console.log(c('red', `❌ Failed to turn on display`));
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (command === 'help' || command === '--help' || command === '-h') {
        showHelp();
        return;
    }

    // Ensure dependencies are installed
    const depsOk = await ensureDependencies();
    if (!depsOk && (command === 'interactive' || !command)) {
        console.log(c('red', '❌ Cannot continue without required dependencies.'));
        return;
    }

    if (command === 'interactive' || !command) {
        await showInteractiveMenu();
        return;
    }

    // Handle CLI commands
    switch (command) {
        case 'list':
            handleListCommand();
            break;
        case 'info':
            handleListCommand(); // Same as list for now
            break;
        case 'resolution':
            handleResolutionCommand(args[1], args[2]);
            break;
        case 'brightness':
            handleBrightnessCommand(args[1], args[2]);
            break;
        case 'rotate':
            handleRotateCommand(args[1], args[2]);
            break;
        case 'nightlight':
            handleNightlightCommand(args[1], args[2]);
            break;
        case 'off':
            handleOffCommand();
            break;
        case 'on':
            handleOnCommand(args[1]);
            break;
        default:
            // Check for potential typos
            const typoCheck = isCloseTypo(command);
            if (typoCheck.isTypo) {
                const confirmed = await askDidYouMean(command);
                if (confirmed) {
                    console.log(c('green', '\n✓ Assuming you meant "display"...'));
                    await showInteractiveMenu();
                    return;
                } else {
                    console.log(c('red', '\n✗ Command not recognized.'));
                    showHelp();
                    return;
                }
            }

            console.log(c('yellow', `❌ Unknown command: ${command}`));
            console.log(c('cyan', 'Use "display help" to see available commands.'));
    }
}

main().catch(error => {
    console.error(c('red', 'An error occurred:'), error);
    process.exit(1);
});