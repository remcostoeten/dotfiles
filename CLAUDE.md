# CLAUDE.md

Three related repositories make up this dotfiles setup. They are separate projects.

## Projects

- **dotfiles** (`remcostoeten/dotfiles`, this repo, lives at `~/.config/dotfiles`): the main Linux dotfiles. Fish-first shell config, setup scripts (`setup/`), linked app configs (`configs/`), user commands on PATH (`bin/`, implemented in `scripts/`), shell integrations (`tools/`), and small apps (`apps/`).
- **dotfiles-tooling** (`remcostoeten/dotfiles-tooling`, private): a container repo that pins standalone tools as git submodules: `dotgraph`, `keybind-manager`, `shellforge`.
- **dotfiles-env-private** (`remcostoeten/dotfiles-env-private`, private): personal environment variables (`env` file) and `.ssh`, used as a submodule of the main dotfiles. Contains sensitive values.

## Scope rule

Only read and change files in the project the user names. "Work on dotfiles" means this repo only; "work on dotfiles-tooling" means that repo only, and so on.

- Do not open, search, or edit the other two projects unless the user asks for it.
- If a task seems to need a change in another project, stop and ask first.
- Never read or print values from `dotfiles-env-private` unless explicitly asked.
