#!/usr/bin/env fish

# Main bootstrap script for dotfiles
# Run this on new machines to set everything up

set -l DOTFILES_DIR (dirname (status -f))

# Color definitions
set -l GREEN (set_color green)
set -l RED (set_color red)
set -l YELLOW (set_color yellow)
set -l BLUE (set_color blue)
set -l NORMAL (set_color normal)

echo "$BLUE╔═══════════════════════════════════════╗$NORMAL"
echo "$BLUE║     Dotfiles Bootstrap Installer      ║$NORMAL"
echo "$BLUE╚═══════════════════════════════════════╝$NORMAL"
echo ""
echo "This will set up your dotfiles on this machine."
echo ""

# Function to run a bootstrap script
function run_bootstrap_script
    set -l script_name $argv[1]
    set -l script_path $DOTFILES_DIR/internal/bootstrap/$script_name
    
    if test -f $script_path
        echo ""
        echo "$BLUE→ Running $script_name...$NORMAL"
        fish $script_path
        if test $status -ne 0
            echo "$RED✗ Failed to run $script_name$NORMAL"
            return 1
        end
    else
        echo "$YELLOW⚠ Script not found: $script_name$NORMAL"
        return 1
    end
end

# Step 1: Set up Fish configuration
run_bootstrap_script setup-fish-config.fish
or exit 1

# Step 2: Set up symlinks
run_bootstrap_script setup-symlinks.fish
or exit 1

# Step 3: Check & install tool dependencies
echo ""
echo "$BLUE→ Checking & installing tool dependencies…$NORMAL"
dotfiles-install-deps --yes || echo "$YELLOW⚠ Some tools may not work without missing deps.$NORMAL"

# Step 4: Check for recommended tools
echo ""
echo "$BLUE→ Checking for recommended tools...$NORMAL"

set -l missing_tools

# Check for common development tools
set -l tools_to_check \
    "git:Version control system" \
    "nvim:Neovim text editor" \
    "tmux:Terminal multiplexer" \
    "fzf:Fuzzy finder" \
    "ripgrep:Fast grep alternative" \
    "fd:Fast find alternative" \
    "bat:Cat clone with syntax highlighting" \
    "exa:Modern ls replacement" \
    "gh:GitHub CLI"

for tool_info in $tools_to_check
    set -l parts (string split ":" $tool_info)
    set -l tool $parts[1]
    set -l description $parts[2]
    
    if not command -v $tool >/dev/null 2>&1
        set missing_tools $missing_tools $tool
        echo "  $YELLOW⚠$NORMAL $tool not found - $description"
    else
        echo "  $GREEN✓$NORMAL $tool is installed"
    end
end

if test (count $missing_tools) -gt 0
    echo ""
    echo "$YELLOW⚠ Some recommended tools are not installed.$NORMAL"
    echo "You can install them later using your package manager."
    
    # Provide platform-specific installation hints
    switch (uname)
        case Linux
            if command -v apt >/dev/null 2>&1
                echo ""
                echo "On Ubuntu/Debian, you can install missing tools with:"
                echo "  $BLUE• sudo apt update && sudo apt install [tool-name]$NORMAL"
            else if command -v dnf >/dev/null 2>&1
                echo ""
                echo "On Fedora, you can install missing tools with:"
                echo "  $BLUE• sudo dnf install [tool-name]$NORMAL"
            else if command -v pacman >/dev/null 2>&1
                echo ""
                echo "On Arch Linux, you can install missing tools with:"
                echo "  $BLUE• sudo pacman -S [tool-name]$NORMAL"
            end
        case Darwin
            if command -v brew >/dev/null 2>&1
                echo ""
                echo "On macOS with Homebrew, you can install missing tools with:"
                echo "  $BLUE• brew install [tool-name]$NORMAL"
            else
                echo ""
                echo "Consider installing Homebrew first: https://brew.sh"
            end
    end
end

# Step 5: Source the Fish config to load everything
echo ""
echo "$BLUE→ Reloading Fish configuration...$NORMAL"
source $HOME/.config/fish/config.fish

echo ""
echo "$GREEN╔═══════════════════════════════════════╗$NORMAL"
echo "$GREEN║    Bootstrap completed successfully!   ║$NORMAL"
echo "$GREEN╚═══════════════════════════════════════╝$NORMAL"
echo ""
echo "Your dotfiles are now set up. Here's what was configured:"
echo "  $GREEN✓$NORMAL Fish shell configuration"
echo "  $GREEN✓$NORMAL Symlinks for Kitty, Neovim, and Warp themes"
echo "  $GREEN✓$NORMAL All scripts in bin/ are now available"
echo ""
echo "Quick commands:"
echo "  $YELLOW• symlink-manager status$NORMAL  - Check symlink status"
echo "  $YELLOW• symlink-manager verify$NORMAL  - Verify all symlinks"
echo "  $YELLOW• dotfiles$NORMAL               - Go to dotfiles directory"
echo ""
echo "Restart your terminal or run $YELLOW'exec fish'$NORMAL to ensure all changes take effect."
