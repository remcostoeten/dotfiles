#!/usr/bin/env fish

# ==============================================================================
# SECTION 5: NODE.JS PROJECT UTILITIES
# Dependencies: rm, node package managers (npm/yarn/pnpm/bun)
# ==============================================================================

# Function to only remove/clean folders without reinstalling
function rmnode
    # Check for help flag
    if test (count $argv) -eq 1 -a "$argv[1]" = "--help" -o "$argv[1]" = "--h" -o "$argv[1]" = "-h"
        echo (set_color --bold cyan)"🧹 rmnode - Clean project folders only"(set_color normal)
        echo "Usage: rmnode"
        echo "This function removes node_modules, .next, dist, .vite, and out folders"
        echo "WITHOUT reinstalling dependencies. Useful for just cleaning up."
        return 0
    end

    bash -c '
        set -euo pipefail

        RED="\033[0;31m"
        GREEN="\033[0;32m"
        BLUE="\033[0;34m"
        RESET="\033[0m"

        log() {
            echo -e "${BLUE}[INFO]${RESET} $1"
        }

        success() {
            echo -e "${GREEN}[DONE]${RESET} $1"
        }

        error() {
            echo -e "${RED}[ERROR]${RESET} $1" >&2
        }

        # Remove common build/dependency folders
        remove_folder() {
            local folder=$1
            if [ -d "$folder" ]; then
                log "Removing $folder..."
                rm -rf "$folder"
                success "$folder removed"
            fi
        }

        # Main logic - only cleaning, no reinstall
        log "Cleaning project folders..."

        remove_folder node_modules
        remove_folder .next
        remove_folder dist
        remove_folder .vite
        remove_folder out

        success "Project folders cleaned!"

    ' -- $argv
end
