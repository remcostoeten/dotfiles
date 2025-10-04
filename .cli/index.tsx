#!/usr/bin/env bun

import React, { useState } from 'react';
import { render, Text, Box, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { spawn } from 'child_process';
import { readdir, stat } from 'fs/promises';
import { join, basename } from 'path';

type TMenuItem = {
    label: string;
    value: string;
};

type TProps = {
    dotfilesRoot: string;
};

function DotfilesMenu({ dotfilesRoot }: TProps) {
    const { exit } = useApp();
    const [menuItems, setMenuItems] = useState<TMenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useInput((input, key) => {
        if (input === 'q' || (key.ctrl && input === 'c')) {
            exit();
        }
    });

    React.useEffect(() => {
        async function loadScripts() {
            try {
                const items: TMenuItem[] = [];
                const dirs = ['bin', 'scripts'];
                
                for (const dir of dirs) {
                    const fullPath = join(dotfilesRoot, dir);
                    try {
                        const files = await readdir(fullPath);
                        
                        for (const file of files) {
                            const filePath = join(fullPath, file);
                            const stats = await stat(filePath);
                            
                            if (stats.isFile() && (stats.mode & 0o111) !== 0) {
                                const name = basename(file);
                                const alreadyExists = items.find(item => item.label === name);
                                
                                if (!alreadyExists) {
                                    items.push({
                                        label: name,
                                        value: filePath
                                    });
                                }
                            }
                        }
                    } catch (err) {
                        continue;
                    }
                }
                
                items.sort((a, b) => a.label.localeCompare(b.label));
                setMenuItems(items);
                setLoading(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
                setLoading(false);
            }
        }
        
        loadScripts();
    }, [dotfilesRoot]);

    function handleSelect(item: TMenuItem) {
        runScript(item.value);
    }

    function runScript(scriptPath: string) {
        const child = spawn(scriptPath, [], {
            stdio: 'inherit',
            shell: true
        });
        
        child.on('exit', (code) => {
            exit();
        });
    }

    if (loading) {
        return <Text color="yellow">Loading scripts...</Text>;
    }

    if (error) {
        return <Text color="red">Error: {error}</Text>;
    }

    if (menuItems.length === 0) {
        return <Text color="red">No executable scripts found in bin/ or scripts/</Text>;
    }

    return (
        <Box flexDirection="column">
            <Box marginBottom={1}>
                <Text color="cyan" bold>
                    {`
    ██████╗  ██████╗ ████████╗███████╗██╗██╗     ███████╗███████╗
    ██╔══██╗██╔═══██╗╚══██╔══╝██╔════╝██║██║     ██╔════╝██╔════╝
    ██║  ██║██║   ██║   ██║   █████╗  ██║██║     █████╗  ███████╗
    ██║  ██║██║   ██║   ██║   ██╔══╝  ██║██║     ██╔══╝  ╚════██║
    ██████╔╝╚██████╔╝   ██║   ██║     ██║███████╗███████╗███████║
    ╚═════╝  ╚═════╝    ╚═╝   ╚═╝     ╚═╝╚══════╝╚══════╝╚══════╝`}
                </Text>
            </Box>
            
            <Box marginBottom={1}>
                <Text color="yellow">Select a script to run:</Text>
            </Box>
            
            <SelectInput items={menuItems} onSelect={handleSelect} />
            
            <Box marginTop={1}>
                <Text color="gray">Use arrow keys to navigate, Enter to select, 'q' to quit</Text>
            </Box>
        </Box>
    );
}

const dotfilesRoot = process.env.DOTFILES_DIR || join(process.env.HOME!, '.config', 'dotfiles');

render(<DotfilesMenu dotfilesRoot={dotfilesRoot} />);