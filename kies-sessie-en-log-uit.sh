#!/usr/bin/env bash

choice="$(kdialog --title 'Kies volgende sessie' --menu 'Waar wil je naartoe?' plasma 'Plasma (Wayland)' hyprland 'Hyprland')" || exit 0

case "$choice" in
  plasma)
    kdialog --msgbox 'Je wordt uitgelogd. Kies bij het inloggen Plasma (Wayland).'
    ;;
  hyprland)
    kdialog --msgbox 'Je wordt uitgelogd. Kies bij het inloggen Hyprland.'
    ;;
  *)
    exit 0
    ;;
esac

loginctl terminate-session "$XDG_SESSION_ID"
