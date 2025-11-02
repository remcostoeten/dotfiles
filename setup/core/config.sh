#!/bin/bash

# Configuration paths and settings
readonly DOTFILES_DIR="$HOME/.config/dotfiles"
readonly DOTFILES_DATA_DIR="$HOME/.dotfiles"
readonly PROGRESS_FILE="$DOTFILES_DATA_DIR/setup/progress.json"

# Command line flags
DRY_RUN=false
DRY_RUN_SECTION=""
DRY_RUN_INTERACTIVE=false
SKIP_SYSTEM_UPDATE=false
SKIP_FONTS=false
VERBOSE=false
QUIET=false
INSTALL_SECTION=""
INSTALL_INTERACTIVE=false
SKIP_SECTION=""
SKIP_INTERACTIVE=false

# Tracking variables
TOTAL_SUCCESS=0
TOTAL_FAILED=0
