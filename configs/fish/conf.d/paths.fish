if test -d "$HOME/.bun/bin"
    set -gx BUN_INSTALL "$HOME/.bun"
    fish_add_path "$HOME/.bun/bin"
end

if test -d "$HOME/.local/share/fnm"
    set -gx FNM_DIR "$HOME/.local/share/fnm"
    fish_add_path "$HOME/.local/share/fnm"
end

if test -d "$HOME/.local/share/pnpm"
    set -gx PNPM_HOME "$HOME/.local/share/pnpm"
    fish_add_path "$PNPM_HOME"
    if test -d "$PNPM_HOME/bin"
        fish_add_path "$PNPM_HOME/bin"
    end
end

if test -d "$HOME/.cargo/bin"
    fish_add_path "$HOME/.cargo/bin"
end
