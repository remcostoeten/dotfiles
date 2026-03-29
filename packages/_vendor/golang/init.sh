#!/usr/bin/env sh
# DOCSTRING: Configure Go runtime path for POSIX-compatible shells

if [ -d "$HOME/go/bin" ]; then
    case ":$PATH:" in
        *":$HOME/go/bin:"*) ;;
        *) export PATH="$HOME/go/bin:$PATH" ;;
    esac
fi
