# Tonarchy architecture — file by file

## Pipeline

```
make build
  └─ build_iso (from src/build_iso.c)
       1. musl-gcc -static src/tonarchy.c -o tonarchy-static
       2. rm -rf iso/airootfs/usr, iso/airootfs/root/tonarchy   (regenerated, gitignored)
       3. rm -rf /tmp/tonarchy_iso_work
       4. stage:  tonarchy-static  -> iso/airootfs/usr/local/bin/tonarchy
                  assets/*         -> iso/airootfs/usr/share/tonarchy/
                  assets/wallpapers-> iso/airootfs/usr/share/wallpapers/
                  chown -R root:root iso/airootfs/usr
       5. sudo mkarchiso -v -w /tmp/tonarchy_iso_work -o out/ iso/
       6. clean workdir, sync, report out/*.iso
```

Boot path on the USB: archiso autologins root on tty1 → `~/.bash_profile` →
`~/.automated_script.sh` → `setfont ter-v32b`, `pacman-key --init/--populate` →
`/usr/local/bin/tonarchy` → on exit drops to bash.

## `src/tonarchy.h` (124 lines)

Feature-test macros, all libc includes, `CHROOT_PATH "/mnt"`, `MAX_CMD_SIZE 4096`,
`ANSI_*` colour macros, and the public helper API. Types:

- `Log_Level` — DEBUG/INFO/WARN/ERROR
- `Dotfile { filename, content, permissions }` — declarative `$HOME` file
- `Config_Entry { key, value }` — empty value means "emit key verbatim as a line"
- `Systemd_Override { service_name, drop_in_dir, drop_in_file, entries, count }`
- `Tui_Field` — display-only form row
- `Form_Field { dest, default_val, Input_Type, cursor_offset, error_msg }` — input spec
- `Git_Repo` — declared, never used

`CHECK_OR_FAIL(expr, msg)` lives here.

## `src/tonarchy.c` (1692 lines)

Read in this order; it is laid out bottom-up.

**Helpers, 9–256.** `part_path` (`:9`) appends `p1` vs `1` by testing whether the
disk name ends in a digit — correct for `sda`, `nvme0n1`, `mmcblk0`. Logging.
`write_file{,_fmt}`, `set_file_perms` (chroot-aware: rewrites `/mnt/x` paths to
`arch-chroot /mnt chown … /x`), `create_directory`, `chroot_exec{,_fmt}`,
`chroot_exec_as_user{,_fmt}` (wraps in `sudo -u`), `git_clone_as_user`,
`make_clean_install`, `create_user_dotfile`, `setup_systemd_override`.

**TUI, 259–444.** `enable_raw_mode`/`disable_raw_mode` (termios, `atexit`-restored),
`get_terminal_size` (TIOCGWINSZ), size categories `TERM_SMALL <45 <TERM_MEDIUM <75
<= TERM_LARGE`, three hardcoded ASCII logos, `draw_menu`, `select_from_menu`
(j/k + Enter; **see known-issues re: arrow keys**), `show_message` (prints, then
unconditional `sleep(2)`).

**Networking, 446–571.** `check_internet_connection` pings 1.1.1.1.
`list_wifi_networks` parses `nmcli -t -f SSID,SIGNAL,SECURITY`. `connect_to_wifi`
does its own echo-off password read. `setup_wifi_if_needed` short-circuits if
already online; on failure the installer just exits (no retry loop).

**Form, 573–853.** `draw_form` renders six rows from a `Tui_Field[]`.
`get_form_input` drives a `Form_Field[]` state machine: username → password
(`handle_password_entry` reads + confirms, jumps to field 3) → hostname →
keyboard (`fzf` over `localectl list-keymaps`, default `us`) → timezone (`fzf`
over `timedatectl list-timezones`, mandatory). Then a review loop where `0`–`5`
re-edits a field and Enter accepts. `validate_alphanumeric` allows `[A-Za-z0-9_-]`.
`read_line` clears `ISIG`, so Ctrl-C is disabled during input.

**Disk, 855–1084.** `select_disk` lists via `lsblk` + awk, then requires typing
literally `yes`. `partition_disk` branches on `is_uefi_system()` (stat
`/sys/firmware/efi`):

- UEFI: `wipefs -af` → `sgdisk --zap-all` → 1G `ef00` EFI, 4G `8200` swap, rest
  `8300` root → `mkfs.fat -F32` / `mkswap` / `mkfs.ext4 -F` → mount root at
  `/mnt`, EFI at `/mnt/boot`, `swapon`.
- BIOS: `wipefs -af` → `parted mklabel msdos`, 4G swap + rest ext4, `set 2 boot on`
  → root is **partition 2**, swap is partition 1.

**Install, 1086–1371.** `install_packages_impl` = one `pacstrap -K /mnt $LIST`.
`configure_system_impl` = fstab, timezone symlink, `hwclock`, locale.gen +
locale-gen + locale.conf (hardcoded `en_US.UTF-8`), vconsole, hostname, hosts,
`useradd -m -G wheel`, `chpasswd` via popen (**sets root to the same password**),
`sudoers.d/wheel` at 0440, enable NetworkManager + dbus. `get_root_uuid` blkids
**partition 3** — only correct for UEFI, which is the only caller.
`install_bootloader`: UEFI → `bootctl install` + hand-written `loader.conf` and
`entries/arch.conf` with `root=UUID=`; BIOS → pacman grub, `grub-install
--target=i386-pc`, `grub-mkconfig`.

**Desktop, 1373–1604.** `setup_common_configs` (both modes): wallpaper, favicon,
Tokyonight-Dark theme, Firefox profile + policies + a custom `.desktop` that
forces `--profile $HOME/.config/firefox`, then alacritty/rofi/fastfetch/picom
configs, then clones `github.com/tonybanters/nvim`, then a blanket `chown -R`.
`setup_autologin` writes the getty@tty1 drop-in. `BASHRC_CONTENT` /
`BASH_PROFILE_CONTENT` are string constants (the latter `exec startx` on VT1).
`configure_xfce`: copies `assets/xfce4`, three dotfiles, `.xinitrc` = `exec
startxfce4`. `configure_oxwm`: clones `tonybanters/oxwm`, `zig build
-Doptimize=ReleaseSmall`, installs to `/usr/bin/oxwm`, GTK 2/3/4 configs,
`config.lua` from the repo's `templates/`, `.xinitrc` with picom + xwallpaper +
`exec oxwm`.

**`main`, 1606–1692.** wifi → form → mode menu → disk → the mode branch → copy
install log to `/mnt/var/log/` → Enter → `sync` → `reboot &`.

## `src/build_iso.c` (520 lines)

Own logger (stdout + `/tmp/build_iso.log`), `run_command` = `system()` wrapper
returning 1/0, `run_command_in_container` (distrobox `enter -- sh -c '…'` or
`podman run --rm --privileged` with `/src /profile /out /work` mounts).
`build_tonarchy_static` has three paths (podman / distrobox / native).
`clean_airootfs`, `clean_work_dir` (umount -R then rm -rf, then `sync; sleep 1`),
`prepare_airootfs` (the staging in the pipeline above), `run_mkarchiso`,
`run_mkarchiso_in_container`, `find_latest_iso` (`ls -t | head -n1` into a static
buffer). `main` wires it up; flags are `--iso-profile`, `--out-dir`,
`--container [podman|distrobox]`, `--distrobox NAME`.

`detect_container_runtime()` and `check_distrobox_exists()` exist and are never
called.

## `iso/` — archiso profile

- `profiledef.sh` — `iso_name=tonarchy`, label `TONARCHY_YYYYMM`, version
  `YYYY.MM.DD` (from `SOURCE_DATE_EPOCH`), `install_dir=arch`, bootmodes
  `bios.syslinux` + `uefi.systemd-boot`, squashfs zstd-15 512K blocks, and
  `file_permissions` for `/root/.automated_script.sh` (755),
  `/usr/local/bin/tonarchy` (755), `/etc/shadow` + `/etc/gshadow` (400).
- `packages.x86_64` — 25 packages for the **live env only**.
- `pacman.conf` — core + extra, `SigLevel = Required DatabaseOptional`.
- `airootfs/etc/{passwd,shadow,group,gshadow}` — root only, empty password.
- `airootfs/etc/pacman.d/mirrorlist` — 5 hardcoded mirrors, no reflector.
- `airootfs/etc/mkinitcpio.conf.d/archiso.conf` — `HOOKS=(base udev modconf archiso block filesystems keyboard)`.
- `airootfs/etc/systemd/system/getty@tty1.service.d/autologin.conf` — root autologin.
- `airootfs/root/.bash_profile` + `.automated_script.sh` — the launch chain.
- `syslinux/syslinux.cfg`, `efiboot/loader/{loader.conf,entries/tonarchy.conf}` — boot entries.
- `airootfs/usr/` is **generated and gitignored**.

## `assets/`

Staged wholesale to `/usr/share/tonarchy/` on the ISO. `alacritty/`, `rofi/`
(tokyonight rasi), `fastfetch/`, `picom/`, `gtk-3.0/`, `gtk-4.0/`, `gtkrc-2.0`,
`xfce4/` (full xfconf channel XML incl. keybindings), `firefox/default-release/`
(user.js + uBlock/DarkReader/one-more `.xpi`), `firefox-policies/policies.json`,
`Tokyonight-Dark/` (full GTK+xfwm4+cinnamon+gnome-shell theme, vendored),
`wallpapers/wall1.jpg`, `favicon.png`, `tonarchy.png` (README image).

## `walls/` — orphaned

`walls/wall1.jpg` (duplicate of the asset) and `walls/packages/*.txt`: `base`,
`beginner`, `dev_tools`, `docker`, `gaming`, `suckless`, `display_xorg`,
`display_wayland`, `de_gnome`, `de_kde`, `de_cinnamon`, `de_sway`, `de_hyprland`.
One package per line. **Referenced by nothing** — no C, no Makefile, no flake.
Groundwork for the roadmap's DIY mode.

## Build tooling

- `Makefile` — `all`/`static`/`build_iso`/`build`/`build-container`/`test`/
  `test-nvme`/`test-disk`/`test-nix`/`release`/`clean*`. QEMU targets need
  `edk2-ovmf` and copy `OVMF_VARS.fd` locally on first run.
- `flake.nix` — packages/apps `build_iso` (musl static), devShell with gcc,
  glibc.static, make, bear, qemu_kvm, OVMF, podman, distrobox. Declares
  `aarch64-linux` though the pipeline is x86_64-only. References `./vm-test`,
  which is gitignored and absent.
- `.github/` — `FUNDING.yml` only. No CI.
