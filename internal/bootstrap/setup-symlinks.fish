#!/usr/bin/env fish

# Bootstrap script for setting up symlinks
# This is called during initial dotfiles setup on new machines

set -l SCRIPT_DIR (dirname (status -f))
set -l DOTFILES_DIR (dirname (dirname $SCRIPT_DIR))

# Color definitions
set -l GREEN (set_color green)
set -l RED (set_color red)
set -l YELLOW (set_color yellow)
set -l BLUE (set_color blue)
set -l NORMAL (set_color normal)

echo "$BLUE===================================$NORMAL"
echo "$BLUE    Setting up dotfile symlinks    $NORMAL"
echo "$BLUE===================================$NORMAL"
echo ""

# First, source the symlink manager to ensure it's available
if test -f $DOTFILES_DIR/bin/symlink-manager.fish
    fish $DOTFILES_DIR/bin/symlink-manager.fish setup
    set -l exit_code $status

    if test $exit_code -eq 0
        echo ""
        echo "$GREEN✓ Symlinks setup completed successfully!$NORMAL"

        # Show the current status
        echo ""
        echo "Current symlink status:"
        fish $DOTFILES_DIR/bin/symlink-manager.fish status
    else
        echo ""
        echo "$RED✗ Symlink setup failed with exit code: $exit_code$NORMAL"
        exit $exit_code
    end
else
    echo "$RED✗ Error: symlink-manager.fish not found!$NORMAL"
    echo "Expected location: $DOTFILES_DIR/bin/symlink-manager.fish"
    exit 1
end

# Additional platform-specific symlinks can be added here
switch (uname)
    case Linux
        echo ""
        echo "$BLUE→ Setting up Linux-specific configurations...$NORMAL"
        # Neovim configuration is now handled by symlink-manager

        # Check for additional development tool configs
        echo ""
        echo "$BLUE→ Checking for development tool configurations...$NORMAL"

        if test -f $DOTFILES_DIR/config/git/gitconfig
            echo "  → Setting up Git configuration..."
            ln -sf $DOTFILES_DIR/config/git/gitconfig $HOME/.gitconfig
        end

        if test -d $DOTFILES_DIR/config/ssh
            echo "  → Setting up SSH configuration..."
            mkdir -p $HOME/.ssh
            chmod 700 $HOME/.ssh
            # Only link config file, not keys
            if test -f $DOTFILES_DIR/config/ssh/config
                ln -sf $DOTFILES_DIR/config/ssh/config $HOME/.ssh/config
                chmod 600 $HOME/.ssh/config
            end
        end

        echo ""
        echo "$GREEN===================================$NORMAL"
        echo "$GREEN    Symlink setup complete!        $NORMAL"
        echo "$GREEN===================================$NORMAL"
        echo ""
        echo "To manage symlinks manually, use:"
        echo "  $YELLOW• symlink-manager setup$NORMAL    - Create/update all symlinks"
        echo "  $YELLOW• symlink-manager verify$NORMAL   - Check symlink validity"
        echo "  $YELLOW• symlink-manager status$NORMAL   - Show symlink status"
        echo "  $YELLOW• symlink-manager clean$NORMAL    - Remove all symlinks"
        echo ""
