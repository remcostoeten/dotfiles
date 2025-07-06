function reinstallnode
    # Check for help flag
    if test (count $argv) -eq 1 -a "$argv[1]" = "--help" -o "$argv[1]" = "--h" -o "$argv[1]" = "-h"
        echo (set_color --bold cyan)"📦 reinstallnode - Clean and reinstall Node.js dependencies"(set_color normal)
        echo "Usage: reinstallnode"
        echo "This function removes node_modules, .next, dist, .vite, and out folders,"
        echo "then reinstalls dependencies using bun."
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

        # Main logic
        log "Cleaning project..."

        remove_folder node_modules
        remove_folder .next
        remove_folder dist
        remove_folder .vite
        remove_folder out

        if ! command -v bun >/dev/null 2>&1; then
            error "bun is not installed or not in PATH"
            exit 1
        fi

        log "Reinstalling dependencies with bun..."
        command bun install && success "Dependencies reinstalled with bun"

        success "Project cleaned and ready!"

    ' -- $argv
end
