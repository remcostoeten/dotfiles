#!/usr/bin/env fish

# Development aliases

# DOCSTRING: Run pnpm
alias p "pnpm"

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

# DOCSTRING: Open files with Neovim
function v
    nvim $argv
end

# DOCSTRING: Open files with Neovim (vi alias)
function vi
    nvim $argv
end

# DOCSTRING: Open files with Neovim (vim alias)
function vim
    nvim $argv
end

# DOCSTRING: Deploy to Vercel
alias deploy "vercel deploy"

# DOCSTRING: Deploy to Vercel production
alias prod "vercel deploy --prod"

# DOCSTRING: Deploy to Vercel production (alternative)
alias deployprod "vercel deploy --prod"

# DOCSTRING: Run advanced unused code analyzer
alias unused "unused-analyzer"

# DOCSTRING: Run unused import analyzer in current directory
alias cleanimports "unused-analyzer --type typescript --path ."

# DOCSTRING: Dry run unused import analysis
alias checkimports "unused-analyzer --type typescript --path . --dry-run"
