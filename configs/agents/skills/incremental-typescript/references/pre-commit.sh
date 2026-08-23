#!/bin/sh
# TypeScript type-check via tsgo (the Go-native compiler), no hook manager required.
# Enable once per clone:   git config core.hooksPath .githooks
# Bypass a single commit:  git commit --no-verify

if [ -x node_modules/.bin/tsgo ]; then
    tsgo="node_modules/.bin/tsgo"
elif command -v tsgo >/dev/null 2>&1; then
    tsgo="tsgo"
else
    echo "pre-commit: tsgo not installed — skipping type-check."
    echo "            run 'npm ci' (installs @typescript/native-preview) to enable it."
    exit 0
fi

echo "pre-commit: type-checking with tsgo…"
if ! "$tsgo" --noEmit; then
    echo "pre-commit: type errors found — commit aborted (use 'git commit --no-verify' to bypass)."
    exit 1
fi
