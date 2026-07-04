#!/usr/bin/env fish

# DOCSTRING: Reboot system
alias reboot 'sudo reboot now'

# DOCSTRING: Power off system
alias poweroff 'sudo poweroff'

# DOCSTRING: Boot into BIOS/UEFI
alias bios 'sudo systemctl reboot --firmware-setup'

# DOCSTRING: Run the fantasy launcher with sudo and append all output to a log
function fantasy
    set -l log_dir "$HOME/.local/state/fantasy"
    set -l log_file "$log_dir/fantasy.log"

    mkdir -p "$log_dir"

    printf "%s\n" "111" | sudo -S -p "" "$HOME/Downloads/fantasy.earthbound.out" $argv 2>&1 | tee -a "$log_file"
    set -l statuses $pipestatus
    return $statuses[2]
end

# DOCSTRING: Fix GNOME mouse/input issues by restarting GNOME Shell without logging out
alias restartgnome 'command restartgnome'
