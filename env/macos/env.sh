#!/usr/bin/env bash

# macOS-specific Environment Configuration

# --- Package Manager ---
export PKG_MANAGER="brew"
export PKG_INSTALL="brew install"
export PKG_UPDATE="brew update"
export PKG_UPGRADE="brew upgrade"

# --- macOS-specific Paths ---
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:$PATH"

# Homebrew paths (Intel vs Apple Silicon)
if [[ $(uname -m) == "arm64" ]]; then
  # Apple Silicon
  export HOMEBREW_PREFIX="/opt/homebrew"
else
  # Intel Mac
  export HOMEBREW_PREFIX="/usr/local"
fi

export PATH="$HOMEBREW_PREFIX/bin:$HOMEBREW_PREFIX/sbin:$PATH"
export MANPATH="$HOMEBREW_PREFIX/share/man:$MANPATH"
export INFOPATH="$HOMEBREW_PREFIX/share/info:$INFOPATH"

# --- Python Path (Homebrew) ---
if [ -d "$HOMEBREW_PREFIX/opt/python@3.11/libexec/bin" ]; then
  export PATH="$HOMEBREW_PREFIX/opt/python@3.11/libexec/bin:$PATH"
fi

# --- Java (if installed via Homebrew) ---
if [ -d "$HOMEBREW_PREFIX/opt/openjdk/bin" ]; then
  export PATH="$HOMEBREW_PREFIX/opt/openjdk/bin:$PATH"
  export JAVA_HOME="$HOMEBREW_PREFIX/opt/openjdk"
fi

# --- macOS-specific Environment ---
export BROWSER="${BROWSER:-open}"
export ARCHFLAGS="-arch $(uname -m)"

# --- Colors and Terminal ---
export TERM="${TERM:-xterm-256color}"
export CLICOLOR=1
export LSCOLORS="ExFxBxDxCxegedabagacad"

# --- macOS-specific Aliases ---
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'

# System management
alias sysupdate='brew update && brew upgrade && brew cleanup'
alias sysinfo='system_profiler SPSoftwareDataType'
alias ports='netstat -an | grep LISTEN'
alias processes='ps aux | head -20'

# macOS-specific utilities
alias flushdns='sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder'
alias showfiles='defaults write com.apple.finder AppleShowAllFiles YES && killall Finder'
alias hidefiles='defaults write com.apple.finder AppleShowAllFiles NO && killall Finder'
alias screensaver='open -b com.apple.ScreenSaver.Engine'
alias emptytrash='sudo rm -rfv /Volumes/*/.Trashes && sudo rm -rfv ~/.Trash && sudo rm -rfv /private/var/log/asl/*.asl'

# Quick access to system locations
alias desktop='cd ~/Desktop'
alias downloads='cd ~/Downloads'
alias documents='cd ~/Documents'

# --- Finder Integration ---
alias finder='open -a Finder'
alias preview='open -a Preview'
alias textedit='open -a TextEdit'

# --- macOS Development ---
# Xcode Command Line Tools
if [ -d "/Applications/Xcode.app/Contents/Developer" ]; then
  export DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
fi

# --- macOS-specific Functions ---
# Open current directory in Finder
cdf() {
  target=$(osascript -e 'tell application "Finder" to if (count of Finder windows) > 0 then get POSIX path of (target of front Finder window as string)')
  if [ "$target" != "" ]; then
    cd "$target"
    pwd
  else
    echo 'No Finder window found' >&2
  fi
}

# Quick Look
ql() {
  qlmanage -p "$*" >& /dev/null
}

# --- Notification Integration ---
notify() {
  osascript -e "display notification \"$1\" with title \"Terminal\""
}

# --- GPU Detection (for development) ---
if system_profiler SPDisplaysDataType 2>/dev/null | grep -q "Apple"; then
  export GPU_TYPE="apple_silicon"
elif system_profiler SPDisplaysDataType 2>/dev/null | grep -q "AMD"; then
  export GPU_TYPE="amd"
elif system_profiler SPDisplaysDataType 2>/dev/null | grep -q "NVIDIA"; then
  export GPU_TYPE="nvidia"
else
  export GPU_TYPE="intel"
fi
