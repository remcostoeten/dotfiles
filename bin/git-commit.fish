#!/usr/bin/env fish

function commit
    # Check for help flags
    if test (count $argv) -eq 1
        switch $argv[1]
            case --help --h -h
                _commit_help
                return 0
        end
    end

    # Check if any arguments were provided
    if test (count $argv) -eq 0
        _commit_help
        return 1
    end

    set -l message_parts
    set -l file_parts
    set -l parsing_files false

    # Parse arguments
    for arg in $argv
        if test "$arg" = --
            set parsing_files true
            continue
        end

        if test "$parsing_files" = true
            set -a file_parts $arg
        else
            set -a message_parts $arg
        end
    end

    # Join message parts with spaces
    set -l commit_message (string join " " $message_parts)

    # Check if we have a commit message
    if test -z "$commit_message"
        echo "Error: Commit message cannot be empty"
        return 1
    end

    # Process commitizen-style prefixes
    set commit_message (_process_commitizen_prefix "$commit_message")

    # Handle file-specific commits
    if test (count $file_parts) -gt 0
        # Process each file part for brace expansion
        set -l expanded_files
        for file_part in $file_parts
            # Split by comma and expand each part
            set -l comma_split (string split "," $file_part)
            for part in $comma_split
                # Trim whitespace
                set part (string trim $part)
                # Add to expanded files if not empty
                if test -n "$part"
                    set -a expanded_files $part
                end
            end
        end

        # Verify files exist before committing
        set -l valid_files
        for file in $expanded_files
            if test -e "$file"
                set -a valid_files "$file"
            else
                echo (set_color yellow)"⚠️  Warning: File not found: $file"(set_color normal)
            end
        end

        if test (count $valid_files) -eq 0
            echo (set_color red)"❌ Error: No valid files to commit"(set_color normal)
            return 1
        end

        # Show what we're about to commit
        echo
        echo (set_color --bold cyan)"🎯 Committing specific files:"(set_color normal)
        for file in $valid_files
            echo "   "(set_color green)"✓"(set_color normal)" $file"
        end
        echo
        echo (set_color --bold white)"📝 Message:"(set_color normal)" \"$commit_message\""
        echo

        # Execute the commit
        if git commit -m "$commit_message" -- $valid_files
            _show_commit_success (count $valid_files) specific
        else
            echo (set_color red)"❌ Commit failed!"(set_color normal)
            return 1
        end
    else
        # Check if there are staged files
        set -l staged_count (git diff --cached --name-only | wc -l | string trim)

        if test "$staged_count" -eq 0
            echo (set_color yellow)"⚠️  No staged files to commit. Use 'git add' first or specify files with '--'"(set_color normal)
            return 1
        end

        # Show staged files
        echo
        echo (set_color --bold cyan)"🚀 Committing all staged files:"(set_color normal)
        git diff --cached --name-only | while read -l file
            echo "   "(set_color green)"✓"(set_color normal)" $file"
        end
        echo
        echo (set_color --bold white)"📝 Message:"(set_color normal)" \"$commit_message\""
        echo

        # Execute the commit
        if git commit -m "$commit_message"
            _show_commit_success $staged_count staged
        else
            echo (set_color red)"❌ Commit failed!"(set_color normal)
            return 1
        end
    end
end

# Function to show commit success with nice formatting
function _show_commit_success
    set -l file_count $argv[1]
    set -l commit_type $argv[2]

    # Get the latest commit hash and stats
    set -l commit_hash (git rev-parse --short HEAD)
    set -l branch_name (git branch --show-current)

    echo
    echo (set_color --bold green)"✅ Commit successful!"(set_color normal)
    echo (set_color yellow)"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"(set_color normal)
    echo (set_color --bold white)"📋 Summary:"(set_color normal)
    echo "   "(set_color cyan)"🔖 Hash:"(set_color normal)" $commit_hash"
    echo "   "(set_color cyan)"🌿 Branch:"(set_color normal)" $branch_name"

    if test "$commit_type" = specific
        echo "   "(set_color cyan)"📁 Files:"(set_color normal)" $file_count specific file(s)"
    else
        echo "   "(set_color cyan)"📁 Files:"(set_color normal)" $file_count staged file(s)"
    end

    # Show commit stats
    set -l stats (git diff --stat HEAD~1..HEAD)
    if test -n "$stats"
        echo
        echo (set_color --bold white)"📊 Changes:"(set_color normal)
        echo "$stats" | head -n -1 | while read -l line
            echo "   "(set_color green)"+"(set_color normal)" $line"
        end
        # Show summary line with colors
        set -l summary_line (echo "$stats" | tail -n 1)
        echo "   "(set_color --bold blue)"📈 $summary_line"(set_color normal)
    end

    echo (set_color yellow)"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"(set_color normal)
    echo
end

# Helper function for displaying help
function _commit_help
    # Clear screen for better presentation
    clear

    # Header
    echo
    echo (set_color --bold cyan)"   🚀 Git Commit Helper   "(set_color normal)
    echo (set_color yellow)"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"(set_color normal)

    # Basic Usage Section
    echo
    echo (set_color --bold white)" 📝 BASIC USAGE"(set_color normal)
    echo (set_color yellow)"───────────────────────────────────────────────────"(set_color normal)
    echo "  "(set_color green)"commit"(set_color normal)" "(set_color blue)"<message>"(set_color normal)" "(set_color magenta)"[-- <files>]"(set_color normal)

    # Quick Examples Section
    echo
    echo (set_color --bold white)" 💡 QUICK EXAMPLES"(set_color normal)
    echo (set_color yellow)"───────────────────────────────────────────────────"(set_color normal)
    echo "  "(set_color brblack)"# Basic commit (all staged files):"(set_color normal)
    echo "  "(set_color green)"commit"(set_color normal)" fix user authentication bug"
    echo
    echo "  "(set_color brblack)"# Commit ONLY specific files:"(set_color normal)
    echo "  "(set_color green)"commit"(set_color normal)" update docs "(set_color magenta)"--"(set_color normal)" README.md CHANGELOG.md"

    # Conventional Commits Section
    echo
    echo (set_color --bold white)" 🏷  CONVENTIONAL COMMITS"(set_color normal)
    echo (set_color yellow)"───────────────────────────────────────────────────"(set_color normal)
    echo "  "(set_color cyan)"feat"(set_color normal)"    → New features"
    echo "  "(set_color red)"fix"(set_color normal)"     → Bug fixes"
    echo "  "(set_color yellow)"chore"(set_color normal)"   → Maintenance tasks"
    echo "  "(set_color blue)"refactor"(set_color normal)" → Code restructuring"
    echo "  "(set_color magenta)"optimize"(set_color normal)" → Performance improvements"
    echo
    echo "  "(set_color brblack)"# Examples:"(set_color normal)
    echo "  "(set_color green)"commit"(set_color normal)" "(set_color cyan)"feat"(set_color normal)" add user authentication"
    echo "  "(set_color green)"commit"(set_color normal)" "(set_color red)"fix"(set_color normal)" resolve login timeout issue"

    # Advanced Features Section
    echo
    echo (set_color --bold white)" ⚡ ADVANCED FEATURES"(set_color normal)
    echo (set_color yellow)"───────────────────────────────────────────────────"(set_color normal)
    echo "  "(set_color brblack)"# Comma-separated files:"(set_color normal)
    echo "  "(set_color green)"commit"(set_color normal)" update utils "(set_color magenta)"--"(set_color normal)" src/utils.js, test/utils.test.js"
    echo
    echo "  "(set_color brblack)"# Brace expansion:"(set_color normal)
    echo "  "(set_color green)"commit"(set_color normal)" update styles "(set_color magenta)"--"(set_color normal)" src/{css,scss}/main.*"

    # Key Features Section
    echo
    echo (set_color --bold white)" ✨ KEY FEATURES"(set_color normal)
    echo (set_color yellow)"───────────────────────────────────────────────────"(set_color normal)
    echo "  "(set_color cyan)"•"(set_color normal)" No quotes needed for messages"
    echo "  "(set_color cyan)"•"(set_color normal)" Smart conventional commit prefixes"
    echo "  "(set_color cyan)"•"(set_color normal)" Without "(set_color magenta)"--"(set_color normal)": commits all staged files"
    echo "  "(set_color cyan)"•"(set_color normal)" With "(set_color magenta)"--"(set_color normal)": commits ONLY specified files"
    echo "  "(set_color cyan)"•"(set_color normal)" File wildcards & brace expansion support"
    echo "  "(set_color cyan)"•"(set_color normal)" Comma-separated file lists"

    # Help Footer
    echo
    echo (set_color yellow)"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"(set_color normal)
    echo (set_color --bold white)" 🔍 HELP: "(set_color normal)(set_color yellow)"commit --help"(set_color normal)", "(set_color yellow)"-h"(set_color normal)", or "(set_color yellow)"--h"(set_color normal)
    echo
end

# Function to process commitizen-style prefixes
function _process_commitizen_prefix
    set -l message $argv[1]

    # Check if message starts with a commitizen prefix
    if string match -qr '^(feat|fix|chore|refactor|optimize):' $message
        echo $message
        return
    end

    # Check for shorthand prefixes and expand them
    set -l first_word (string split " " $message)[1]

    switch $first_word
        case feat feature
            set message (string replace -r '^(feat|feature)\s*' 'feat: ' $message)
        case fix bugfix
            set message (string replace -r '^(fix|bugfix)\s*' 'fix: ' $message)
        case chore
            set message (string replace -r '^chore\s*' 'chore: ' $message)
        case refactor
            set message (string replace -r '^refactor\s*' 'refactor: ' $message)
        case optimize perf performance
            set message (string replace -r '^(optimize|perf|performance)\s*' 'optimize: ' $message)
    end

    echo $message
end
