# Dotfiles

Personal Linux dotfiles, shell bootstrap, setup automation, and terminal tools.

This repo is meant to take a fresh or existing Linux machine from base install to a usable development environment. The setup script detects `apt` or `pacman`, installs the default package set, links the managed configs, installs Fish, builds Ghostty from source, and configures the matching desktop path for the current session.

It is primarily Fish-first, but Bash, Zsh, and POSIX shell startup still have a shared minimal runtime so the repo is not locked to Fish forever.

## Preview

The setup script installs the desktop and shell baseline, while the repo also ships a set of daily terminal commands:

| Area | Included |
| --- | --- |
| Shell | Fish config, Starship prompt, shared PATH/runtime setup, Bash/Zsh fallback bootstrap |
| Terminal | Ghostty source build, Ghostty config, launcher defaults that prefer Ghostty |
| Desktop | Auto-detected GNOME, KDE, or Hyprland configuration path |
| Dev tools | GitHub CLI, lazygit, lazydocker, Docker, Node, pnpm, Bun, Rust, Python, uv |
| Config links | Managed symlinks for Fish, Git, Ghostty, Rofi, Neovim, Zed, Cursor, Hyprland, Waybar, Dunst, and related configs |
| User commands | `dotfiles`, `launcher`, `todo`, `copy`, `ports`, `db`, `wallpaper`, `spellcheck`, `license`, `create-oauth`, `generate-turso-db` |

Example command surface:

```bash
dotfiles symlinks
launcher --mode
todo list --upcoming
copy tree -L 2
ports 3000
db turso
create-oauth google
generate-turso-db interactive
```

This repo is organized around a small set of stable entrypoints:

- `bin/` for user-facing commands on `PATH`
- `scripts/` for command implementations
- `setup/` for installation and machine bootstrap
- `configs/` for application config that gets linked into place
- `tools/` for shell integration per tool or domain
- `vendor/` for shared shell bootstrap code

## Install

Clone the repo to the expected location and run the setup script:

```bash
git clone https://github.com/remcostoeten/dotfiles ~/.config/dotfiles
cd ~/.config/dotfiles
./setup/setup.sh
```

The installer supports `apt` and `pacman`.

Common options:

```bash
./setup/setup.sh --dry-run
./setup/setup.sh --verbose
./setup/setup.sh --category desktop
./setup/setup.sh --package starship
```

The setup script can also auto-detect the desktop environment and configure the matching desktop path. Fish is installed during setup and set as the default shell after installation finishes.

Ghostty is built from source during setup.

## What Setup Does

The installer handles three things:

1. Package installation by category or package name
2. Symlinking the managed config set into `~/.config` and related locations
3. Shell and desktop setup for the current machine

It does not symlink every file under `configs/`. It only manages the curated links the setup script owns.

## Default Install Set

The default `./setup/setup.sh` run installs these groups in order:

| Category | Installs |
| --- | --- |
| `essential` | `git`, `curl`, `wget`, `build-essential`, `ca-certificates`, `gnupg`, `software-properties-common`, `fish` |
| `langs` | `python3`, `python3-pip`, `python3-venv`, `nodejs`, `npm`, `pnpm`, `bun`, `rustup`, `.NET` |
| `tools` | `neovim`, `vim`, `ripgrep`, `fd`, `fzf`, `zoxide`, `eza`, `bat`, `htop`, `tree`, `jq` |
| `curl-tools` | `starship`, `fnm`, `rustup`, `uv` |
| `npm-tools` | `vercel`, `gemini` |
| `git-tools` | `gh`, `lazygit`, `lazydocker` |
| `editors` | `zed`, `vscode`, `opencode` |
| `terminals` | `ghostty` built from source |
| `docker` | `docker.io`, `docker-compose` |
| `system` | `fastfetch`, `btop` |
| `hardware` | GPU and RGB helpers |
| `media` | `vlc`, `spotify` |
| `fonts` | bundled font installs |
| `desktop` | auto-detects the current desktop and runs only that matching configuration |

The default run covers the full general-purpose install set. For desktop setup, it checks the current session first through `XDG_CURRENT_DESKTOP`, `XDG_SESSION_DESKTOP`, `DESKTOP_SESSION`, and Hyprland-specific environment. It then runs only the matching desktop path. `gnome`, `kde`, and `hyprland` remain available as explicit categories when you want to force one desktop path directly.

## Shells

Fish is the primary shell.

- Fish bootstraps from `vendor/fish/bootstrap.fish`
- Fish runtime loads `cfg` and the Fish-side tool modules
- Bash, Zsh, and plain POSIX shells use the shared `vendor/sh/bootstrap.sh`

The shared shell layer is intentionally minimal. It exists so Bash and Zsh can keep working without duplicating the full Fish runtime.

## Dotfiles CLI

The `dotfiles` CLI is the interactive front end for browsing tools and config from this repo.

```bash
dotfiles --help
dotfiles links
dotfiles symlinks
dotfiles search <term>
dotfiles config show
dotfiles config set <key> <value>
```

`dotfiles links` and `dotfiles symlinks` show the managed symlinks the setup script owns, along with their status.

## User Commands

Most commands follow the same pattern: the implementation lives in `scripts/`, and `bin/` provides the stable command name that belongs on `PATH`. The table below lists the commands worth using directly; helper files, notification handlers, generated support scripts, and one-off internals are intentionally left out.

| Command | Purpose | Docs | Example |
| --- | --- | --- | --- |
| `launcher` | Rofi-based app, file, and command launcher | [configs/rofi/README.md](configs/rofi/README.md) | `launcher --mode` |
| `powermenu` | Session power actions | `-` | `powermenu` |
| `dotfiles` | Browse repo tools, config, and managed symlinks | `-` | `dotfiles symlinks`<br>`dotfiles search ports` |
| `todo` | Todo list and shell-display helpers | [scripts/todo.js](scripts/todo.js) | `todo list --upcoming`<br>`todo count`<br>`todo "Task" 15pm` |
| `copy` | Clipboard helper for files, paths, git remotes, and trees | [scripts/copy](scripts/copy) | `copy pwd`<br>`copy remote`<br>`copy tree -L 2` |
| `timer` | Command execution timer | `-` | `timer bun run build`<br>`timer -r 5 "npm test"` |
| `alarm` | Alarm launcher and alarm state helpers | `-` | `alarm --in 15m` |
| `wallpaper` | Wallpaper selection and rotation | [scripts/wallpaper](scripts/wallpaper) | `wallpaper help`<br>`wallpaper r`<br>`wallpaper o` |
| `db` | Database connection manager and helper UI | [scripts/db](scripts/db) | `db connections`<br>`db connect postgres`<br>`db turso` |
| `secret` | Local secret manager | [scripts/secret](scripts/secret) | `secret --add`<br>`secret -v`<br>`secret --help` |
| `ui` | UI toolkit for component transforms and analysis | [scripts/ui](scripts/ui) | `ui transform src/components/UserCard.tsx`<br>`ui toolkit --help` |
| `create` | Smart file and directory creation helper | [scripts/create](scripts/create) | `create src/utils/file.ts`<br>`create components/button/`<br>`create --history 25` |
| `fastfetch-startup` | Startup banner runner | `-` | `fastfetch-startup` |
| `commit` | Commit helper CLI | `-` | `commit --help` |
| `spellcheck` | Text fixer using provider CLI, stdin, or interactive input | [scripts/spellcheck](scripts/spellcheck) | `spellcheck "teh quik"`<br>`echo "smple" \| spellcheck`<br>`spellcheck --history` |
| `license` | Generate MIT license to clipboard or path | `-` | `license --project Dotfiles`<br>`license --project Dotfiles --path LICENSE` |
| `unused` | Unused file or code cleanup helper | `-` | `unused --help` |
| `gc` | Cleanup and garbage-collection helper | `bin/gc` | `gc fix navbar spacing`<br>`gc --all refactor git helper`<br>`gc -n test parser bin/gc` |
| `ports` | Port and process manager for dev servers and profiles | [scripts/ports](scripts/ports) | `ports 3000`<br>`ports --dry-run 3000`<br>`ports profile fullstack` |
| `generate-turso-db` | Latest upstream Turso database generator | [upstream](https://github.com/remcostoeten/Turso-db-creator-auto-retrieve-env-credentials) | `generate-turso-db --help`<br>`generate-turso-db interactive` |
| `create-oauth` | Latest upstream OAuth app automator | [upstream](https://github.com/remcostoeten/oauth-app-automator) | `create-oauth`<br>`create-oauth github`<br>`create-oauth google` |
| `docker-manager` | Docker management UI | [scripts/docker/README.md](scripts/docker/README.md) | `docker-manager`<br>`docker-manager help`<br>`docker-manager list` |
| `ascii-gen` | ASCII art generator | `-` | `ascii-gen --help` |
| `minimal-shell` | Minimal shell config launcher | `-` | `minimal-shell status` |
| `display` | Display-related helper command | `-` | `display help`<br>`display brightness eDP-1 80`<br>`display rotate eDP-1 right` |
| `sweepjs` | JavaScript cleanup helper | `-` | `sweepjs --help` |
| `android-emulator` | Android emulator manager and app launcher | [docs/android-emulator.md](docs/android-emulator.md) | `android-emulator status`<br>`android-emulator start` |
| `scripts` | Script selector and launcher for repo tools | [scripts/scripts](scripts/scripts) | `scripts --help` |
| `gif-converter` | Video-to-GIF conversion helper | [scripts/gif-converter](scripts/gif-converter) | `gif-converter list`<br>`gif-converter help` |
| `img-convert` | Image conversion and batch processing helper | [scripts/img-convert](scripts/img-convert) | `img-convert --help` |
| `remove-comments` | Source comment removal helper | [scripts/remove-comments.js](scripts/remove-comments.js) | `remove-comments --help` |

### Remote-Backed Tools

`generate-turso-db` and `create-oauth` are wrappers around their upstream repositories. On each run they clone or update the checkout under `~/.local/share/dotfiles/github-tools/`, then execute the upstream entrypoint. Override that cache location with `DOTFILES_GITHUB_TOOLS_DIR` when needed.

`create-oauth` defaults to the GitHub OAuth flow. Use `create-oauth github` or `create-oauth --github` to make that explicit. Use `create-oauth google` or `create-oauth --google` for the Google OAuth flow.

### Spellcheck

`spellcheck` is a small Python CLI. It takes text from an argument, stdin, or an interactive prompt. By default it sends that text to the configured provider CLI, then prints the corrected result, copies it to the clipboard when a clipboard backend exists, and writes a history entry under `~/.dotfiles/spellcheck/`.

Useful forms:

```bash
spellcheck "teh quik"
echo "smple text" | spellcheck
spellcheck --history
```

## Repository Layout

- `bin/` contains small launchers that call into `scripts/`
- `configs/` contains app-specific config, including Fish, Ghostty, Rofi, Hyprland, GNOME, Zed, Cursor, and others
- `scripts/` contains the actual command implementations and utilities
- `scripts/lib/` contains support code used by the commands, not standalone commands
- `setup/` contains package installation, symlink setup, desktop detection, and shell setup
- `tools/` contains shell module files sourced by the runtime bootstrap
- `vendor/` contains the shared shell core and bootstrap logic

## Private Files

Local-only runtime files are kept outside version control:

- `~/.dotfiles/` for runtime data and local state

## Manual Use

If you do not want the full installer, the key manual pieces are:

```bash
export PATH="$HOME/.config/dotfiles/bin:$PATH"
export PATH="$HOME/.config/dotfiles/scripts:$PATH"
ln -s ~/.config/dotfiles/configs/fish/config.fish ~/.config/fish/config.fish
```

For shells other than Fish, source the shared bootstrap from your shell startup file.

## Notes

- Use `--dry-run` first if you want to see what the installer would do.
- Use `--category` when you want a subset instead of the full machine setup.
- Use `--package` when you only want one package.
- `./setup/setup.sh --help` shows the current installer surface.
