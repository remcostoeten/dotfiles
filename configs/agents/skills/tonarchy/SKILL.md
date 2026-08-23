---
name: tonarchy
description: >-
  Work on Tonarchy — the zero-dependency Arch Linux installer written in C
  (github.com/tonybanters/tonarchy). Use this for ANY change to that repo:
  adding or editing packages in an install mode, adding dotfiles/configs to an
  installed system, adding a new install mode (Wayland/Niri/MangoWC, DIY,
  encrypted disk), changing the TUI, changing partitioning or bootloader logic,
  editing the archiso profile in iso/, building the ISO, testing it in QEMU, or
  preparing a PR. Trigger on "tonarchy", "build the ISO", "add a package to
  beginner/oxidized mode", "test the installer", "XFCE mode", "OXWM mode",
  "airootfs", "mkarchiso", or when working anywhere under a checkout containing
  src/tonarchy.c and iso/profiledef.sh. Do NOT use for generic Arch install
  help, generic archiso projects, or unrelated C work.
---

# Tonarchy

An Arch installer: ~1700 lines of C driving a raw-ANSI TUI, shipped as a static
binary inside an archiso profile. No ncurses, no libraries.

**Read `references/architecture.md` before your first edit in a session.** It is
the file-by-file map. Read `references/known-issues.md` before touching the TUI,
`main()`, `make release`, or the container build — several landmines there will
otherwise waste a build cycle (and a build cycle is ~10 minutes).

## The two layers — pick the right one first

Almost every task is one of these. Getting this wrong is the most common failure.

| You want to change… | Layer | Edit |
|---|---|---|
| What's on the **booted USB** (live env) | ISO | `iso/packages.x86_64`, `iso/airootfs/**` |
| What's **installed onto the user's machine** | Installer | `src/tonarchy.c` |
| How the USB boots / ISO metadata | ISO | `iso/profiledef.sh`, `iso/syslinux/`, `iso/efiboot/` |
| Config files dropped into the new user's `$HOME` | Both | `assets/**` (staged) + `src/tonarchy.c` (copied) |

The live env does *not* inherit installer packages, and vice versa. `assets/` is
staged into the ISO at `/usr/share/tonarchy/` by `build_iso`, then copied out of
there into `/mnt/home/$USER/` by the installer. Both halves are required for a
config file to land.

## Build and test loop

Prerequisites on Arch: `archiso musl edk2-ovmf qemu-full`. Builds need sudo.

```bash
make build                  # native; ~10 min, writes out/*.iso
make build-container        # podman instead — SEE known-issues, clobbers host config
make test                   # boot newest ISO in UEFI QEMU vs a 20G scratch disk
make test-nvme              # same, disk attached as NVMe (exercises part_path)
make test-disk              # reboot the INSTALLED result — proves post-install works
make clean-vm               # throw away test-disk.qcow2 + OVMF_VARS.fd
```

**Never claim a change works without booting the ISO.** A build succeeding
proves nothing about the installer; the installer only runs on tty1 of a booted
ISO.

### Testing it yourself, headlessly (do this — don't ask the user to watch a VM)

`make test` opens a GUI window you cannot see. Use `./retest.sh` instead (local,
gitignored, not part of the repo). It boots QEMU headless with a monitor socket,
which lets you **screenshot the guest as a real PNG and inject keystrokes** —
with no sshd, no serial console, and no changes to the repo or ISO.

```bash
./retest.sh boot            # ~90s to reach the form; pacman-key dominates
./retest.sh shot form       # -> /tmp/tonarchy-shots/form.png   (Read it)
./retest.sh type "tester"   # types into the focused field
./retest.sh key ret
./retest.sh keys j j ret    # menu navigation — use j/k, NOT arrow keys
./retest.sh mon "info block"
./retest.sh stop
```

Read the resulting PNG with the Read tool; it renders. This is a genuine
closed loop — you can drive the installer to completion and verify each screen.

Gotchas: allow ~90s after `boot` before the first `shot` or you'll capture an
empty framebuffer. QEMU's `screendump` emits **PPM**, not PNG despite the
filename — `retest.sh shot` converts via imagemagick, but if you call
`screendump` directly you must convert before reading. Menus need `j`/`k`;
arrow keys cancel (see known-issues).

Test both firmware paths when you touch partitioning, bootloader, or `part_path`
— UEFI and BIOS take completely different code paths (`sgdisk`+systemd-boot vs
`parted`+GRUB) and only UEFI is covered by the Makefile targets.

Two logs matter, both readable after a failed run:
- `/tmp/build_iso.log` — host side, ISO build
- `/tmp/tonarchy-install.log` — inside the live env; also copied to
  `/mnt/var/log/tonarchy-install.log` on success. Every `system()` call in the
  installer appends stderr here. This is where a failed `pacstrap` explains itself.

Fast inner loop for pure-TUI work: `make && ./tonarchy` compiles the installer
natively. It will try to partition a real disk if you go past the menus — stop
at the form. For anything past disk selection you need the VM.

## Code conventions (match these, the repo is consistent)

- **`1` = success, `0` = failure.** Not errno, not negative. Every helper.
- Wrap fallible steps in `CHECK_OR_FAIL(expr, "user-facing message")`. It logs
  the expression, shows the message for 2s, and returns 0 — so it is only valid
  inside a function whose `0` means failure. **It is currently misused in
  `main()`; see known-issues before adding more there.**
- Types are `Capital_Snake_Case` (`Log_Level`, `Systemd_Override`, `Build_Config`).
- File-local functions are `static`. Anything cross-file goes in the header.
- Shell out with `system()` / `popen()` into fixed `snprintf` buffers. That is
  the established style — don't introduce `fork`/`exec` plumbing.
- Log with `LOG_INFO` / `LOG_ERROR` / `LOG_WARN`. Append `2>> /tmp/tonarchy-install.log`
  to raw `system()` commands so failures are diagnosable.
- **No explanatory comments.** The codebase has essentially zero. Don't add any.
- Prefer the existing helpers over open-coding: `chroot_exec_fmt`,
  `chroot_exec_as_user_fmt`, `create_user_dotfile`, `setup_systemd_override`,
  `write_file_fmt`, `git_clone_as_user`.

Screen-drawing idiom, follow it exactly:

```c
int rows, cols;
get_terminal_size(&rows, &cols);
clear_screen();
draw_logo(cols);
int logo_start = get_logo_start(cols);
printf("\033[%d;%dH\033[37mDoing the thing...\033[0m", 10, logo_start);
fflush(stdout);
```

New screens should use `get_menu_start_row(cols)` rather than the hardcoded
row `10` most existing screens use — that hardcoding is a known bug, don't
propagate it.

## Recipes

`references/recipes.md` has step-by-step for the common tasks:
adding a package to a mode, adding a dotfile, adding a whole new install mode,
adding something to the live ISO env, and changing the disk layout. Read the
relevant one — each lists every file that must change in lockstep, and several
of them are non-obvious (adding a mode touches 4 places).

## Before you hand back

1. `make` compiles clean — `-std=c23 -Wall -Wextra`, **zero new warnings**.
2. `make build` produces an ISO.
3. `make test` boots it and the affected path actually runs to completion.
4. `make test-disk` if you changed anything post-`pacstrap`.
5. Report honestly which of these you ran. If you could not run the VM (no KVM,
   no sudo), say so plainly and say what remains unverified — do not imply a
   change is confirmed working because it compiled.

## PR notes

Upstream is `tonybanters/tonarchy`; `origin` is that repo directly, so fork and
re-point before pushing. There is no CI, no PR template, no CONTRIBUTING — your
own testing is the entire quality gate. Roadmap items explicitly wanted:
MangoWC/Niri Wayland mode, encrypted disk, multi-disk, DIY mode. Note that
`walls/packages/*.txt` is the unused skeleton of a modular package system —
prefer wiring that up over adding a third hardcoded package string.
