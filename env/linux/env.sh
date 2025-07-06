#!/usr/bin/env bash

# Linux-specific Environment Configuration

# --- Package Manager Detection ---
if command -v apt-get >/dev/null 2>&1; then
  export PKG_MANAGER="apt"
  export PKG_INSTALL="sudo apt-get install -y"
  export PKG_UPDATE="sudo apt-get update"
  export PKG_UPGRADE="sudo apt-get upgrade -y"
elif command -v yum >/dev/null 2>&1; then
  export PKG_MANAGER="yum"
  export PKG_INSTALL="sudo yum install -y"
  export PKG_UPDATE="sudo yum update"
  export PKG_UPGRADE="sudo yum upgrade -y"
elif command -v dnf >/dev/null 2>&1; then
  export PKG_MANAGER="dnf"
  export PKG_INSTALL="sudo dnf install -y"
  export PKG_UPDATE="sudo dnf update"
  export PKG_UPGRADE="sudo dnf upgrade -y"
elif command -v pacman >/dev/null 2>&1; then
  export PKG_MANAGER="pacman"
  export PKG_INSTALL="sudo pacman -S --noconfirm"
  export PKG_UPDATE="sudo pacman -Sy"
  export PKG_UPGRADE="sudo pacman -Syu --noconfirm"
elif command -v zypper >/dev/null 2>&1; then
  export PKG_MANAGER="zypper"
  export PKG_INSTALL="sudo zypper install -y"
  export PKG_UPDATE="sudo zypper refresh"
  export PKG_UPGRADE="sudo zypper update -y"
fi

# --- Linux-specific Paths ---
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

# --- Display and Graphics ---
export DISPLAY="${DISPLAY:-:0}"
export XAUTHORITY="${XAUTHORITY:-$HOME/.Xauthority}"

# --- Desktop Environment Detection ---
if [ -n "$XDG_CURRENT_DESKTOP" ]; then
  export DESKTOP_ENV="$XDG_CURRENT_DESKTOP"
elif [ -n "$DESKTOP_SESSION" ]; then
  export DESKTOP_ENV="$DESKTOP_SESSION"
elif [ -n "$GNOME_DESKTOP_SESSION_ID" ]; then
  export DESKTOP_ENV="gnome"
elif [ -n "$KDE_FULL_SESSION" ]; then
  export DESKTOP_ENV="kde"
fi

# --- Wayland Support ---
if [ "$XDG_SESSION_TYPE" = "wayland" ]; then
  export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}"
  export GDK_BACKEND="wayland,x11"
  export QT_QPA_PLATFORM="wayland;xcb"
  export SDL_VIDEODRIVER="wayland"
  export CLUTTER_BACKEND="wayland"
fi

# --- Linux-specific Aliases ---
alias ll='ls -alF --color=auto'
alias la='ls -A --color=auto'
alias l='ls -CF --color=auto'
alias ls='ls --color=auto'
alias grep='grep --color=auto'
alias fgrep='fgrep --color=auto'
alias egrep='egrep --color=auto'

# System management
alias sysupdate='$PKG_UPDATE && $PKG_UPGRADE'
alias sysinfo='uname -a && lsb_release -a 2>/dev/null || cat /etc/os-release'
alias ports='netstat -tuln'
alias processes='ps aux | head -20'

# Disk usage
alias df='df -h'
alias du='du -h'
alias free='free -h'

# --- Systemd Integration ---
if command -v systemctl >/dev/null 2>&1; then
  alias sysstatus='systemctl status'
  alias sysstart='sudo systemctl start'
  alias sysstop='sudo systemctl stop'
  alias sysrestart='sudo systemctl restart'
  alias sysenable='sudo systemctl enable'
  alias sysdisable='sudo systemctl disable'
  alias syslogs='journalctl -f'
fi

# --- Snap Integration ---
if command -v snap >/dev/null 2>&1; then
  export PATH="/snap/bin:$PATH"
fi

# --- Flatpak Integration ---
if command -v flatpak >/dev/null 2>&1; then
  export PATH="/var/lib/flatpak/exports/bin:$HOME/.local/share/flatpak/exports/bin:$PATH"
fi

# --- AppImage Integration ---
if [ -d "$HOME/Applications" ]; then
  export PATH="$HOME/Applications:$PATH"
fi

# --- Linux Development ---
export MANPAGER="less -R --use-color -Dd+r -Du+b"
