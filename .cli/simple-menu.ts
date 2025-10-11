#!/usr/bin/env bun

import { readdirSync, statSync, lstatSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join, basename, resolve } from 'path';
import { spawnSync, spawn } from 'child_process';
import readline from 'readline';

type TItemType = 'bin' | 'script' | 'alias' | 'function';

type TItem = {
    id: string;
    type: TItemType;
    name: string;
    path?: string;
    aliases?: string[];
    target?: string;
    doc?: string;
};

type TConfig = {
    layout: 'single' | 'double';
    banner: 'classic' | 'new' | 'none';
    includeAliases: boolean;
    includeFunctions: boolean;
    groupAliases: boolean;
    preferBinOverScripts: boolean;
    fzfHeight: string;
};

type TExecResult = {
    code: number;
    stdout: string;
    stderr: string;
};

function loadConfig(dotfilesRoot: string): TConfig {
    const cfgPath = join(dotfilesRoot, '.dotfiles-cli.json');
    const defaults: TConfig = {
        layout: 'double',
        banner: 'classic',
        includeAliases: true,
        includeFunctions: true,
        groupAliases: true,
        preferBinOverScripts: true,
        fzfHeight: '85%'
    };
    if (!existsSync(cfgPath)) return defaults;
    try {
        const raw = readFileSync(cfgPath, 'utf8');
        const parsed = JSON.parse(raw);
        return { ...defaults, ...parsed } as TConfig;
    } catch {
        return defaults;
    }
}

function saveConfig(dotfilesRoot: string, cfg: TConfig) {
    const cfgPath = join(dotfilesRoot, '.dotfiles-cli.json');
    writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
}

function clearScreen() {
    process.stdout.write('\x1B[2J\x1B[0f');
}

function bannerClassic(): string {
    return [
        '    ██████╗  ██████╗ ████████╗███████╗██╗██╗     ███████╗███████╗',
        '    ██╔══██╗██╔═══██╗╚══██╔══╝██╔════╝██║██║     ██╔════╝██╔════╝',
        '    ██║  ██║██║   ██║   ██║   █████╗  ██║██║     █████╗  ███████╗',
        '    ██║  ██║██║   ██║   ██║   ██╔══╝  ██║██║     ██╔══╝  ╚════██║',
        '    ██████╔╝╚██████╔╝   ██║   ██║     ██║███████╗███████╗███████║',
        '    ╚═════╝  ╚═════╝    ╚═╝   ╚═╝     ╚═╝╚══════╝╚══════╝╚══════╝'
    ].join('\n');
}

function bannerNew(): string {
    return [
        '╔══════════════════════════════════════════════════════════════════════╗',
        '║  DOTFILES ▸ Overview ▸ fzf                                           ║',
        '╚══════════════════════════════════════════════════════════════════════╝'
    ].join('\n');
}

function showBanner(cfg: TConfig) {
    if (cfg.banner === 'none') return;
    console.log('\x1b[36m');
    console.log(cfg.banner === 'classic' ? bannerClassic() : bannerNew());
    console.log('\x1b[0m');
}

function isExecutable(mode: number): boolean {
    return (mode & 0o111) !== 0;
}

function uniqueId(parts: string[]): string {
    return parts.join('::');
}

function collectExecutables(dotfilesRoot: string, cfg: TConfig): TItem[] {
    const items: TItem[] = [];
    const byName = new Map<string, TItem>();
    const roots = ['bin', 'scripts'];
    for (const rel of roots) {
        const dir = join(dotfilesRoot, rel);
        if (!existsSync(dir)) continue;
        let files: string[] = [];
        try {
            files = readdirSync(dir);
        } catch {
            files = [];
        }
        for (const f of files) {
            const p = join(dir, f);
            try {
                const lst = lstatSync(p);
                const st = statSync(p);
                const name = basename(f);
                if (name === 'dotfiles' || name === 'dotfiles.old.fish' || name === 'simple-menu.ts') continue;
                const isFileOrLink = lst.isFile() || lst.isSymbolicLink();
                const isUsable = (st.isFile() && isExecutable(st.mode)) || st.isDirectory();
                if (!isFileOrLink || !isUsable) continue;
                const type: TItemType = rel === 'bin' ? 'bin' : 'script';
                const candidate: TItem = { id: uniqueId([type, name, p]), type, name, path: p };
                const existing = byName.get(name);
                if (!existing) {
                    byName.set(name, candidate);
                } else {
                    if (cfg.preferBinOverScripts && existing.type !== 'bin' && type === 'bin') {
                        byName.set(name, candidate);
                    }
                }
            } catch {
                continue;
            }
        }
    }
    for (const v of byName.values()) items.push(v);
    function compareByName(a: TItem, b: TItem): number {
        return a.name.localeCompare(b.name);
    }
    items.sort(compareByName);
    return items;
}

function readLines(path: string): string[] {
    try {
        const raw = readFileSync(path, 'utf8');
        return raw.split(/\r?\n/);
    } catch {
        return [];
    }
}

function collectFishAliasFiles(dotfilesRoot: string): string[] {
    const paths: string[] = [];
    const candidates = [
        join(dotfilesRoot, 'configs', 'fish', 'aliases'),
        join(dotfilesRoot, 'fish', 'aliases')
    ];
    for (const dir of candidates) {
        if (!existsSync(dir)) continue;
        let files: string[] = [];
        try {
            files = readdirSync(dir).filter(x => x.endsWith('.fish'));
        } catch {
            files = [];
        }
        for (const f of files) paths.push(join(dir, f));
    }
    return paths;
}

function collectFishFunctionFiles(dotfilesRoot: string): string[] {
    const paths: string[] = [];
    const candidates = [
        join(dotfilesRoot, 'configs', 'fish', 'functions'),
        join(dotfilesRoot, 'fish', 'functions')
    ];
    for (const dir of candidates) {
        if (!existsSync(dir)) continue;
        let files: string[] = [];
        try {
            files = readdirSync(dir).filter(x => x.endsWith('.fish'));
        } catch {
            files = [];
        }
        for (const f of files) paths.push(join(dir, f));
    }
    return paths;
}

function parseAliasLine(line: string): { name: string; target: string } | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith('alias ')) return null;
    const restRaw = trimmed.slice(6).trim();
    const rest = restRaw.split('#')[0].trim();
    if (rest.includes('=')) {
        const name = rest.split('=')[0].trim();
        const target = rest.split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        return { name, target };
    }
    const parts = rest.split(/\s+/);
    if (parts.length >= 2) {
        const name = parts[0];
        const target = parts.slice(1).join(' ').trim().replace(/^['"]|['"]$/g, '');
        return { name, target };
    }
    return null;
}

function detectFunctionTarget(body: string[]): string | undefined {
    for (const ln of body) {
        const t = ln.trim();
        if (!t || t.startsWith('#')) continue;
        if (t.startsWith('set ') || t.startsWith('if ') || t.startsWith('for ') || t.startsWith('switch ')) continue;
        const tok = t.split(/\s+/)[0];
        if (tok && !['function', 'end'].includes(tok)) return tok;
    }
    return undefined;
}

function isBuiltinFishTarget(cmd: string | undefined): boolean {
    if (!cmd) return false;
    const builtins = new Set([
        'set', 'set_color', 'echo', 'printf', 'cd', 'case', 'eval', 'source', 'exec',
        'end', 'read', 'string', 'math', 'if', 'for', 'while', 'switch', 'command'
    ]);
    return builtins.has(cmd);
}

function primaryToken(s: string | undefined): string | undefined {
    if (!s) return undefined;
    const t = s.trim().split(/\s+/)[0] || '';
    return t || undefined;
}

function collectAliasesAndFunctions(dotfilesRoot: string, cfg: TConfig): TItem[] {
    type TRow = { kind: 'alias' | 'function'; name: string; doc?: string; prog?: string };
    const aliasRows: TRow[] = [];
    const fnRows: TRow[] = [];

    if (cfg.includeAliases) {
        const aliasFiles = collectFishAliasFiles(dotfilesRoot);
        for (const file of aliasFiles) {
            const lines = readLines(file);
            let currentDoc = '';
            let inFn = false;
            let fnName = '';
            const body: string[] = [];
            for (const line of lines) {
                if (line.includes('# NO DOCSTRING:')) { currentDoc = ''; continue; }
                if (line.includes('# DOCSTRING:')) { currentDoc = line.replace('# DOCSTRING:', '').trim(); continue; }
                if (line.trim().startsWith('alias ')) {
                    const parsed = parseAliasLine(line);
                    if (!parsed) continue;
                    const prog = primaryToken(parsed.target);
                    aliasRows.push({ kind: 'alias', name: parsed.name, doc: currentDoc || undefined, prog });
                    currentDoc = '';
                    continue;
                }
                if (!inFn && line.trim().startsWith('function ')) {
                    inFn = true;
                    fnName = (line.trim().split(/\s+/)[1] || '').trim();
                    body.length = 0;
                    continue;
                }
                if (inFn && line.trim() === 'end') {
                    const prog = primaryToken(detectFunctionTarget(body));
                    const isInternal = fnName.startsWith('_') || fnName === 'fish_prompt';
                    if (!isInternal) fnRows.push({ kind: 'function', name: fnName, doc: currentDoc || undefined, prog });
                    inFn = false; fnName = ''; currentDoc = '';
                    continue;
                }
                if (inFn) body.push(line);
            }
        }
    }

    if (cfg.includeFunctions) {
        const fnFiles = collectFishFunctionFiles(dotfilesRoot);
        for (const file of fnFiles) {
            const lines = readLines(file);
            let currentDoc = '';
            let inFn = false;
            let fnName = '';
            const body: string[] = [];
            for (const line of lines) {
                if (line.includes('# NO DOCSTRING:')) { currentDoc = ''; continue; }
                if (line.includes('# DOCSTRING:')) { currentDoc = line.replace('# DOCSTRING:', '').trim(); continue; }
                if (!inFn && line.trim().startsWith('function ')) {
                    inFn = true;
                    fnName = (line.trim().split(/\s+/)[1] || '').trim();
                    body.length = 0;
                    continue;
                }
                if (inFn && line.trim() === 'end') {
                    const prog = primaryToken(detectFunctionTarget(body));
                    // Exclude internal helpers by convention
                    const isInternal = fnName.startsWith('_') || fnName === 'fish_prompt';
                    if (!isInternal) fnRows.push({ kind: 'function', name: fnName, doc: currentDoc || undefined, prog });
                    inFn = false; fnName = ''; currentDoc = '';
                    continue;
                }
                if (inFn) body.push(line);
            }
        }
    }

    const items: TItem[] = [];

    if (cfg.groupAliases) {
        const byProg = new Map<string, { names: Set<string>; doc?: string }>();
        function addToGroup(row: TRow) {
            if (!row.prog || isBuiltinFishTarget(row.prog)) return;
            if (row.prog.startsWith('_')) return;
            if (row.prog.startsWith('$')) return;
            const g = byProg.get(row.prog) || { names: new Set<string>(), doc: undefined };
            g.names.add(row.name);
            if (!g.doc && row.doc) g.doc = row.doc;
            byProg.set(row.prog, g);
        }
        for (const r of aliasRows) addToGroup(r);
        for (const r of fnRows) addToGroup(r);
        function toItem(prog: string, g: { names: Set<string>; doc?: string }): TItem {
            const names = Array.from(g.names).sort(function compare(a, b) { return a.localeCompare(b); });
            const nameJoined = names.join(',');
            return { id: uniqueId(['alias-group', nameJoined, prog]), type: 'alias', name: nameJoined, target: prog, doc: g.doc };
        }
        for (const [prog, g] of byProg.entries()) items.push(toItem(prog, g));

        // Add standalone function rows without an external program target
        for (const r of fnRows) {
            if (!r.prog || isBuiltinFishTarget(r.prog)) {
                items.push({ id: uniqueId(['function', r.name]), type: 'function', name: r.name, doc: r.doc });
            }
        }
        // Add standalone aliases that didn't resolve to external program
        for (const r of aliasRows) {
            if (!r.prog || isBuiltinFishTarget(r.prog)) {
                items.push({ id: uniqueId(['alias', r.name]), type: 'alias', name: r.name, doc: r.doc });
            }
        }
    } else {
        for (const r of aliasRows) {
            items.push({ id: uniqueId(['alias', r.name]), type: 'alias', name: r.name, target: r.prog, doc: r.doc });
        }
        for (const r of fnRows) {
            items.push({ id: uniqueId(['function', r.name]), type: 'function', name: r.name, target: r.prog, doc: r.doc });
        }
    }

    function compareByName(a: TItem, b: TItem): number { return a.name.localeCompare(b.name); }
    items.sort(compareByName);
    return items;
}

function tryRunHelp(pathOrCmd: string): string {
    if (pathOrCmd.endsWith('.ts') || pathOrCmd.endsWith('.py')) return '';
    const candidates = [['--help'], ['-h'], ['help']];
    for (const args of candidates) {
        try {
            const res = spawnSync(pathOrCmd, args, { encoding: 'utf8', shell: false, timeout: 1200, stdio: ['ignore', 'pipe', 'ignore'] });
            if (typeof res.status === 'number' && res.status >= 0) {
                const out = `${res.stdout || ''}`.trim();
                if (out && !out.includes('Syntax error')) return out.slice(0, 4000);
            }
        } catch {
            continue;
        }
    }
    return '';
}

function formatLabel(item: TItem): string {
    if (item.type === 'alias') {
        const label = `[alias] ${item.name}`;
        if (item.target) return `${label} → ${item.target}`;
        return label;
    }
    if (item.type === 'function') {
        return `[fn] ${item.name}`;
    }
    if (item.type === 'bin') return `[bin] ${item.name}`;
    return `[script] ${item.name}`;
}

function formatLabelColored(item: TItem): string {
    const c = colors();
    if (item.type === 'alias') {
        const badge = `${c.blue}[alias]${c.reset}`;
        const name = `${c.bright}${item.name}${c.reset}`;
        if (item.target) {
            return `${badge} ${name} ${c.dim}→${c.reset} ${c.cyan}${item.target}${c.reset}`;
        }
        return `${badge} ${name}`;
    }
    if (item.type === 'function') {
        return `${c.magenta}[fn]${c.reset} ${c.bright}${item.name}${c.reset}`;
    }
    if (item.type === 'bin') {
        return `${c.green}[bin]${c.reset} ${c.bright}${item.name}${c.reset}`;
    }
    return `${c.yellow}[script]${c.reset} ${c.bright}${item.name}${c.reset}`;
}

function encodePayload(item: TItem): string {
    const json = JSON.stringify(item);
    const b64 = Buffer.from(json, 'utf8').toString('base64');
    return b64;
}

function decodePayload(b64: string): TItem | null {
    try {
        const json = Buffer.from(b64, 'base64').toString('utf8');
        return JSON.parse(json) as TItem;
    } catch {
        return null;
    }
}

function haveFzf(): boolean {
    try {
        const res = spawnSync('fzf', ['--version'], { encoding: 'utf8' });
        return typeof res.status === 'number' && res.status === 0;
    } catch {
        return false;
    }
}

function buildFzfInput(items: TItem[]): string {
    const lines: string[] = [];
    function pushLine(it: TItem) {
        const label = formatLabel(it);
        const payload = encodePayload(it);
        lines.push(`${label}\t${payload}`);
    }
    for (const it of items) pushLine(it);
    return lines.join('\n');
}

function runFzf(dotfilesRoot: string, cfg: TConfig, items: TItem[]): Promise<TItem | null> {
    return new Promise<TItem | null>((resolveSel) => {
        const input = buildFzfInput(items);
        const scriptPath = process.argv[1];
        const previewCmd = scriptPath.endsWith('.ts') ? `bun '${scriptPath}' __preview --encoded {2}` : `'${scriptPath}' __preview --encoded {2}`;
        const execOnEnter = scriptPath.endsWith('.ts') ? `bun '${scriptPath}' run --encoded {2}` : `'${scriptPath}' run --encoded {2}`;
        const args: string[] = [
            '--ansi',
            '--delimiter', '\t',
            '--with-nth', '1',
            '--height', cfg.fzfHeight,
            '--reverse',
            '--bind', `enter:execute(${execOnEnter})+accept`
        ];
        if (cfg.layout === 'double') {
            args.push('--preview', previewCmd);
            args.push('--preview-window', 'right:55%');
        }
        const banner = cfg.banner === 'none' ? '' : (cfg.banner === 'classic' ? bannerClassic() : bannerNew());
        if (banner) args.push('--header', banner.replace(/\n/g, '\\n'));
        const child = spawn('fzf', args, { stdio: ['pipe', 'pipe', 'pipe'] });
        child.stdin.write(input);
        child.stdin.end();
        let sel = '';
        function onStdoutData(chunk: Buffer) {
            sel += chunk.toString('utf8');
        }
        function onExit() {
            const line = sel.trim();
            if (!line) return resolveSel(null);
            const parts = line.split('\t');
            const payload = parts[1] || '';
            const item = decodePayload(payload);
            resolveSel(item);
        }
        child.stdout.on('data', onStdoutData as any);
        child.on('exit', onExit);
    });
}

function fallbackArrowMenu(items: TItem[]): Promise<TItem | null> {
    return new Promise<TItem | null>((resolveSel) => {
        if (items.length === 0) return resolveSel(null);
        let idx = 0;
        readline.emitKeypressEvents(process.stdin);
        process.stdin.setRawMode(true);
        function redraw() {
            clearScreen();
            console.log('\x1b[33mSelect an item:\x1b[0m\n');
            for (let i = 0; i < items.length; i++) {
                const label = formatLabel(items[i]);
                if (i === idx) console.log(`\x1b[32;1m-> ${label}\x1b[0m`); else console.log(`   ${label}`);
            }
            console.log('\n\x1b[90mUse arrow keys to navigate, Enter to select, q to quit\x1b[0m');
        }
        redraw();
        function onKey(str: string, key: any) {
            if (!key) return;
            if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
                process.stdin.setRawMode(false);
                resolveSel(null);
            } else if (key.name === 'up') {
                idx = idx > 0 ? idx - 1 : items.length - 1;
                redraw();
            } else if (key.name === 'down') {
                idx = idx < items.length - 1 ? idx + 1 : 0;
                redraw();
            } else if (key.name === 'return') {
                process.stdin.setRawMode(false);
                resolveSel(items[idx]);
            }
        }
        process.stdin.on('keypress', onKey as any);
    });
}

function showPreview(item: TItem): string {
    if (item.type === 'alias') {
        const header = item.doc ? item.doc : 'Aliases';
        const target = item.target ? `Target: ${item.target}` : '';
        return [header, target].filter(Boolean).join('\n');
    }
    if (item.type === 'function') {
        return item.doc ? item.doc : `[fn] ${item.name}`;
    }
    const pathOrCmd = item.path || item.name;
    const out = tryRunHelp(pathOrCmd);
    if (out) return out;
    return `${formatLabel(item)}\nNo help detected via --help/-h/help.`;
}

function runItem(item: TItem): Promise<number> {
    return new Promise<number>((resolveCode) => {
        if (item.type === 'alias' || item.type === 'function') {
            const primary = item.name.split(',')[0];
            const cmd = `fish -c ${JSON.stringify(primary)}`;
            const child = spawn(cmd, { stdio: 'inherit', shell: true } as any);
            child.on('exit', function onExit(code) { resolveCode((code as number) || 0); });
            return;
        }
        const cmd = item.path || item.name;
        const child = spawn(cmd, [], { stdio: 'inherit', shell: true });
        child.on('exit', (code) => resolveCode(code || 0));
    });
}

type TColor = {
    reset: string;
    bright: string;
    dim: string;
    cyan: string;
    blue: string;
    green: string;
    yellow: string;
    magenta: string;
    red: string;
    gray: string;
};

function colors(): TColor {
    return {
        reset: '\x1b[0m',
        bright: '\x1b[1m',
        dim: '\x1b[2m',
        cyan: '\x1b[36m',
        blue: '\x1b[34m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        magenta: '\x1b[35m',
        red: '\x1b[31m',
        gray: '\x1b[90m'
    };
}

function printUsage() {
    const c = colors();
    console.log('');
    console.log(`${c.bright}${c.cyan}╔════════════════════════════════════════════════════════════════╗${c.reset}`);
    console.log(`${c.bright}${c.cyan}║${c.reset}  ${c.bright}DOTFILES CLI${c.reset} ${c.dim}- Manage your dotfiles, scripts & aliases${c.reset}  ${c.bright}${c.cyan}║${c.reset}`);
    console.log(`${c.bright}${c.cyan}╚════════════════════════════════════════════════════════════════╝${c.reset}`);
    console.log('');
    console.log(`${c.bright}${c.yellow}USAGE${c.reset}`);
    console.log(`  ${c.green}dotfiles${c.reset} ${c.dim}[command] [options]${c.reset}`);
    console.log('');
    console.log(`${c.bright}${c.yellow}COMMANDS${c.reset}`);
    console.log(`  ${c.bright}${c.green}interactive${c.reset}, ${c.green}i${c.reset}        Launch interactive fzf picker`);
    console.log(`  ${c.bright}${c.green}list${c.reset}                  List all available items`);
    console.log(`  ${c.bright}${c.green}search${c.reset} ${c.cyan}<term>${c.reset}         Search for items matching ${c.cyan}<term>${c.reset}`);
    console.log(`  ${c.bright}${c.green}run${c.reset} ${c.cyan}<name>${c.reset}            Execute item by ${c.cyan}<name>${c.reset}`);
    console.log(`  ${c.bright}${c.green}help${c.reset} ${c.cyan}<name>${c.reset}           Show help for ${c.cyan}<name>${c.reset}`);
    console.log(`  ${c.bright}${c.green}config${c.reset} ${c.cyan}show${c.reset}           Display current configuration`);
    console.log(`  ${c.bright}${c.green}config set${c.reset} ${c.cyan}<key> <val>${c.reset} Update config ${c.cyan}<key>${c.reset} to ${c.cyan}<val>${c.reset}`);
    console.log('');
    console.log(`${c.bright}${c.yellow}CONFIG SHORTCUTS${c.reset}`);
    console.log(`  ${c.bright}${c.green}config banner${c.reset} ${c.dim}[classic|new|none]${c.reset}`);
    console.log(`  ${c.bright}${c.green}config layout${c.reset} ${c.dim}[single|double]${c.reset}`);
    console.log('');
    console.log(`${c.dim}Run ${c.bright}dotfiles interactive${c.reset}${c.dim} to browse all items interactively${c.reset}`);
    console.log('');
}

function buildIndex(dotfilesRoot: string, cfg: TConfig): TItem[] {
    const execs = collectExecutables(dotfilesRoot, cfg);
    const aliasFn = collectAliasesAndFunctions(dotfilesRoot, cfg);
    const all = [...execs, ...aliasFn];
    function compareByName(a: TItem, b: TItem): number {
        return a.name.localeCompare(b.name);
    }
    all.sort(compareByName);
    return all;
}

async function main() {
    const dotfilesRoot = join(process.env.HOME!, '.config', 'dotfiles');
    const cfg = loadConfig(dotfilesRoot);
    const args = process.argv.slice(2);
    if (args.length === 0) {
        printUsage();
        process.exit(0);
    }
    if (args[0] === 'interactive' || args[0] === 'i') {
        const items = buildIndex(dotfilesRoot, cfg);
        if (haveFzf()) {
            const sel = await runFzf(dotfilesRoot, cfg, items);
            if (sel) {
                const code = await runItem(sel);
                process.exit(code);
            }
            process.exit(0);
        } else {
            const sel = await fallbackArrowMenu(items);
            if (sel) {
                const code = await runItem(sel);
                process.exit(code);
            }
            process.exit(0);
        }
    }
    if (args[0] === '--help' || args[0] === '-h') {
        printUsage();
        process.exit(0);
    }
    if (args[0] === '--scripts' || args[0] === '--s') {
        const { spawn } = require('child_process');
        const scriptsPath = join(dotfilesRoot, 'bin', 'scripts');
        const child = spawn(scriptsPath, args.slice(1), { stdio: 'inherit' });
        child.on('exit', (code: number) => process.exit(code || 0));
        return;
    }
    if (args[0] === '__preview') {
        const encodedIdx = args.indexOf('--encoded');
        if (encodedIdx >= 0 && args[encodedIdx + 1]) {
            const item = decodePayload(args[encodedIdx + 1]);
            if (item) {
                const out = showPreview(item);
                console.log(out);
                process.exit(0);
            }
        }
        process.exit(1);
    }
    if (args[0] === 'list') {
        const c = colors();
        const items = buildIndex(dotfilesRoot, cfg);
        console.log('');
        console.log(`${c.bright}${c.cyan}Available Items:${c.reset} ${c.dim}(${items.length} total)${c.reset}`);
        console.log('');
        for (const it of items) console.log(`  ${formatLabelColored(it)}`);
        console.log('');
        process.exit(0);
    }
    if (args[0] === 'search') {
        const c = colors();
        const q = args.slice(1).join(' ').toLowerCase();
        const all = buildIndex(dotfilesRoot, cfg);
        function match(it: TItem): boolean {
            return formatLabel(it).toLowerCase().includes(q);
        }
        const items = all.filter(match);
        console.log('');
        console.log(`${c.bright}${c.cyan}Search Results for "${c.yellow}${q}${c.cyan}":${c.reset} ${c.dim}(${items.length} found)${c.reset}`);
        console.log('');
        if (items.length === 0) {
            console.log(`  ${c.dim}No items found matching "${q}"${c.reset}`);
        } else {
            for (const it of items) console.log(`  ${formatLabelColored(it)}`);
        }
        console.log('');
        process.exit(0);
    }
    if (args[0] === 'help') {
        const c = colors();
        const name = args.slice(1).join(' ');
        if (!name) {
            printUsage();
            process.exit(0);
        }
        const items = buildIndex(dotfilesRoot, cfg);
        function matches(it: TItem): boolean {
            const parts = it.name.split(',');
            for (let i = 0; i < parts.length; i++) if (parts[i] === name) return true;
            return it.name === name;
        }
        const found = items.find(matches);
        if (!found) {
            console.log('');
            console.log(`${c.red}✗${c.reset} ${c.bright}Not found:${c.reset} ${name}`);
            console.log('');
            process.exit(1);
        }
        console.log('');
        console.log(`${c.bright}${c.cyan}Help for:${c.reset} ${formatLabelColored(found)}`);
        console.log('');
        const preview = showPreview(found);
        if (preview) {
            console.log(preview);
        } else {
            console.log(`${c.dim}No help available for this item${c.reset}`);
        }
        console.log('');
        process.exit(0);
    }
    if (args[0] === 'run') {
        const encodedIdx = args.indexOf('--encoded');
        if (encodedIdx >= 0 && args[encodedIdx + 1]) {
            const item = decodePayload(args[encodedIdx + 1]);
            if (item) {
                const code = await runItem(item);
                process.exit(code);
            }
            process.exit(1);
        }
        const name = args.slice(1).join(' ');
        if (!name) {
            printUsage();
            process.exit(1);
        }
        const items = buildIndex(dotfilesRoot, cfg);
        function matches(it: TItem): boolean {
            const parts = it.name.split(',');
            for (let i = 0; i < parts.length; i++) if (parts[i] === name) return true;
            return it.name === name;
        }
        const found = items.find(matches);
        if (!found) {
            const c = colors();
            console.log('');
            console.log(`${c.red}✗${c.reset} ${c.bright}Not found:${c.reset} ${name}`);
            console.log('');
            process.exit(1);
        }
        const code = await runItem(found);
        process.exit(code);
    }
    if (args[0] === 'config') {
        if (args[1] === 'show') {
            console.log(JSON.stringify(cfg, null, 2));
            process.exit(0);
        }
        if (args[1] === 'set') {
            const c = colors();
            const key = args[2];
            const value = args[3];
            if (!key) {
                printUsage();
                process.exit(1);
            }
            const next = { ...cfg } as any;
            let v: any = value;
            if (value === 'true') v = true; else if (value === 'false') v = false;
            next[key] = v;
            saveConfig(dotfilesRoot, next as TConfig);
            console.log('');
            console.log(`${c.green}✓${c.reset} ${c.bright}Config updated:${c.reset} ${c.cyan}${key}${c.reset} = ${c.yellow}${v}${c.reset}`);
            console.log('');
            process.exit(0);
        }
        if (args[1] === 'banner') {
            const c = colors();
            const v = args[2] as TConfig['banner'];
            const next = { ...cfg, banner: v };
            saveConfig(dotfilesRoot, next);
            console.log('');
            console.log(`${c.green}✓${c.reset} ${c.bright}Banner updated:${c.reset} ${c.yellow}${v}${c.reset}`);
            console.log('');
            process.exit(0);
        }
        if (args[1] === 'layout') {
            const c = colors();
            const v = args[2] as TConfig['layout'];
            const next = { ...cfg, layout: v };
            saveConfig(dotfilesRoot, next);
            console.log('');
            console.log(`${c.green}✓${c.reset} ${c.bright}Layout updated:${c.reset} ${c.yellow}${v}${c.reset}`);
            console.log('');
            process.exit(0);
        }
        printUsage();
        process.exit(1);
    }
    printUsage();
    process.exit(1);
}

main().catch(function onErr(err) {
    console.error('Error:', err);
    process.exit(1);
});
