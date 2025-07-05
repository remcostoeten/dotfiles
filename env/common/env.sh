#!/usr/bin/env bash

# Common Environment Configuration
# This file contains environment variables and settings shared across all platforms

# --- Core Environment Variables ---
export DOTFILES_ROOT="${DOTFILES_ROOT:-$HOME/.config/dotfiles}"
export EDITOR="${EDITOR:-nvim}"
export VISUAL="${VISUAL:-$EDITOR}"
export PAGER="${PAGER:-less}"
export BROWSER="${BROWSER:-firefox}"

# --- Development Environment ---
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"
export TERM="${TERM:-xterm-256color}"

# --- History Configuration ---
export HISTSIZE=10000
export HISTFILESIZE=20000
export HISTCONTROL="ignoreboth:erasedups"

# --- XDG Base Directory Specification ---
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
export XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
export XDG_STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}"

# --- Path Management ---
# Add common binary paths
export PATH="$HOME/.local/bin:$PATH"
export PATH="$HOME/bin:$PATH"

# --- Development Tools ---
# Node.js and npm
export NPM_CONFIG_PREFIX="$HOME/.local"
export NODE_OPTIONS="--max-old-space-size=4096"

# --- Security ---
export GPG_TTY=$(tty)

# --- Performance ---
export MAKEFLAGS="-j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)"

# --- Colors ---
export CLICOLOR=1
export LSCOLORS="ExFxBxDxCxegedabagacad"
export LS_COLORS="di=1;34:ln=1;35:so=1;31:pi=1;33:ex=1;32:bd=34;46:cd=34;43:su=30;41:sg=30;46:tw=30;42:ow=30;43"

# --- Less Configuration ---
export LESS="-R -S -M -I -F -X"
export LESSHISTFILE="$XDG_CACHE_HOME/less/history"

# --- Ripgrep ---
export RIPGREP_CONFIG_PATH="$XDG_CONFIG_HOME/ripgrep/config"

# --- FZF Configuration ---
export FZF_DEFAULT_OPTS="--height 40% --layout=reverse --border --inline-info"
export FZF_DEFAULT_COMMAND="rg --files --hidden --follow --glob '!.git/*'"
export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
export FZF_ALT_C_COMMAND="find . -type d -not -path '*/\.*' | head -200"

# --- Git Configuration ---
export GIT_EDITOR="$EDITOR"
