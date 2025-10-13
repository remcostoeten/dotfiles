#!/bin/bash

# Colors for pretty output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored status messages
print_status() {
    echo -e "${BLUE}$1${NC}"
}

print_success() {
    echo -e "${GREEN}$1${NC}"
}

# System update and package installation
print_status "Updating system packages..."
sudo apt update
sudo apt upgrade -y

print_status "Installing required packages..."
# Add your required packages here
PACKAGES=(
    "git"
    "curl"
    "fish"
    "snapd"
    # Add more packages as needed
)

for package in "${PACKAGES[@]}"; do
    print_status "Installing $package..."
    sudo apt install -y "$package"
done

# Snap packages (if any)
print_status "Installing snap packages..."
# Add your snap packages here
SNAP_PACKAGES=(
    # "example-snap"
    # Add more snap packages as needed
)

for snap in "${SNAP_PACKAGES[@]}"; do
    print_status "Installing snap package: $snap..."
    sudo snap install "$snap"
done

# Symlink configuration
print_status "Setting up symlinks..."

# Define symlinks: [source, target, description]
declare -A symlinks=(
    ["$HOME/.config/dotfiles/cfg"]="$HOME/.config/fish/config.fish|Fish config"
    # Add more symlinks in the same format:
    # ["source_path"]="target_path|Description"
)

# Create symlinks
for source in "${!symlinks[@]}"; do
    IFS='|' read -r target description <<< "${symlinks[$source]}"
    
    print_status "Trying to symlink $description..."
    
    # Create parent directory if it doesn't exist
    parent_dir=$(dirname "$target")
    mkdir -p "$parent_dir"
    
    # Remove existing file or symlink
    if [ -e "$target" ] || [ -L "$target" ]; then
        rm -f "$target"
    fi
    
    # Create symlink
    if ln -s "$source" "$target"; then
        print_success "Logs: $description symlinked successfully"
    else
        echo "Error: Failed to create symlink for $description"
    fi
done

print_success "Setup completed successfully!"