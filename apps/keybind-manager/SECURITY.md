# Security model

## Principles

- The GUI always runs unprivileged. There is no permanently privileged
  process; keyd itself is the only daemon involved.
- Privilege escalation happens exclusively through polkit (`pkexec`) invoking
  `keybind-manager-helper`, a small dedicated binary with a fixed action
  allowlist. There is no generic "run command as root" channel.
- No shell is ever invoked with constructed strings; all processes are spawned
  with argument arrays.
- Nothing is downloaded or executed from the network. Package installation is
  presented as copyable commands the user runs deliberately.

## Threat model

Untrusted inputs and how they are constrained:

| Input | Constraint |
| --- | --- |
| Tauri command payloads | deserialized into strict types; config passes `migrate()` + schema-version check before use |
| Imported TOML bundles | ≤ 1 MiB, must live in `$HOME`, symlinks rejected, schema version checked, then re-validated like any edit |
| Helper stdin payload | ≤ 1 MiB, ≤ 32 files, filenames must match the managed pattern (no `/`, no `..`), content null-byte-free |
| Existing `/etc/keyd` files | only files matching `keybind-manager*.conf` are ever read/written/removed; symlinks are refused |
| Key/layer/macro names | validated against the keyd key table; macro text may not contain `)` or newlines, preventing config injection |

## Privileged helper hardening

- Fixed paths only: `/etc/keyd` and `/etc/keyd/.keybind-manager-backup`.
- Atomic writes: temp file in the destination filesystem, `fsync`, rename,
  directory sync; mode 0600, owner root.
- Backup before every write; automatic restore + reload when the post-write
  service verification fails, so a broken config never stays active.
- External-change detection: the app records SHA-256 hashes of what it last
  applied; the helper refuses to overwrite files whose hashes changed unless
  the user explicitly forces it.
- The polkit policy pins `org.freedesktop.policykit.exec.path` to the
  installed helper and requires admin authentication.

## Residual risks

- A root attacker can trivially bypass all of this (out of scope).
- keyd config errors that pass validation but change typing behavior are
  mitigated by dangerous-mapping warnings (Enter/Escape/all-Controls etc.)
  and by rollback-on-failed-reload, not eliminated.
- The AppImage cannot ship the polkit policy; privileged actions are disabled
  there unless the helper is installed natively (documented limitation).

Report vulnerabilities via the repository issue tracker or by mail.
