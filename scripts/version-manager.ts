#!/usr/bin/env bun
/**
 * Version Management Script for Dotfiles
 * Usage: bun run scripts/version-manager.ts [command] [options]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_FILE = join(ROOT_DIR, 'VERSION');
const PACKAGE_JSON = join(ROOT_DIR, 'opentui-setup', 'package.json');

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function getCurrentVersion(): string {
    if (existsSync(VERSION_FILE)) {
        return readFileSync(VERSION_FILE, 'utf-8').trim();
    }
    if (existsSync(PACKAGE_JSON)) {
        const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8'));
        return pkg.version || '0.0.0';
    }
    return '0.0.0';
}

function bumpVersion(currentVersion: string, bumpType: 'major' | 'minor' | 'patch'): string {
    const [major, minor, patch] = currentVersion.split('.').map(Number);

    switch (bumpType) {
        case 'major':
            return `${major + 1}.0.0`;
        case 'minor':
            return `${major}.${minor + 1}.0`;
        case 'patch':
            return `${major}.${minor}.${patch + 1}`;
        default:
            throw new Error(`Invalid bump type: ${bumpType}`);
    }
}

function updateVersion(version: string): void {
    // Update VERSION file
    writeFileSync(VERSION_FILE, version + '\n', 'utf-8');
    log(`✓ Updated VERSION file`, 'green');

    // Update package.json
    if (existsSync(PACKAGE_JSON)) {
        const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8'));
        pkg.version = version;
        writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
        log(`✓ Updated package.json`, 'green');
    }
}

async function createGitTag(version: string, message?: string): Promise<void> {
    const { execSync } = await import('child_process');
    const tagName = `v${version}`;
    const tagMessage = message || `Release v${version}`;

    try {
        // Check if tag exists
        execSync(`git rev-parse ${tagName}`, { stdio: 'ignore' });
        log(`Error: Tag ${tagName} already exists`, 'red');
        process.exit(1);
    } catch {
        // Tag doesn't exist, create it
        execSync(`git tag -a ${tagName} -m "${tagMessage}"`, { stdio: 'inherit' });
        log(`✓ Created tag ${tagName}`, 'green');
        log(`ℹ  Push with: git push origin ${tagName}`, 'blue');
    }
}

async function createRelease(bumpType: 'major' | 'minor' | 'patch'): Promise<void> {
    const currentVersion = getCurrentVersion();
    const newVersion = bumpVersion(currentVersion, bumpType);

    log('════════════════════════════════════════════════', 'blue');
    log('  Dotfiles Release Process', 'blue');
    log('════════════════════════════════════════════════', 'blue');
    log(`Current version: ${currentVersion}`, 'green');
    log(`New version:     ${newVersion}`, 'green');
    console.log('');

    // In interactive mode, you'd prompt here
    // For now, we'll proceed automatically

    // Check for uncommitted changes
    const { execSync } = await import('child_process');
    try {
        execSync('git diff-index --quiet HEAD --', { stdio: 'ignore' });
    } catch {
        log('⚠  Warning: You have uncommitted changes', 'yellow');
    }

    // Update version
    updateVersion(newVersion);

    // Commit version changes
    try {
        execSync('git add VERSION opentui-setup/package.json', { stdio: 'inherit' });
        execSync(`git commit -m "chore: bump version to ${newVersion}"`, { stdio: 'inherit' });
    } catch {
        log('ℹ  No changes to commit or commit failed', 'blue');
    }

    // Create tag
    await createGitTag(newVersion);

    console.log('');
    log('════════════════════════════════════════════════', 'green');
    log(`  Release v${newVersion} created successfully!`, 'green');
    log('════════════════════════════════════════════════', 'green');
    console.log('');
    log('Next steps:', 'cyan');
    log('  1. Review changes: git log', 'blue');
    log('  2. Push commits:   git push', 'blue');
    log(`  3. Push tag:       git push origin v${newVersion}`, 'blue');
    log(`  4. Create release: gh release create v${newVersion}`, 'blue');
}

// Main
const command = process.argv[2];
const arg = process.argv[3];

try {
    switch (command) {
        case 'current':
            console.log(getCurrentVersion());
            break;

        case 'bump':
            if (!arg || !['major', 'minor', 'patch'].includes(arg)) {
                log('Error: Bump type required (major|minor|patch)', 'red');
                process.exit(1);
            }
            console.log(bumpVersion(getCurrentVersion(), arg as 'major' | 'minor' | 'patch'));
            break;

        case 'update':
            if (!arg) {
                log('Error: Version required', 'red');
                process.exit(1);
            }
            updateVersion(arg);
            break;

        case 'tag':
            await createGitTag(arg || getCurrentVersion());
            break;

        case 'release':
            if (!arg || !['major', 'minor', 'patch'].includes(arg)) {
                log('Error: Bump type required (major|minor|patch)', 'red');
                log('Usage: bun run scripts/version-manager.ts release [major|minor|patch]', 'blue');
                process.exit(1);
            }
            await createRelease(arg as 'major' | 'minor' | 'patch');
            break;

        default:
            log('Dotfiles Version Manager', 'blue');
            console.log('');
            log('Usage: bun run scripts/version-manager.ts [command] [options]', 'cyan');
            console.log('');
            log('Commands:', 'cyan');
            log('  current              Show current version', 'blue');
            log('  bump [type]         Calculate new version (major|minor|patch)', 'blue');
            log('  update [version]     Update version in all files', 'blue');
            log('  tag [version]       Create git tag (uses current version if not specified)', 'blue');
            log('  release [type]       Full release: bump, update, commit, tag', 'blue');
            console.log('');
            log('Examples:', 'cyan');
            log('  bun run scripts/version-manager.ts current', 'blue');
            log('  bun run scripts/version-manager.ts bump patch', 'blue');
            log('  bun run scripts/version-manager.ts release minor', 'blue');
            console.log('');
            process.exit(1);
    }
} catch (error) {
    log(`Error: ${error instanceof Error ? error.message : String(error)}`, 'red');
    process.exit(1);
}
