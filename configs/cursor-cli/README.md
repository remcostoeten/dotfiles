# Cursor CLI config

Cursor splits config across two locations. Do not symlink this directory over either path.

| Path | Purpose | In dotfiles? |
| --- | --- | --- |
| `~/.config/Cursor/User/` | IDE settings, keybindings, rules | Yes — via `configs/ide/cursor/` → `configs/vscode/` |
| `~/.config/cursor/cli-config.json` | Cursor Agent CLI (model, permissions, status line) | No — machine-local runtime |
| `~/.cursor/cli-config.json` | Legacy/alternate CLI config path | No — keep in sync manually if both exist |

## Status line

Script: `scripts/cursor-statusline` (wrapper: `bin/cursor-statusline`).

Add to whichever `cli-config.json` your CLI reads:

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.config/dotfiles/scripts/cursor-statusline",
    "padding": 2,
    "updateIntervalMs": 500,
    "timeoutMs": 2000
  }
}
```

Test:

```bash
echo '{"model":{"display_name":"Composer 2.5 Fast"},"context_window":{"used_percentage":25},"workspace":{"current_dir":"'"$PWD"'"}}' | cursor-statusline
```

## Note on `configs/cursor`

`dotfiles symlinks` lists `configs/cursor` → `~/.config/cursor`, but that target holds chats, auth, and other runtime data. The managed link is only created when `configs/cursor` exists; keep CLI scripts in `scripts/` instead of symlinking the whole agent data directory.
