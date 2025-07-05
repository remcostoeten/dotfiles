#!/usr/bin/env fish

# ==============================================================================
# FISH SHELL CONFIGURATION - SOURCE OF TRUTH
# Location: ~/.config/dotfiles/configs/fish/config.fish
# Symlinked to: ~/.config/fish/config.fish
# ==============================================================================

# ------------------------------------------------------------------------------
# PROMPT INITIALIZATION
# ------------------------------------------------------------------------------
if command -q starship
    starship init fish | source
end

# ------------------------------------------------------------------------------
# ENVIRONMENT VARIABLES
# ------------------------------------------------------------------------------
# Editor preferences
set -gx EDITOR nvim
set -gx VISUAL nvim

# Path additions
set -gx PATH "$HOME/.bun/bin" $PATH
set -gx PATH "$HOME/.deno/bin" $PATH

# pnpm
set -gx PNPM_HOME "$HOME/.local/share/pnpm"
if not string match -q -- $PNPM_HOME $PATH
    set -gx PATH $PNPM_HOME $PATH
end

# ------------------------------------------------------------------------------
# DOTFILES INTEGRATION
# ------------------------------------------------------------------------------

# Set dotfiles directory
set -gx DOTFILES_DIR "$HOME/.config/dotfiles"

# Enable quiet mode for dotfiles loading (suppress verbose messages)
set -gx DOTFILES_QUIET true

# Load environment variables
if test -f "$DOTFILES_DIR/env/init.fish"
    source "$DOTFILES_DIR/env/init.fish"
end

# Load all user scripts
for script in $DOTFILES_DIR/bin/*.fish
    if test -f $script
        source $script
    end
end

# Load aliases
if test -f "$DOTFILES_DIR/internal/loaders/load-aliases.fish"
    source "$DOTFILES_DIR/internal/loaders/load-aliases.fish"
end

# Load main dotfiles initialization
if test -f "$DOTFILES_DIR/init.fish"
    source "$DOTFILES_DIR/init.fish"
end

# ------------------------------------------------------------------------------
# SSH AGENT
# ------------------------------------------------------------------------------
if test -f "$HOME/.ssh/id_ed25519"
    if not pgrep -x ssh-agent >/dev/null
        eval (ssh-agent -c)
        ssh-add "$HOME/.ssh/id_ed25519" 2>/dev/null
    end
end

# ------------------------------------------------------------------------------
# EXTERNAL TOOLS INITIALIZATION
# ------------------------------------------------------------------------------

# Zoxide (smart cd)
if command -q zoxide
    zoxide init fish | source
end

# ------------------------------------------------------------------------------
# QUICK ALIASES (Core development workflow)
# ------------------------------------------------------------------------------
alias g='git'
alias clone='git clone'
alias i='bun install'
alias r='bun run dev'

# ------------------------------------------------------------------------------
# FISH SHELL SETTINGS
# ------------------------------------------------------------------------------

# Disable greeting message
set -g fish_greeting

# Enable vi mode
fish_vi_key_bindings

# Case-insensitive tab completion
set -g fish_complete_case_insensitive true

# ------------------------------------------------------------------------------
# PERFORMANCE OPTIMIZATION
# ------------------------------------------------------------------------------

# Reduce command history size for better performance
set -g fish_history_size 10000

# Set reasonable completion timeout
set -g fish_complete_timeout 500

# ------------------------------------------------------------------------------
# DEVELOPMENT ENVIRONMENT
# ------------------------------------------------------------------------------

# Node.js optimization
set -gx NODE_OPTIONS "--max-old-space-size=8192"

# Enable colorful output
set -gx FORCE_COLOR 1
# ------------------------------------------------------------------------------
# END OF CONFIGURATION
# ------------------------------------------------------------------------------
