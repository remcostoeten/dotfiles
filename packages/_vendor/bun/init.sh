#!/usr/bin/env sh
# DOCSTRING: Configure Bun runtime path for POSIX-compatible shells

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
if [ -d "$BUN_INSTALL/bin" ]; then
    case ":$PATH:" in
        *":$BUN_INSTALL/bin:"*) ;;
        *) export PATH="$BUN_INSTALL/bin:$PATH" ;;
    esac
fi
