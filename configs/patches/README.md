# OS-level patches

Small, targeted fixes applied at the operating-system level (not in app config),
usually to work around hardware or driver quirks. Each patch is self-contained and
documented here.

---

## `keyd-zoom65-ctrl-capslock-swap.conf` — fix swapped Ctrl / Caps Lock on the Zoom65

### The problem

On the **UBEST / Meletrix Zoom65 wireless** keyboard, pressing **Left Ctrl** triggers
**Caps Lock**, and pressing **Caps Lock** triggers **Left Ctrl**. The two keys are
swapped *inside the keyboard's own firmware*, so it happens no matter which computer
or OS you plug it into.

The proper fix is to reflash/edit the keyboard's firmware (VIA/Vial). This patch is
the OS-level alternative: it intercepts the keyboard with [`keyd`](https://github.com/rvaiorabbit/keyd)
and swaps the two keys back, so you don't have to touch firmware.

### Why it's safe for your other keyboards

The patch is **scoped to this one keyboard** by its USB id:

```
Device : UBEST zoom65 wireless
USB id : 1ea7:7777   (Vendor=1ea7  Product=7777)
```

keyd only grabs/remaps devices listed in the `[ids]` block. Every other keyboard
(laptop built-in, a second board, etc.) is passed through untouched.

### How it works

`keyd` is a system daemon that sits between the kernel and your keyboard. The config:

```
[ids]
1ea7:7777          # only this keyboard

[main]
capslock     = layer(control)  # the key labelled Caps now acts as a real Ctrl
leftcontrol  = capslock        # the key labelled Ctrl now acts as Caps Lock
```

`layer(control)` (rather than a plain `= leftcontrol`) makes the Caps key behave as
a proper held modifier, so Caps+C correctly produces Ctrl+C.

Because the firmware already swapped them, swapping them a second time here puts
each key back to what its label says.

The same file also carries two unrelated fixes for this board: `rightalt = esc`
(the physical Esc key is broken), and a *click key* — a key that sends a mouse
button instead of its normal keystroke.

---

## The click key — `clickkey`

The physical Esc key being dead is not the only casualty on this board; the click
key exists so a mouse button is reachable from the keyboard. It defaults to the
right arrow sending a left click, but the key and the button are both changeable,
and the whole thing can be switched off without touching the config by hand.

```bash
clickkey                      # status
clickkey off                  # right arrow goes back to being an arrow
clickkey on
clickkey toggle
clickkey set rightalt         # rebind to any key
clickkey set f13 middlemouse  # ...and any button
clickkey button right         # change only the button
clickkey keys mouse           # list valid keyd key names, filtered
```

`clickkey` owns a marked region inside the `.conf`:

```
# >>> clickkey (managed block — use the `clickkey` CLI, do not hand-edit) >>>
# clickkey-state: key=right button=leftmouse enabled=yes
right = leftmouse
# <<< clickkey <<<
```

Edit the rest of the file freely; just leave that block to the CLI. Turning the
remap off comments the mapping out but keeps the state line, so `clickkey on`
restores the same key and button.

Every change is validated with `keyd check` before `keyd reload`, and the previous
file is restored if keyd rejects it — a typo can't leave you with a dead keyboard.
`set` also refuses a key already bound elsewhere in `[main]` (keyd resolves
duplicate left-hand sides unpredictably) and any name `keyd list-keys` doesn't know.

Editing the file is unprivileged since it lives in dotfiles; only the reload needs
root, which `clickkey` calls via `sudo` on its own.

---

## Install

Requires `keyd` (already installed) and root for the symlink + reload.

```bash
sudo /home/remcostoeten/.config/dotfiles/configs/patches/install.sh
```

That script:
1. symlinks this `.conf` to `/etc/keyd/zoom65.conf`
2. runs `keyd reload`
3. confirms keyd has grabbed the Zoom65

It's idempotent — safe to re-run (e.g. on a fresh machine after cloning dotfiles).

### Manual install (if you prefer)

```bash
sudo ln -sf /home/remcostoeten/.config/dotfiles/configs/patches/keyd-zoom65-ctrl-capslock-swap.conf \
            /etc/keyd/zoom65.conf
sudo keyd reload
```

---

## Verify it worked

1. **keyd loaded the config without errors:**
   ```bash
   systemctl status keyd          # should be active, no error lines
   journalctl -u keyd -b | tail   # no "failed to parse" / error messages
   ```

2. **keyd is managing the Zoom65:**
   ```bash
   sudo keyd list-keyboards       # the Zoom65 should appear in the list
   ```

3. **Behavioural test (you press the keys):**
   ```bash
   sudo keyd monitor              # Ctrl-C to quit
   ```
   With keyd's remap active, `keyd monitor` shows the **raw firmware output**, so for
   sanity you can also just open a text editor and:
   - press the key **labelled Ctrl** + C in a terminal → should send SIGINT (Ctrl works)
   - tap the key **labelled Caps Lock** → the Caps Lock LED/indicator should toggle

   If Ctrl acts like Ctrl and Caps acts like Caps, the patch is working.

---

## Uninstall

```bash
sudo rm /etc/keyd/zoom65.conf
sudo keyd reload
```

The keyboard then reverts to its (swapped) firmware behaviour.

---

## Troubleshooting

- **No change after install:** make sure the keyd service is running
  (`systemctl enable --now keyd`) and that `sudo keyd list-keyboards` shows the board.
- **Wireless dongle vs USB cable:** if the USB id differs when wired vs wireless,
  run `sudo keyd monitor`, note the id keyd prints for the device, and add it to the
  `[ids]` block (one id per line).
- **Whole keyboard feels dead:** a syntax error stops keyd remapping. Check
  `journalctl -u keyd -b`, fix the `.conf`, then `sudo keyd reload`.
