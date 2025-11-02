#!/bin/bash

# Module loader - sources all setup modules
# This file is sourced by the main setup.sh

SETUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source core modules
source "$SETUP_DIR/core/colors.sh"
source "$SETUP_DIR/core/config.sh"
source "$SETUP_DIR/core/helpers.sh"
source "$SETUP_DIR/core/progress.sh"

# Source installer functions
source "$SETUP_DIR/installers/common.sh"

# Source package definitions
source "$SETUP_DIR/packages/essential.sh"
source "$SETUP_DIR/packages/languages.sh"
source "$SETUP_DIR/packages/editors.sh"
source "$SETUP_DIR/packages/package-managers.sh"
source "$SETUP_DIR/packages/git-tools.sh"
source "$SETUP_DIR/packages/cli-utils.sh"
source "$SETUP_DIR/packages/browsers.sh"
source "$SETUP_DIR/packages/communication.sh"
source "$SETUP_DIR/packages/media.sh"
source "$SETUP_DIR/packages/devops.sh"
source "$SETUP_DIR/packages/system.sh"
source "$SETUP_DIR/packages/hardware.sh"
source "$SETUP_DIR/packages/automation.sh"
source "$SETUP_DIR/packages/gnome.sh"
source "$SETUP_DIR/packages/snap.sh"
source "$SETUP_DIR/packages/curl-tools.sh"
source "$SETUP_DIR/packages/npm-tools.sh"
source "$SETUP_DIR/packages/android.sh"
source "$SETUP_DIR/packages/config-apps.sh"

print_verbose "All setup modules loaded successfully"
