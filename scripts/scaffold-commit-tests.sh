#!/usr/bin/env bash
# scaffold-commit-tests.sh
# 
# This script generates an isolated test environment to safely play with the 
# smart commit CLI features without ruining your actual dotfiles repo.

set -e

TEST_DIR="/tmp/smart-commit-sandbox"

echo "🧪 Scaffolding test environment at $TEST_DIR..."

# Clean up any previous test
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# 1. Initialize Git
echo "📦 Initializing testing git repo..."
git init --quiet
git commit --allow-empty -m "root: initial empty commit"

# 2. Add some tracked files and commit them
echo "📄 Creating base tracked files..."
mkdir -p src tests config
echo "console.log('hello world');" > src/index.ts
echo "export const db = 'sqlite';" > config/database.ts
echo "PORT=3000" > .env.example
git add .
git commit -m "chore: setup base files" --quiet

# 3. Create dirty state (modified, deleted, untracked)
echo "🔥 Creating changes for you to test..."
# Modify a file
echo "console.log('hello dotfiles');" > src/index.ts
# New untracked files
echo "import { test } from 'vitest';" > tests/app.test.ts
echo "<button>Click Me</button>" > src/button.tsx
# Excluded files
mkdir -p node_modules dist
echo "heavy binaries" > node_modules/index.js
echo "compiled code" > dist/bundle.js
# Secret file
echo "DATABASE_URL=secret123" > .env

# 4. Create a failing pre-commit hook wrapper (simulate npm run lint failing)
echo "🪝 Setting up a failing pre-commit hook to test Suggestion 2 (Hook Intercept)..."
mkdir -p .git/hooks
cat << 'EOF' > .git/hooks/pre-commit
#!/usr/bin/env bash

# We look for a flag file that lets this succeed sometimes
if [ -f ".bypass_hook" ]; then
    echo "✅ Hook bypass flag found. Linting succeeded!"
    exit 0
fi

echo "❌ Linting Failed! (This is an intentional block from the pre-commit hook)"
echo "   Error in src/index.ts: Missing semicolon."
echo "   To bypass this deliberately using our CLI, try retrying with --no-verify."
exit 1
EOF
chmod +x .git/hooks/pre-commit

echo "
============================================================
✅ Scaffold Complete!
============================================================

Your heavily-modified sandbox is waiting at:
  cd $TEST_DIR

Try testing the features we just built! 
Before you start, make sure to compile the latest binary we just updated:
  cd ~/.config/dotfiles/scripts/commit && go build -o commit .

Then inside the sandbox, you can try:

1. Live Diff Pane:
   $ ~/.config/dotfiles/scripts/commit/commit fix the button bug -i
   (Highlight the files and see the Right-Pane Diff)

2. Hook Intercept:
   $ ~/.config/dotfiles/scripts/commit/commit refactor core logic
   (Watch it fail the hook, gracefully catch the error, and ask if you want to bypass)

3. Conventional Commits (Suggestion 3):
   $ ~/.config/dotfiles/scripts/commit/commit add a new feature -c
   (Watch it launch the TUI menu asking if this is a 'feat', 'fix', etc., and automatically format your message)

============================================================
"
