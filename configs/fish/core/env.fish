#!/usr/bin/env fish

# Global environment variables for dotfiles

# Editor preferences
set -gx EDITOR nvim
set -gx VISUAL nvim
set -gx GPG_TTY (tty)

# Development paths
# DOTFILES_DIR points to the root of our dotfiles repository
# This file is at ~/.config/dotfiles/configs/fish/core/env.fish
set -gx DOTFILES_DIR "$HOME/.config/dotfiles"

# Common development directories (use from env if set, otherwise auto-detect)
if not set -q DEV_DIR; and test -d "$HOME/dev"
    set -gx DEV_DIR "$HOME/dev"
end

if not set -q PROJECTS_DIR; and test -d "$HOME/projects"
    set -gx PROJECTS_DIR "$HOME/projects"
end

# Language-specific environment variables (use from env if set, otherwise use defaults)
if not set -q NODE_ENV
    set -gx NODE_ENV development
end

set -gx PYTHONDONTWRITEBYTECODE 1

# History settings
set -gx HISTSIZE 10000
set -gx SAVEHIST 10000

# Add tool bin directories to PATH (if set in env)
if set -q FLYCTL_INSTALL; and test -d "$FLYCTL_INSTALL/bin"
    set -gx PATH "$FLYCTL_INSTALL/bin" $PATH
end

if set -q TURSO_INSTALL; and test -d "$TURSO_INSTALL"
    set -gx PATH "$TURSO_INSTALL" $PATH
end

# Add dotfiles bin directory to PATH
set -gx PATH $DOTFILES_DIR/bin $PATH
