#!/usr/bin/env bun
export interface TypoMapping {
    correctCommand: string;
    commonTypos: string[];
    levenshteinThreshold?: number;
    minWordLength?: number;
    description?: string;
}

export interface TypoDetectorConfig {
    mappings: TypoMapping[];
    levenshteinThreshold?: number;
    minWordLength?: number;
}

export class TypoDetector {
    private config: TypoDetectorConfig;

    constructor(config: TypoDetectorConfig) {
        this.config = {
            levenshteinThreshold: 0.7, // 70% similarity
            minWordLength: 4,           // Minimum word length to check
            ...config
        };
    }

    // Levenshtein distance algorithm
    private levenshteinDistance(str1: string, str2: string): number {
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

    // Check if an input has any potential typos
    checkForTypos(input: string): { hasTypo: boolean; suggestions: Array<{command: string; confidence: number; description?: string}> } {
        const normalizedInput = input.toLowerCase().trim();
        const suggestions: Array<{command: string; confidence: number; description?: string}> = [];

        // Skip if input is too short
        if (normalizedInput.length < (this.config.minWordLength || 4)) {
            return { hasTypo: false, suggestions };
        }

        // Skip exact matches to any correct commands
        for (const mapping of this.config.mappings) {
            if (normalizedInput === mapping.correctCommand) {
                return { hasTypo: false, suggestions };
            }
        }

        // Check against all mappings
        for (const mapping of this.config.mappings) {
            let hasMatch = false;
            let confidence = 0;

            // Check exact typo dictionary
            if (mapping.commonTypos.includes(normalizedInput)) {
                hasMatch = true;
                confidence = 0.9; // High confidence for exact dictionary match
            } else {
                // Check fuzzy similarity with Levenshtein distance
                const distance = this.levenshteinDistance(normalizedInput, mapping.correctCommand);
                const maxLen = Math.max(normalizedInput.length, mapping.correctCommand.length);
                const similarity = 1 - (distance / maxLen);

                const threshold = mapping.levenshteinThreshold || this.config.levenshteinThreshold || 0.7;

                if (similarity >= threshold) {
                    hasMatch = true;
                    confidence = similarity;
                }
            }

            if (hasMatch) {
                suggestions.push({
                    command: mapping.correctCommand,
                    confidence,
                    description: mapping.description
                });
            }
        }

        // Sort by confidence (highest first) and limit to top 3 suggestions
        suggestions.sort((a, b) => b.confidence - a.confidence);
        return {
            hasTypo: suggestions.length > 0,
            suggestions: suggestions.slice(0, 3)
        };
    }

    // Get suggestions for a specific typo
    getSuggestions(input: string): Array<{command: string; confidence: number; description?: string}> {
        const result = this.checkForTypos(input);
        return result.suggestions;
    }
}

// Predefined typo mappings for common dotfiles commands
export const DOTFILES_TYPO_MAPPINGS: TypoMapping[] = [
    {
        correctCommand: 'display',
        commonTypos: [
            'disply', 'dislpay', 'dispay', 'diplay', 'dispaly',
            'dispay', 'disply', 'dipslay', 'dispaly', 'dislpay',
            'displya', 'displlay', 'displaaay', 'displey', 'displai',
            'displayy', 'displaya', 'desplay', 'dasplay', 'dysplay',
            'dyslpay', 'disp', 'displa', 'displ', 'displaay',
            'diisplay', 'dissplay', 'disssplay', 'displlay'
        ],
        description: 'Display management tool - control monitors, resolution, brightness'
    },
    {
        correctCommand: 'todo',
        commonTypos: [
            'tod', 'todd', 'tood', 'toodo', 'toddo',
            'todos', 'todolist', 'todu', 'toto', 'tofo'
        ],
        description: 'Task manager - interactive CLI todo list'
    },
    {
        correctCommand: 'scripts',
        commonTypos: [
            'script', 'scrips', 'scriptss', 'scriptts', 'scripst',
            'scritps', 'scrpts', 'scrips', 'sctripts'
        ],
        description: 'Script selector - interactive script selector'
    },
    {
        correctCommand: 'dotfiles',
        commonTypos: [
            'dotfile', 'dotfiles', 'dottiles', 'doptfiles',
            'dotfiels', 'dotfils', 'datfiles', 'dotflys'
        ],
        description: 'Dotfiles management system'
    },
    {
        correctCommand: 'ports',
        commonTypos: [
            'port', 'portt', 'poorts', 'portss', 'pors',
            'prts', 'podts', 'portsi'
        ],
        description: 'Port manager - view and kill processes by port'
    },
    {
        correctCommand: 'postgres',
        commonTypos: [
            'postgrs', 'postgre', 'postgress', 'postgrres',
            'postgrees', 'potsgres', 'postgre', 'postgrsql'
        ],
        description: 'PostgreSQL database management'
    },
    {
        correctCommand: 'create',
        commonTypos: [
            'creaet', 'cretae', 'cerate', 'creae', 'creatt',
            'creat', 'creaate', 'creet', 'creete'
        ],
        description: 'File creation utility - smart mkdir + touch helper'
    },
    {
        correctCommand: 'emoji',
        commonTypos: [
            'emoj', 'emoje', 'emogi', 'emojii', 'emjoi',
            'emojji', 'emmoji', 'enmoji', 'emojiz'
        ],
        description: 'Emoji picker script'
    },
    {
        correctCommand: 'clipboard',
        commonTypos: [
            'clipoard', 'clipbaord', 'clipbard', 'clipbord',
            'cliboard', 'clipbarrd', 'clipboad'
        ],
        description: 'Clipboard management tool'
    },
    {
        correctCommand: 'secret',
        commonTypos: [
            'secert', 'sercet', 'secre', 'secrt', 'secrect',
            'scret', 'secertt', 'secreet'
        ],
        description: 'Secret management utility'
    }
];

// Create default typo detector instance
export const defaultTypoDetector = new TypoDetector({
    mappings: DOTFILES_TYPO_MAPPINGS,
    levenshteinThreshold: 0.7,
    minWordLength: 3
});

// Helper function to check typos and get user confirmation
export async function handleTypoSuggestions(
    input: string,
    detector: TypoDetector = defaultTypoDetector
): Promise<{shouldContinue: boolean; correctedCommand?: string}> {
    const result = detector.checkForTypos(input);

    if (!result.hasTypo) {
        return { shouldContinue: false };
    }

    const topSuggestion = result.suggestions[0];
    if (!topSuggestion) {
        return { shouldContinue: false };
    }

    // For very high confidence (>= 0.85), auto-correct
    if (topSuggestion.confidence >= 0.85) {
        return {
            shouldContinue: true,
            correctedCommand: topSuggestion.command
        };
    }

    // For lower confidence, ask user
    const { createInterface } = require('readline');
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        const suggestionText = topSuggestion.suggestions?.length > 1
            ? `\nSuggestions:\n${result.suggestions.map((s, i) => `  ${i + 1}. ${s.command} (${Math.round(s.confidence * 100)}% match)`).join('\n')}`
            : `Did you mean "${topSuggestion.command}" instead of "${input}"?`;

        rl.question(`${suggestionText} (Y/n): `, (answer: string) => {
            rl.close();
            const normalizedAnswer = answer.trim().toLowerCase();

            if (normalizedAnswer === '' || normalizedAnswer === 'y' || normalizedAnswer === 'yes') {
                resolve({
                    shouldContinue: true,
                    correctedCommand: topSuggestion.command
                });
            } else {
                resolve({ shouldContinue: false });
            }
        });
    });
}

// CLI interface for testing
if (require.main === module) {
    const input = process.argv[2];
    if (!input) {
        console.log('Usage: typo-detector <input>');
        process.exit(1);
    }

    const result = defaultTypoDetector.checkForTypos(input);

    if (result.hasTypo) {
        console.log(`Possible typo detected in "${input}":`);
        result.suggestions.forEach((suggestion, index) => {
            console.log(`${index + 1}. ${suggestion.command} (${Math.round(suggestion.confidence * 100)}% confidence)`);
            if (suggestion.description) {
                console.log(`   ${suggestion.description}`);
            }
        });
    } else {
        console.log(`No typos detected in "${input}"`);
    }
}