# DOCSTRING: Configure pnpm runtime path for Fish shells

set -gx PNPM_HOME "$HOME/.local/share/pnpm"
if test -d "$PNPM_HOME"
    add_to_path $PNPM_HOME
end
