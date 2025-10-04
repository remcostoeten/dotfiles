#!/usr/bin/env fish

# Global environment variables for dotfiles

# Editor preferences
set -gx EDITOR nvim
set -gx VISUAL nvim

# Development paths
set -gx DOTFILES_DIR (dirname (dirname (status --current-filename)))

# Common development directories
if test -d "$HOME/dev"
    set -gx DEV_DIR "$HOME/dev"
end

if test -d "$HOME/projects"
    set -gx PROJECTS_DIR "$HOME/projects"
end

# Language-specific environment variables
set -gx NODE_ENV development
set -gx PYTHONDONTWRITEBYTECODE 1

# History settings
set -gx HISTSIZE 10000
set -gx SAVEHIST 10000

# fly cli
 export FLYCTL_INSTALL="/home/remco-stoeten/.fly"
  export PATH="$FLYCTL_INSTALL/bin:$PATH"
# Add dotfiles bin directory to PATH
set -gx PATH $DOTFILES_DIR/bin $PATH
