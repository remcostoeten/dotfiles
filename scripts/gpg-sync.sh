#!/bin/bash
set -euo pipefail

DOTFILES_DIR="${HOME}/.config/dotfiles"
ENV_PRIVATE_DIR="${DOTFILES_DIR}/env-private"
GPG_STORAGE_DIR="${ENV_PRIVATE_DIR}/.gnupg"
GPG_HOME_DIR="${GNUPGHOME:-$HOME/.gnupg}"
SECRET_KEYS_FILE="${GPG_STORAGE_DIR}/secret-keys.asc"
PUBLIC_KEYS_FILE="${GPG_STORAGE_DIR}/public-keys.asc"
OWNERTRUST_FILE="${GPG_STORAGE_DIR}/ownertrust.txt"
REVOCATIONS_DIR="${GPG_STORAGE_DIR}/openpgp-revocs.d"

backup_keys() {
    if [[ ! -d "$ENV_PRIVATE_DIR" ]]; then
        echo "env-private directory not found at $ENV_PRIVATE_DIR" >&2
        exit 1
    fi

    mkdir -p "$GPG_STORAGE_DIR" "$REVOCATIONS_DIR"
    chmod 700 "$GPG_STORAGE_DIR" "$REVOCATIONS_DIR"

    gpg --armor --export-secret-keys > "$SECRET_KEYS_FILE"
    gpg --armor --export > "$PUBLIC_KEYS_FILE"
    gpg --export-ownertrust > "$OWNERTRUST_FILE"

    chmod 600 "$SECRET_KEYS_FILE" "$OWNERTRUST_FILE"
    chmod 644 "$PUBLIC_KEYS_FILE"

    if [[ -d "$GPG_HOME_DIR/openpgp-revocs.d" ]]; then
        find "$GPG_HOME_DIR/openpgp-revocs.d" -maxdepth 1 -type f -name '*.rev' -exec cp -f {} "$REVOCATIONS_DIR"/ \;
        chmod 600 "$REVOCATIONS_DIR"/*.rev 2>/dev/null || true
    fi

    echo "Backed up GPG keys to $GPG_STORAGE_DIR"
}

restore_keys() {
    if [[ ! -d "$GPG_STORAGE_DIR" ]]; then
        echo "No GPG backup found at $GPG_STORAGE_DIR" >&2
        exit 0
    fi

    mkdir -p "$GPG_HOME_DIR"
    chmod 700 "$GPG_HOME_DIR"

    if [[ -f "$PUBLIC_KEYS_FILE" ]]; then
        gpg --import "$PUBLIC_KEYS_FILE" >/dev/null 2>&1 || true
    fi

    if [[ -f "$SECRET_KEYS_FILE" ]]; then
        gpg --import "$SECRET_KEYS_FILE" >/dev/null 2>&1 || true
    fi

    if [[ -f "$OWNERTRUST_FILE" ]]; then
        gpg --import-ownertrust "$OWNERTRUST_FILE" >/dev/null 2>&1 || true
    fi

    echo "Restored GPG keys from $GPG_STORAGE_DIR"
}

case "${1:-restore}" in
    backup)
        backup_keys
        ;;
    restore)
        restore_keys
        ;;
    *)
        echo "Usage: gpg-sync [backup|restore]" >&2
        exit 1
        ;;
esac
