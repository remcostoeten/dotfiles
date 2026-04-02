#!/usr/bin/env fish

# DOCSTRING: Reboot system
alias reboot 'sudo reboot now'

# DOCSTRING: Power off system
alias poweroff 'sudo poweroff'

# DOCSTRING: Boot into BIOS/UEFI
alias bios 'sudo systemctl reboot --firmware-setup'

# DOCSTRING: Fix GNOME mouse/input issues by restarting GNOME Shell without logging out
alias restartgnome 'restartgnome'
