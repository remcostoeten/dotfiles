#!/usr/bin/env fish

# Package manager aliases

# ── rig (bun, or pnpm when the project has a pnpm lockfile) ──

# DOCSTRING: Install dependencies with the detected package manager
alias i "rig install"

# DOCSTRING: Start the dev server of the project you are in
alias r "rig dev"

# DOCSTRING: Production build
alias b "rig build"

# DOCSTRING: Install, build, then run the production server
alias rs "rig start"

# DOCSTRING: Run `bun dev:all`
alias da "bun dev:all"

# DOCSTRING: Run tauri dev via Bun
alias tauri "bun tauri dev"

# DOCSTRING: Free port 1420, then run tauri dev via Bun
alias t "ports 1420 && bun tauri dev"

# ── pnpm ─────────────────────────────────────────────

# DOCSTRING: Run pnpm
alias p pnpm

# DOCSTRING: Run tauri dev via pnpm
alias rt "pnpm tauri dev"
