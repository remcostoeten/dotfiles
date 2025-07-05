#!/usr/bin/env fish

# ==============================================================================
# FISH CONFIG SYMLINK SETUP
# Creates symlink from dotfiles config.fish to Fish config directory
# ==============================================================================

function setup_fish_config
    set -l dotfiles_config "$HOME/.config/dotfiles/configs/config.fish"
    set -l fish_config "$HOME/.config/fish/config.fish"
    set -l backup_file "$HOME/.config/fish/config.fish.backup"
    
    echo "🐟 Setting up Fish config symlink..."
    
    # Check if dotfiles config exists
    if not test -f $dotfiles_config
        echo "❌ Dotfiles config not found: $dotfiles_config"
        return 1
    end
    
    # Create Fish config directory if it doesn't exist
    if not test -d (dirname $fish_config)
        echo "📁 Creating Fish config directory..."
        mkdir -p (dirname $fish_config)
    end
    
    # Backup existing config if it exists and isn't already a symlink
    if test -f $fish_config; and not test -L $fish_config
        echo "💾 Backing up existing config to $backup_file"
        cp $fish_config $backup_file
    end
    
    # Remove existing config (file or symlink)
    if test -f $fish_config; or test -L $fish_config
        rm $fish_config
    end
    
    # Create symlink
    echo "🔗 Creating symlink: $fish_config -> $dotfiles_config"
    ln -sf $dotfiles_config $fish_config
    
    # Verify symlink
    if test -L $fish_config
        echo "✅ Fish config symlink created successfully!"
        echo "📍 Source of truth: $dotfiles_config"
        echo "🔗 Symlinked to: $fish_config"
        
        # Test if config loads without errors
        echo "🧪 Testing configuration..."
        if fish -c "source $fish_config; echo 'Config loads successfully!'" >/dev/null 2>&1
            echo "✅ Configuration test passed!"
        else
            echo "⚠️  Configuration has issues, check syntax"
        end
    else
        echo "❌ Failed to create symlink"
        return 1
    end
end

# Run if script is executed directly
if test (basename (status --current-filename)) = "setup-fish-config.fish"
    setup_fish_config
end
