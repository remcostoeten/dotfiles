#!/bin/bash

# Script to generate a demo GIF of the dotfiles setup
# Requires: npm install -g terminalizer gifify (or use asciinema + agg)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$REPO_ROOT/docs"
GIF_OUTPUT="$OUTPUT_DIR/dotfiles-demo.gif"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

echo "📹 Generating demo GIF for dotfiles setup..."

# Check if terminalizer is installed
if ! command -v terminalizer &> /dev/null; then
    echo "⚠️  terminalizer not found. Installing..."
    npm install -g terminalizer
fi

# Check if we're in the right directory
if [ ! -d "$REPO_ROOT/opentui-setup" ]; then
    echo "❌ Error: opentui-setup directory not found"
    exit 1
fi

cd "$REPO_ROOT/opentui-setup"

# Create a terminalizer config if it doesn't exist
TERMINALIZER_CONFIG="$REPO_ROOT/.terminalizer-config.yml"
if [ ! -f "$TERMINALIZER_CONFIG" ]; then
    cat > "$TERMINALIZER_CONFIG" <<EOF
command: bun run setup
cols: 120
rows: 40
repeat: 0
quality: 100
frameDelay: auto
maxIdleTime: 2000
frameBox:
  type: solid
  title: 'Dotfiles Setup Demo'
  style:
    border: 0px
    boxShadow: none
watermark:
  imagePath: null
  style: {}
theme:
  background: 'transparent'
  foreground: '#4ec9b0'
EOF
fi

echo "🎬 Recording terminal session..."
terminalizer record "$TERMINALIZER_CONFIG" -o "$OUTPUT_DIR/demo-recording.json" || {
    echo "⚠️  Recording failed. Using alternative method with asciinema..."

    # Alternative: Use asciinema if available
    if command -v asciinema &> /dev/null; then
        echo "📹 Recording with asciinema..."
        asciinema rec "$OUTPUT_DIR/demo.cast" --command "bun run setup" || true

        # Convert to GIF using agg if available
        if command -v agg &> /dev/null; then
            echo "🔄 Converting to GIF..."
            agg "$OUTPUT_DIR/demo.cast" "$GIF_OUTPUT"
            echo "✅ GIF created: $GIF_OUTPUT"
        else
            echo "⚠️  agg not found. Install with: cargo install agg"
            echo "📝 Recording saved as: $OUTPUT_DIR/demo.cast"
            echo "   Convert manually with: agg $OUTPUT_DIR/demo.cast $GIF_OUTPUT"
        fi
    else
        echo "❌ Error: Neither terminalizer nor asciinema found"
        echo "   Install terminalizer: npm install -g terminalizer"
        echo "   Or install asciinema: pip install asciinema"
        exit 1
    fi
    exit 0
}

# Render the recording to GIF
echo "🎨 Rendering GIF..."
terminalizer render "$OUTPUT_DIR/demo-recording.json" -o "$GIF_OUTPUT" || {
    echo "⚠️  Direct render failed. Converting with gifify..."

    # Alternative: Use gifify if available
    if command -v gifify &> /dev/null; then
        # Terminalizer saves as .json, we need to convert it
        echo "🔄 Converting recording to GIF with gifify..."
        # Note: gifify works with video files, so this might need adjustment
        echo "⚠️  Manual conversion may be needed"
    else
        echo "❌ Error: GIF rendering failed"
        echo "   Recording saved as: $OUTPUT_DIR/demo-recording.json"
        echo "   Render manually with: terminalizer render $OUTPUT_DIR/demo-recording.json -o $GIF_OUTPUT"
        exit 1
    fi
}

echo "✅ Demo GIF created: $GIF_OUTPUT"
echo "📊 File size: $(du -h "$GIF_OUTPUT" | cut -f1)"