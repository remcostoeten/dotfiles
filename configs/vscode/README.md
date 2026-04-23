# VS Code / Cursor / Antigravity Configs (Source of Truth)

This directory serves as the single **source of truth** for configuration files that are shared between VS Code, Cursor, and Antigravity.

## Structure

- `settings.json`: The core editor settings.
- `keybindings.json`: Custom keyboard shortcuts.
- `.cursorrules`: Rules and instructions for AI agents (respected by Cursor and Antigravity).

## How it works

The other environments (Cursor and Antigravity) are set up to use symlinks that point back to this `vscode` directory. This ensures that any change you make here will instantly apply across all of your development tools without needing to duplicate files.

If you need to make a change, **always make it in this directory** (`~/.config/dotfiles/configs/vscode`).
