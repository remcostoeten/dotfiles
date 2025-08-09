#!/usr/bin/env fish
function restartnode
    # Check for help flag
    if test (count $argv) -eq 1 -a "$argv[1]" = --help -o "$argv[1]" = --h -o "$argv[1]" = -h
        echo (set_color --bold cyan)"🚀 restartnode - Clean, reinstall, and start development server"(set_color normal)
        echo "Usage: restartnode"
        echo "This function removes node_modules, .next, dist, .vite, and out folders,"
        echo "reinstalls dependencies using bun, starts the dev server, and opens browser."
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

        if ! command -v bun > /dev/null 2>&1; then
            error "bun is not installed or not in PATH"
            exit 1
        fi

        log "Reinstalling dependencies with bun..."
        command bun install && success "Dependencies reinstalled with bun"

        log "Starting development server..."
        command bun run dev &
        dev_pid=$!

        # Wait for server to start and detect port
        log "Waiting for development server to start..."
        sleep 3

        # Try to detect port from common dev server ports or process
        port=""
        for attempt in {1..10}; do
            # Check common development ports
            for p in 3000 5173 4173 8080 3001; do
                if lsof -i :$p > /dev/null 2>&1; then
                    port=$p
                    break 2
                fi
            done
            sleep 1
        done

        if [ -z "$port" ]; then
            # Fallback: try to extract port from process
            port=$(lsof -i -P -n | grep LISTEN | grep -E "(node|bun|vite)" | head -1 | awk "{print $9}" | grep ":" | cut -d ":" -f 2 | head -1)
        fi

        if [ -n "$port" ]; then
            log "Opening browser at http://localhost:$port"
            brave-browser "http://localhost:$port" > /dev/null 2>&1 &
        else
            log "Could not detect port, please check your browser manually"
        fi

        success "Project cleaned and started!"

    ' -- $argv
end
