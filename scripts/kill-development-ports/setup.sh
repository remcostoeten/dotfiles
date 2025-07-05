#!/bin/bash

# Setup script for kill-development-ports
# This script installs the necessary Node.js dependencies

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Setting up kill-development-ports..."

# Check if node is available
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed. Please install npm first."
    exit 1
fi

# Navigate to the script directory
cd "$SCRIPT_DIR"

# Install dependencies
echo "Installing Node.js dependencies..."
npm install

# Make the script executable
chmod +x index.js

echo "Setup complete! You can now use the ports command."
echo "Run 'ports' or 'kill-dev' to start using the tool."
