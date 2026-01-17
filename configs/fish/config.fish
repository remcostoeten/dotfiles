# Fish configuration - sourced from dotfiles cfg
# This file serves as the main entry point for fish configuration
# All actual configuration is maintained in ~/.config/dotfiles/cfg

source ~/.config/dotfiles/cfg
# pnpm
set -gx PNPM_HOME "/home/remco-stoeten/.local/share/pnpm"
if not string match -q -- $PNPM_HOME $PATH
  set -gx PATH "$PNPM_HOME" $PATH
end
# pnpm end

string match -q "$TERM_PROGRAM" "kiro" and . (kiro --locate-shell-integration-path fish)
