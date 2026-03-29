# Runtime Vendor Layer Plan

Purpose: document and organize the migration of all third-party shell initializers into `packages/_vendor/` so runtime glue stays in the same prominent location.

## Current Status
- `packages/_vendor/` now exists as the dedicated runtime connector layer.
- `cfg` sources Fish-native vendor snippets from `packages/_vendor/<tool>/init.fish`.
- `nvm` now lives at `packages/_vendor/nvm/init.sh`.
- `bun`, `pnpm`, `cargo`, `golang`, and `kiro` runtime setup now live in per-tool vendor directories.
- `configs/fish/config.fish` is reduced to a thin entrypoint that sources `cfg`.
- Architecture docs now describe `_vendor` as the place for third-party shell integration.
- The vendor layer now supports explicit shell-specific entrypoints with `init.sh` and optional `init.fish`.

## Goals
- Keep `setup/` responsible only for installation, not for runtime wiring.
- Centralize third-party shell snippets (env exports, init scripts, completions) in `packages/_vendor/`.
- Make loaders/configs refer exclusively to `_vendor/` files.
- Document the `_vendor` layer's responsibilities for contributors.

## Workstreams

1. **Inventory**
   - List every reference to `packages/` or similar vendor logic outside `_vendor/` (Fish config, scripts, docs).
   - Identify candidates for migration (nvm, golang, other tool-specific shims/completions).
   - Capture expected runtime behavior per tool.

2. **Consolidation**
   - Move each snippet into `packages/_vendor/<tool>/init.sh` or `packages/_vendor/<tool>/init.fish` as appropriate.
   - Ensure each `_vendor` file contains a short DOCSTRING describing what it does.
   - Adjust `cfg` and other startup scripts to source the new paths.
   - Add helper loader functions if multiple configs need the same snippet (e.g., `load_vendor_tool <name>`).

3. **Documentation**
   - Update architecture docs (`README`, `.cursorrules`, `functions/README`, etc.) to mention `_vendor` as the runtime connector layer.
   - Add a short README inside `packages/_vendor` explaining the naming convention, how to add new snippets, and how `cfg` consumes them.
   - Optionally add a README excerpt to `aliases/` to remind contributors about the `_vendor` directory.

4. **Validation**
   - Run necessary shell checks or lints (e.g., `bash -n` on moved files).
   - Manually source the updated `cfg` or open a Fish shell to ensure `nvm` and other tools still initialize correctly.
   - Verify `setup/` scripts still run without requiring `_vendor` (since they should not source it).

## Next Actions

1. Scan `cfg`, `configs/`, and shell-facing scripts for any remaining inline third-party runtime glue.
2. Normalize vendor file naming where needed so every runtime connector is clearly one-tool-per-file.
3. Decide whether `nvm` should stay as a Bash-driven shim or gain an optional `init.fish` adapter.
4. Add Bash/Zsh entrypoints that load `packages/_vendor/<tool>/init.sh` when those shells are introduced.
5. Add lightweight runtime verification for critical vendor snippets after shell startup changes.
