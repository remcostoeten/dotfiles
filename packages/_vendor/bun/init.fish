# DOCSTRING: Configure Bun runtime path for Fish shells

set -gx BUN_INSTALL $HOME/.bun
if test -d "$BUN_INSTALL/bin"
    add_to_path $BUN_INSTALL/bin
end
