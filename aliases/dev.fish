#!/usr/bin/env fish

# Development aliases

# DOCSTRING: Run pnpm
alias p pnpm

# DOCSTRING: Install dependencies with pnpm
alias pi "pnpm install"

# DOCSTRING: Run development server with pnpm (alternative)
alias rr "pnpm run dev"

# DOCSTRING: Build with pnpm
alias bb "pnpm run build"

# DOCSTRING: Start the app with Bun
alias rs "bun run start"

# DOCSTRING: Run development server with Bun
alias r "bun run dev"

# DOCSTRING: Install dependencies with Bun
alias i "bun install"

# DOCSTRING: Build the app with Bun
alias b "bun run build"

# NO DOCSTRING: Run tauri dev via bun 
alias tauri="bun tauri dev"

# DOCSTRING: Run tauri dev via bun 
alias t="ports 1420 && bun tauri dev"

# DOCSTRING: Run tauri dev via pnpm
alias rt='pnpm tauri dev'

# DOCSTRING: Open files with Neovim
function v
    nvim $argv
end

# DOCSTRING: Open files with Neovim
function vi
    nvim $argv
end

# DOCSTRING: Open files with Vim
function vim
    vim $argv
end

# DOCSTRING: Run `bun dev:all
alias da "bun dev:all"

# DOCSTRING: Deploy to Vercel
alias deploy "vercel deploy"

# DOCSTRING: Deploy to Vercel production
alias prod "vercel deploy --prod"

# DOCSTRING: Run advanced unused code analyzer
alias unused unused-analyzer

# DOCSTRING: Run unused import analyzer in current directory
alias cleanimports "unused-analyzer --type typescript --path ."

# DOCSTRING: Dry run unused import analysis
alias checkimports "unused-analyzer --type typescript --path . --dry-run"

# DOCSTRING: Chmod +x $argv
function allow
    chmod +x $argv
end

# DOCSTRING: Bring up the regeljelease profile stack in ~/dev/work/website-2022
function rjl
    docker compose --project-directory ~/dev/work/website-2022 --profile regeljelease up $argv
end

# DOCSTRING: Docker helper. Run `dock` for usage. Manage the daemon, kill containers, reset the website-2022 stack
function dock
    set -l website ~/dev/work/website-2022
    switch "$argv[1]"
        case daemon
            switch "$argv[2]"
                case up
                    sudo systemctl start docker
                case down
                    sudo systemctl stop docker
                case '*'
                    echo "dock daemon <up|down>"
                    return 1
            end
        case containers
            switch "$argv[2]"
                case up
                    set -l stopped (docker ps -aq -f status=exited -f status=created)
                    if test -z "$stopped"
                        echo "No stopped containers"
                        return 0
                    end
                    docker start $stopped
                case down
                    set -l running (docker ps -q)
                    if test -z "$running"
                        echo "No running containers"
                        return 0
                    end
                    docker stop $running
                case '*'
                    echo "dock containers <up|down>"
                    return 1
            end
        case compose
            switch "$argv[2]"
                case up
                    docker compose up $argv[3..-1]
                case down
                    docker compose down $argv[3..-1]
                case '*'
                    echo "dock compose <up|down>"
                    return 1
            end
        case website
            switch "$argv[2]"
                case reset
                    docker compose --project-directory $website down -v
                    docker compose --project-directory $website up
                case '*'
                    echo "dock website <reset>"
                    return 1
            end
        case '' help -h --help
            echo "dock <command>"
            echo ""
            echo "  daemon up         start the Docker daemon"
            echo "  daemon down       stop the Docker daemon"
            echo "  containers up     start all stopped containers"
            echo "  containers down   stop all running containers"
            echo "  compose up        docker compose up in the current directory"
            echo "  compose down      docker compose down in the current directory"
            echo "  website reset     tear down website-2022 (containers + volumes), then bring it back up"
        case '*'
            echo "dock: unknown command '$argv[1]' (try: dock)"
            return 1
    end
end
