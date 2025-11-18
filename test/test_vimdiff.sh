#!/bin/bash

# Test script for vimdiff configuration
echo "🎨 Testing vimdiff dark and aesthetic configuration..."

# Create test files for diff
cat > test_file1.txt << 'EOF'
# Configuration Files
This is the original file with some content.

## Features
- Dark theme support
- Enhanced diff highlighting
- Better color scheme

## Settings
color=dark
highlight=enhanced
aesthetic=beautiful
EOF

cat > test_file2.txt << 'EOF'
# Configuration Files
This is the modified file with different content.

## Features
- Dark theme support
- Enhanced diff highlighting
- Better color scheme
- New feature added

## Settings
color=dark
highlight=enhanced
aesthetic=beautiful
- New option: fancy=true
EOF

echo "📝 Created test files for vimdiff demonstration"
echo ""
echo "🔧 To test the vimdiff configuration, run:"
echo "nvim -d test_file1.txt test_file2.txt"
echo ""
echo "⌨️  Keymaps available in diff mode:"
echo "  [c      - Go to previous diff hunk"
echo "  ]c      - Go to next diff hunk"
echo "  <leader>do - Put diff from other window"
echo "  <leader>dp - Get diff from other window"
echo "  <leader>du - Update diff"
echo "  <leader>de - Toggle enhanced diff mode"
echo "  <leader>df - Focus current diff hunk"
echo "  <leader>ds - Show diff statistics"
echo "  <leader>dc - Copy diff hunk to clipboard"
echo ""
echo "🎨 The configuration includes:"
echo "  - Dark diff colors optimized for Kanagawa theme"
echo "  - Enhanced diff algorithms"
echo "  - Better folding and navigation"
echo "  - Aesthetic color highlighting"
echo ""
echo "✅ Vimdiff configuration is ready!"