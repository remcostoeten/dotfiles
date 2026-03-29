# Vendor Runtime Layer

This directory contains runtime integration snippets for third-party tools.

## Rules

- `setup/` installs tools
- `packages/_vendor/` wires installed tools into the shell session
- `cfg` is the orchestrator that sources vendor snippets
- Keep tool-specific glue here instead of scattering it across `cfg` or `configs/fish/config.fish`

## Conventions

- Use one directory per tool: `packages/_vendor/<tool>/`
- Use `init.sh` for POSIX-compatible shell setup
- Use `init.fish` only when Fish needs its own syntax or behavior
- Keep each directory focused on one tool
- Prefer idempotent path/env setup
- Prefer shared `init.sh` files for Bash and Zsh compatibility
- Keep Fish as a thin adapter layer where possible

## Layout

```text
packages/_vendor/
  bun/
    init.fish
    init.sh
  cargo/
    init.fish
    init.sh
  golang/
    init.fish
    init.sh
  kiro/
    init.fish
  nvm/
    init.sh
  pnpm/
    init.fish
    init.sh
```

## Loader Model

- Fish loads `packages/_vendor/<tool>/init.fish` when present
- Bash and Zsh should load `packages/_vendor/<tool>/init.sh`
- `nvm` remains a shell bridge case and is loaded through `init.sh`
