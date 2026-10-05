# pc

System manager TUI: GPU sensors and tuning, processes, OpenRGB lighting,
audio/bluetooth/media and temperatures/brightness/login session. Scaffolded
from [reusable-tui](https://github.com/remcostoeten/reusable-tui).

## Run

    make run          # or: make install → ../../bin/pc

`pc <screen>` opens a screen directly (`proc`/`ram`, `rgb`, `audio`, `sys`);
`bin/gpu` is a symlink that opens the GPU screen. `1`–`5` jump between
screens, `ctrl+r` refreshes now, everything else is in `ctrl+k` and `?`.

## Layout

    cmd/pc/main.go            entrypoint: config, logging, runtime
    internal/app/app.go       composition root
    internal/app/register.go  the module list — one line per screen
    internal/modules/*/       the five screens, plus live (refresh loop, shared verbs)
    internal/pc/*/            machine access: nvidia-smi, ps, openrgb, pactl, ddcutil…
    internal/pc/pcfake/       deterministic System for tests
    internal/tui/             the shell; you rarely edit this

Adding a screen is a directory under `internal/modules` and a line in
`register.go`. A module registers its routes, commands, key bindings and
status items into a `Registrar`; the command palette, the help overlay and
the status bar are generated from that registry, so a verb you add shows up in
all three without being listed anywhere else.

`app.Build` freezes the registry and reports duplicate routes, malformed
bindings and keymap conflicts before the first frame is drawn.

## Keys

`tab` cycles focus · `v` badges every region and jumps to the one you press ·
`alt+hjkl` moves geometrically · `[` and `]` change section · `ctrl+k` opens the
palette · `?` lists every command · `ctrl+t` cycles `dark`, `dim`, `high-contrast`
and `ascii` · `q` quits.

## Development

    make test     # go test ./...
    make lint     # golangci-lint run ./...
    make build    # bin/pc

`internal/tui/boundaries_test.go` enforces the layering: the shell never
imports a module, the runtime never imports the shell.
