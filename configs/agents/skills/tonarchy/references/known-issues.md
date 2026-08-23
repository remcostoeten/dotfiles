# Tonarchy known issues

Found by review of the tree at commit `88c889f`. Verify a given item still
applies before acting on it — line numbers drift.

These are **landmines and pre-existing bugs**, not a task list. Two uses: don't
copy the broken patterns into new code, and don't waste a 10-minute build cycle
rediscovering one. If a fix is in scope for your task, fix it; otherwise leave
it and mention it.

## Will bite you while developing

**`make release` is broken.** `LATEST_ISO := $(shell ls -t out/*.iso …)` is
expanded when the Makefile is parsed, not when the recipe runs. `release: build`
therefore evaluates it *before* the build, and on a clean tree it's empty →
"No ISO found after build". Same latent problem in `test`/`test-nvme` if `out/`
was empty at parse time. Workaround: `make build` then `make release`, or move
the `ls -t` into the recipe shell.

**`make build-container` overwrites `/etc/containers/policy.json`.**
`src/build_iso.c:333` unconditionally writes `{"default":[{"type":"insecureAcceptAnything"}]}`
over the host's file, with no backup and no restore. That is a machine-wide
podman trust setting. Back it up before running that target, or use `make build`
(native) on an Arch host.

**`./vm-test` does not exist.** `make test-nix` and the flake's shellHook both
invoke it; it's in `.gitignore` and untracked. The NixOS test path is broken on
a fresh clone — use the `make test` QEMU line as the reference for what it
should do.

**`make test` picks Secure Boot firmware and may not boot.** The probe is
`find … -name "OVMF_CODE*.fd" | grep x64 | head -1`, which on a standard Arch
`edk2-ovmf` layout returns `OVMF_CODE.secboot.4m.fd` — then pairs it with the
*non*-secboot `OVMF_VARS.4m.fd`. Mismatched pair, and Secure Boot firmware
won't boot an unsigned archiso. Symptom: VM appears dead and looks like a
broken ISO. Filter with `grep -v secboot` and match the `4m` suffix on both.
`./retest.sh` and `./vm-test` already do this correctly.

**QEMU targets hard-require KVM.** `-cpu host -enable-kvm -machine accel=kvm`
with no TCG fallback. In a container or nested VM without `/dev/kvm` these fail;
say so rather than reporting the change as untested-but-probably-fine.

## Bugs in the installer

**Arrow keys cancel every menu.** `select_from_menu` (`src/tonarchy.c:400`)
returns `-1` on `c == 27`, but arrows arrive as `ESC [ A`. The `c == 65 / 66`
checks below are unreachable for arrows — they match literal `A`/`B`. So ↑ or ↓
aborts mode selection, disk selection, and wifi selection. A fix reads the two
following bytes when `c == 27` and only treats a bare ESC (nothing pending) as
cancel.

**`CHECK_OR_FAIL` in `main()` returns success.** The macro ends in `return 0`,
which is correct for the 1/0 helpers but is the *success* exit status from
`main`. `src/tonarchy.c:1651-1660` uses it for partition/pacstrap/configure/
bootloader — all of which exit 0 on failure. Don't add more `CHECK_OR_FAIL` in
`main`; check explicitly and `return 1`.

**Desktop configuration failure is silent.** `configure_xfce(username);` and
`configure_oxwm(username);` (`:1655`, `:1661`) discard their return values, so a
failed OXWM clone/build still prints "Installation complete!". Both already
return 1/0 correctly — only the call sites are wrong.

**Uninitialized stack reads in wifi scan.** `src/tonarchy.c:462` declares
`ssid`/`signal`/`security` and only assigns them `if (token)`, then
unconditionally reads `strlen(ssid)` and `strlen(security)`. A short or
malformed `nmcli` line reads garbage. Initialize to `""`.

**Box-drawing glyphs in the large logo render as `+`, `-`, `|`.** Observed on a
real boot at 1280x800 (160 cols → `TERM_LARGE`). The `█` blocks in `logo_large`
(`src/tonarchy.c:314`) render correctly, but the `╔ ═ ╗ ║ ╚ ╝` characters
degrade to ASCII approximations — the console font set by
`.automated_script.sh` (`setfont ter-v32b`) doesn't map them. Cosmetic only,
and invisible unless you actually boot the ISO. `logo_medium` is built almost
entirely from those same glyphs, so it is likely worse at 45–74 cols.

**Layout is only half-responsive.** Menus use `get_menu_start_row(cols)`, but
`draw_form` (`:589`), `partition_disk`, `install_packages_impl`,
`configure_system_impl`, `install_bootloader`, `configure_xfce`,
`configure_oxwm` and the completion screen all hardcode rows 10/11/12. Below 45
columns these overlap the logo. Commit `8946f98` fixed the logo sizing and
didn't revisit the screens.

**Root gets the user's password.** `:1201-1202` pipes both `user:pass` and
`root:pass` to `chpasswd`. Possibly intentional; undocumented in the README.

**`use_dm` is dead.** `configure_system_impl`'s last parameter is passed `0` at
both call sites, and `lightdm` is in neither package list, so the
`systemctl enable lightdm` branch (`:1226`) is unreachable.

**picom config lands on XFCE installs.** `setup_common_configs` copies
`assets/picom` for both modes, but `picom` is only in `OXWM_PACKAGES`. Harmless,
just dead config.

**`get_root_uuid` hardcodes partition 3** (`:1242`). Only correct under UEFI —
which is currently its only caller, so not live, but it will break the moment
BIOS needs a UUID or the layout changes.

**Ctrl-C is disabled during text input.** `read_line` clears `ISIG` (`:646`).
Intentional-looking, but there's no other way out of a field.

**`show_message` always sleeps 2s** (`:443`), including on the success path of
every step — several unavoidable seconds per install.

## Dead / unwired code

- `detect_container_runtime()` and `check_distrobox_exists()` — `src/build_iso.c:128,138`.
  Defined, exported in the header, never called. So `--container distrobox`
  against a nonexistent container fails deep in the build instead of up front.
- `Git_Repo` struct in `src/tonarchy.h:44` — never used.
- `walls/` entirely — `walls/wall1.jpg` duplicates `assets/wallpapers/wall1.jpg`,
  and the 13 `walls/packages/*.txt` files are referenced by nothing. Skeleton for
  the roadmap's DIY mode.
- `iso/packages.x86_64` ships `gcc`, `make`, `git`, `squashfs-tools` in the live
  env; the installer doesn't use them there (OXWM builds inside the chroot).

## Fragility

- **5 hardcoded mirrors** in `iso/airootfs/etc/pacman.d/mirrorlist`, no
  `reflector`. If they're slow or down, `pacstrap` is slow or dead with no
  in-installer recovery.
- **Container commands are single-quote-wrapped** (`src/build_iso.c:92`) — any
  command containing a `'` breaks.
- **Inconsistent privilege** in the container path: static build uses
  `sudo podman`, `run_command_in_container` uses bare `podman`.
- **ANSI usage is half-migrated** — `tonarchy.h` defines `ANSI_*` macros,
  `draw_form` uses them, everything else hardcodes `"\033[37m"`.
- **`flake.nix` claims `aarch64-linux`** though musl-static + archiso make the
  pipeline x86_64-only.
- **No CI at all.** `.github/` is just `FUNDING.yml`. Nothing validates a PR.
