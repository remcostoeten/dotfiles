# Auto start Hyprland on tty1 for a real interactive login shell.
if status is-interactive; and status is-login; and test -z "$DISPLAY"; and test -z "$WAYLAND_DISPLAY"; and test "$XDG_VTNR" = 1
    mkdir -p ~/.cache
    exec start-hyprland > ~/.cache/hyprland.log 2>&1
end
