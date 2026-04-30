# Rofi launcher

The launcher filters desktop apps as you type. Prefix searches and custom
bang commands run only after you press Enter, because rofi script mode calls the
launcher when you submit a custom query.

## Prefix searches

Use these prefixes in the launcher search box:

- `:` opens launcher commands.
- `/` opens folder scopes.
- `/path query` searches filenames inside `/path`.
- `*.md` searches matching filenames under your home directory.
- `**text` searches file contents under your home directory with `rg`.

Search result screens show how many results are visible, the configured result
limit, and the timeout. Defaults are 80 results and 3 seconds.

## Pinned apps

Pinned apps come from `~/.config/rofi/pinned-apps`. The first three valid
entries appear in the **Pinned** section.

To edit pinned apps from the launcher:

1. Open the launcher.
2. Type `:`.
3. Press Enter.
4. Select **Pinned apps: edit top 3**.

## Bang commands

Bang commands come from `~/.config/rofi/bang-commands.lua`. A bang command is a
Lua table entry that starts with `!`. Type the bang, add any argument text after
it, and press Enter.

For example, this command opens a web search:

```lua
return {
  {
    bang = "!web",
    type = "url",
    template = "https://www.google.com/search?q={query}",
    description = "Search the web",
  },
}
```

Typing `!web rofi themes` opens the configured URL with `rofi+themes` replacing
`{query}`.

Supported command types are:

- `url`: Opens the URL with `xdg-open`. The launcher URL-encodes `{query}`.
- `shell`: Runs the command with `sh -lc`. The launcher shell-quotes `{query}`.
- `terminal`: Runs the command in `$TERMINAL`, or `ghostty` when `$TERMINAL` is
  unset. The launcher shell-quotes `{query}`.

To edit bang commands from the launcher:

1. Open the launcher.
2. Type `:`.
3. Press Enter.
4. Select **Bang commands: edit ! shortcuts**.

## Config menu

Use `:config` to work with launcher config files. The launcher offers:

- `:config` to open a config picker inside rofi.
- `:config nvim` to open the config files in `nvim`.
- `:config vim` to open the config files in `vim`.
- `:config code` to open the config files in VS Code.
- `:config zed` to open the config files in Zed.
- `:config nano` to open the config files in `nano`.

The config picker lists both live files and repo templates so you can open the
same setting from either place.

<!-- prettier-ignore -->
> [!CAUTION]
> Bang commands can run arbitrary shell commands. Only add commands you trust,
> especially for `shell` and `terminal` entries.

## Configuration files

The launcher reads live user files first and falls back to the dotfiles
templates when a live file does not exist.

- `~/.config/rofi/pinned-apps`
- `~/.config/rofi/bang-commands.lua`
- `~/.config/rofi/launcher.conf`
- `configs/rofi/pinned-apps`
- `configs/rofi/bang-commands.lua`
- `configs/rofi/launcher.conf`
