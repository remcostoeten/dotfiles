#!/usr/bin/env bash
# ~/.config/dotfiles/scripts/commit_test_runner.sh
# 
# Interactive menu to scaffold isolated git environments to test every single
# component of the new Smart Commit CLI.

set -e

SANDBOX_DIR="/tmp/smart-commit-playground"
CLI_BIN="$HOME/.config/dotfiles/scripts/commit/commit"

# Ensure the binary exists natively
if [ ! -f "$CLI_BIN" ]; then
    echo "❌ Could not find binary at $CLI_BIN"
    echo "Please run 'make install' or 'go build -o commit .' from your project directory first."
    exit 1
fi

function reset_sandbox() {
    rm -rf "$SANDBOX_DIR"
    mkdir -p "$SANDBOX_DIR"
    cd "$SANDBOX_DIR"
    git init --quiet
    git commit --allow-empty -m "root" --quiet
}

function pause() {
    echo ""
    read -p "Press [Enter] to return to the testing menu..."
}

while true; do
    clear
    echo "=========================================================="
    echo "🧪 SMART COMMIT CLI - ISOLATED TESTING PLAYGROUND 🧪"
    echo "=========================================================="
    echo "Select a feature to test in isolation:"
    echo "1. Unquoted Smart Parsing (Path Prediction)"
    echo "2. Exclusion Rules (--exclude & defaults)"
    echo "3. Pre-Commit Hook Catching (--no-verify prompt)"
    echo "4. Interactive GUI (Live Diff Pane)"
    echo "5. Interactive Branching (Menu + Post Actions)"
    echo "6. Conventional Commits Menu (-c)"
    echo "7. Settings/Config GUI (Edit Provider & Prompts)"
    echo "8. Git State Blocks (Detached HEAD protection)"
    echo "0. Quit"
    echo "=========================================================="
    read -p "Enter choice [0-8]: " choice

    case $choice in
        1)
            reset_sandbox
            echo "setup code();" > src/index.ts
            git add . && git commit -m "base" --quiet
            echo "fix code();" > src/index.ts
            echo "test" > test.txt
            
            echo ""
            echo "✅ Environment Scaffolded: We created a modified file 'src/index.ts'"
            echo "and an untracked file 'test.txt'."
            echo ""
            echo "👉 To test Unquoted Smart Parsing, run this exact command:"
            echo -e "\033[1;36m$CLI_BIN fix the bug in src/index.ts\033[0m"
            echo ""
            echo "It should only stage src/index.ts (ignoring test.txt), and set the message to 'fix the bug in'."
            pause
            ;;
        2)
            reset_sandbox
            mkdir -p dist node_modules src
            echo "binary" > dist/bundle.js
            echo "heavy" > node_modules/react.js
            echo "source" > src/main.go
            echo "dev" > .env
            
            echo ""
            echo "✅ Environment Scaffolded: We created 'src/main.go', plus forbidden folders 'dist', 'node_modules', and '.env'."
            echo ""
            echo "👉 To test the Exclusion Engine, simply run:"
            echo -e "\033[1;36m$CLI_BIN add basic setup\033[0m"
            echo ""
            echo "It should automatically filter out the excluded folders and explicitly only stage src/main.go."
            pause
            ;;
        3)
            reset_sandbox
            echo "bad code" > src.js
            mkdir -p .git/hooks
            cat << 'EOF' > .git/hooks/pre-commit
#!/bin/sh
echo "❌ LINT FAILURE!"
exit 1
EOF
            chmod +x .git/hooks/pre-commit
            
            echo ""
            echo "✅ Environment Scaffolded: We created an unbreakable failing pre-commit hook."
            echo ""
            echo "👉 To test Hook Error Catching, try to commit:"
            echo -e "\033[1;36m$CLI_BIN break the build\033[0m"
            echo ""
            echo "Watch it swallow the hook failure and ask if you want to bypass using --no-verify."
            pause
            ;;
        4)
            reset_sandbox
            echo -e "line1\nline2\nline3" > numbers.txt
            git add numbers.txt && git commit -m "base" --quiet
            echo -e "line1\nNEW_LINE\nline3" > numbers.txt
            
            echo ""
            echo "✅ Environment Scaffolded: We modified 'numbers.txt' to generate a diff."
            echo ""
            echo "👉 To test the Interactive Diff UI, run:"
            echo -e "\033[1;36m$CLI_BIN change text -i\033[0m"
            echo ""
            echo "Watch the split-pane perfectly highlight exactly what changed in green/red."
            pause
            ;;
        5)
            reset_sandbox
            echo "new feature" > feature.sh
            
            echo ""
            echo "✅ Environment Scaffolded: Untracked 'feature.sh' ready."
            echo ""
            echo "👉 To test Post-Commit Branching UI, run:"
            echo -e "\033[1;36m$CLI_BIN add new script -i\033[0m"
            echo ""
            echo "Press 'b' to open branch menu, hit 'Create & switch new branch', type 'feat/script', and commit."
            pause
            ;;
        6)
            reset_sandbox
            echo "config" > .prettierrc
            
            echo ""
            echo "✅ Environment Scaffolded: We created '.prettierrc'."
            echo ""
            echo "👉 To test Conventional Commit prompt, run:"
            echo -e "\033[1;36m$CLI_BIN add prettier config -c\033[0m"
            echo ""
            echo "It will automatically block and force you to pick 'chore' or 'feat' from the beautiful list."
            pause
            ;;
        7)
            reset_sandbox
            echo "update" > test.txt
            
            echo ""
            echo "✅ Environment Scaffolded."
            echo ""
            echo "👉 To test the GUI configuration editor, run:"
            echo -e "\033[1;36m$CLI_BIN arbitrary changes -i\033[0m"
            echo ""
            echo "Press 's', navigate to 'Edit AI Provider', choose 'opencode', and verify hit saves internally."
            pause
            ;;
        8)
            reset_sandbox
            echo "v1" > file.txt
            git add file.txt && git commit -m "v1" --quiet
            git checkout --detach HEAD --quiet
            echo "v2" > file.txt
            
            echo ""
            echo "✅ Environment Scaffolded: You are now in a 'Detached HEAD' state."
            echo ""
            echo "👉 Try to commit, watch it brutally deny you for your own safety:"
            echo -e "\033[1;36m$CLI_BIN update text\033[0m"
            pause
            ;;
        0)
            echo "Exiting."
            exit 0
            ;;
        *)
            echo "Invalid choice."
            sleep 1
            ;;
    esac
done
