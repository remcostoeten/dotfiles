# Tunnel

Expose a local dev server to the internet via a temporary [Cloudflare Quick Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) (`*.trycloudflare.com`). Run it from any directory inside a git repo; it auto-detects the project root and (usually) the port.

## What it does

1. Walks up from `$PWD` to find the nearest `.git` directory (project root).
2. Guesses the local port from `package.json` scripts or from common dev-server ports that are currently listening.
3. Starts `cloudflared tunnel --url http://localhost:<port>`.
4. Shows the public URL and an interactive status line with keyboard shortcuts.

No Cloudflare account or DNS setup is required for quick tunnels.

Missing required dependencies are **installed automatically** on first run (may prompt for `sudo` on Linux).

## Requirements

| Tool | Required | Purpose |
|------|----------|---------|
| `cloudflared` | Yes | Creates the tunnel |
| `open` (macOS) or `xdg-open` (Linux) | Yes | Open URL in browser (`o`) |
| `pbcopy` (macOS) / `wl-copy` / `xclip` / `xsel` | Optional | Copy URL to clipboard (`c`) |
| `lsof` (macOS) or `ss` / `lsof` (Linux) | Optional | Port auto-detection |
| `python3` | Optional | Parse `package.json` for port hints |
| Bash 3.2+ | Yes | Works with macOS system Bash |

### Auto-install

If `cloudflared` is missing, the script installs it via:

| Platform | Method |
|----------|--------|
| macOS | `brew install cloudflared` (Homebrew required) |
| Arch | `pacman -S cloudflared`, or `yay`/`paru -S cloudflared-bin` |
| Debian/Ubuntu | Latest `.deb` from Cloudflare GitHub releases |
| Fedora/RHEL | Latest `.rpm` from Cloudflare GitHub releases |

On Linux, `xdg-utils` is also auto-installed when `xdg-open` is missing.

Clipboard tools are optional and not auto-installed. On macOS, `pbcopy` and `open` are built in.

## Install (without cloning dotfiles)

```bash
curl -fsSL https://raw.githubusercontent.com/remcostoeten/dotfiles/master/scripts/tunnel/install.sh | bash
```

Installs `tunnel` to `~/.local/bin`. Override the location:

```bash
INSTALL_DIR=/usr/local/bin curl -fsSL https://raw.githubusercontent.com/remcostoeten/dotfiles/master/scripts/tunnel/install.sh | bash
```

Uninstall:

```bash
curl -fsSL https://raw.githubusercontent.com/remcostoeten/dotfiles/master/scripts/tunnel/install.sh | bash -s -- --uninstall
```

If `~/.local/bin` is not in your PATH, the installer detects your shell (`zsh`, `fish`, `bash`, etc.) and prompts to append the right line to `~/.zshrc`, `config.fish`, `~/.bashrc`, or similar. Use `TUNNEL_YES=1` to accept without prompting.

## Usage

```bash
tunnel           # auto-detect port
tunnel <port>    # explicit port
```

Run from inside your project (or any subdirectory). Start your dev server first.

### Examples

```bash
cd ~/projects/my-app
npm run dev          # e.g. Vite on 5173
tunnel               # detects 5173

tunnel 3000          # Next.js
tunnel 4321          # Astro
tunnel 1420          # Tauri
```

### Arguments

| Argument | Description |
|----------|-------------|
| `[port]` | Local HTTP port to expose. If omitted, auto-detection runs (see below). |

There are no flags; behavior is controlled via interactive keys once the tunnel is running.

## Port auto-detection

1. **package.json** — scans npm script values for `dev`, `preview`, `start`, or `serve`, then picks the first 4–5 digit port number in those scripts.
2. **Listening ports** — checks, in order: `5173`, `3000`, `4321`, `8000`, `8080`, `1420`, `5174`, `3001`, `5000`, `8787`, `8001` via `lsof` on macOS or `ss`/`lsof` on Linux.

If nothing matches, the script prints common ports and exits with usage hints.

### Common ports

| Port | Typical stack |
|------|----------------|
| 5173 | Vite, React, Svelte, Vue |
| 3000 | Next.js, Nuxt, Gatsby |
| 4321 | Astro |
| 8000 | Python, Laravel |
| 8080 | HTTP alternative |
| 8001 | Docker, PHP |
| 1420 | Tauri |

## Interactive controls

While the tunnel runs, a status line is shown. Press:

| Key | Action |
|-----|--------|
| `q` | Quit and stop `cloudflared` |
| `r` | Restart tunnel (new public URL) |
| `c` | Copy public URL to clipboard |
| `o` | Open public URL in default browser |

`Ctrl+C` also stops the tunnel (cleanup trap).

## Layout

```
scripts/tunnel/
├── tunnel       # main script
├── install.sh   # curl installer
└── README.md
```

Symlinked from dotfiles bin:

```
bin/tunnel -> ../scripts/tunnel/tunnel
```

## Notes

- Quick tunnel URLs are temporary and change on restart.
- The public URL is only valid while the script is running.
- Project name in the header is `basename` of the detected git root.
