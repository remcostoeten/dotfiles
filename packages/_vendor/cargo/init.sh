#!/usr/bin/env sh
# DOCSTRING: Configure Cargo and Rustup runtime path for POSIX-compatible shells

if [ -d "$HOME/.cargo/bin" ]; then
    case ":$PATH:" in
        *":$HOME/.cargo/bin:"*) ;;
        *) export PATH="$HOME/.cargo/bin:$PATH" ;;
    esac
fi
