#!/bin/bash

# Common installer functions

# Save progress
save_progress() {
    local category="$1"
    local item="$2"
    local status="$3"

    mkdir -p "$(dirname "$PROGRESS_FILE")"

    if [ ! -f "$PROGRESS_FILE" ]; then
        echo "{}" > "$PROGRESS_FILE"
    fi

    if command_exists jq; then
        local content=$(cat "$PROGRESS_FILE")
        echo "$content" | jq ". + {\"$category\": (.${category} // {}) + {\"$item\": \"$status\"}}" > "$PROGRESS_FILE"
    fi
}

# Check if item was already installed successfully
is_completed() {
    local category="$1"
    local item="$2"

    if [ ! -f "$PROGRESS_FILE" ]; then
        return 1
    fi

    if command_exists jq; then
        local status=$(jq -r ".${category}.${item} // \"\"" "$PROGRESS_FILE" 2>/dev/null)
        [ "$status" = "completed" ]
    else
        grep -q "\"$item\".*\"completed\"" "$PROGRESS_FILE" 2>/dev/null
    fi
}

# Install package using the new format: "name|method|extra|display"
install_package_new() {
    local package_spec="$1"

    # Parse format: "name|method|extra|display"
    IFS='|' read -ra parts <<< "$package_spec"
    local package="${parts[0]}"
    local method="${parts[1]}"
    local extra="${parts[2]}"
    local display="${parts[3]:-$package}"

    if [ "$DRY_RUN" = true ]; then
        print_dry_run "Would install: $display (via $method)"
        return 0
    fi

    if is_completed "packages" "$package"; then
        print_success "$display already installed (skipped)"
        return 0
    fi

    if command_exists "$package" || dpkg -l 2>/dev/null | grep -q "^ii.*$package "; then
        print_success "$display already installed"
        save_progress "packages" "$package" "completed"
        return 0
    fi

    print_status "Installing $display..."

    case "$method" in
        apt)
            if [ "$VERBOSE" = true ]; then
                sudo apt-get install -y "$package"
            else
                sudo apt-get install -y "$package" >/dev/null 2>&1
            fi
            ;;
        snap)
            if command_exists snap; then
                sudo snap install "$package" >/dev/null 2>&1
            else
                print_error "snapd not installed"
                return 1
            fi
            ;;
        curl)
            if [ "$VERBOSE" = true ]; then
                curl -fsSL "$extra" | bash
            else
                curl -fsSL "$extra" | bash >/dev/null 2>&1
            fi
            ;;
        npm)
            if command_exists npm; then
                npm install -g "$package" >/dev/null 2>&1
            elif command_exists pnpm; then
                pnpm add -g "$package" >/dev/null 2>&1
            else
                print_error "npm/pnpm not installed"
                return 1
            fi
            ;;
        github)
            install_from_github "$package" "$extra" "$display"
            return $?
            ;;
        cargo)
            if command_exists cargo; then
                cargo install "$package" >/dev/null 2>&1
            else
                print_error "cargo not installed"
                return 1
            fi
            ;;
        *)
            print_error "Unknown install method: $method"
            return 1
            ;;
    esac

    local result=$?
    if [ $result -eq 0 ]; then
        print_success "$display installed successfully"
        save_progress "packages" "$package" "completed"
        track_result 0
    else
        print_error "Failed to install $display"
        save_progress "packages" "$package" "failed"
        track_result 1
    fi

    return $result
}

# Install from GitHub releases
install_from_github() {
    local package="$1"
    local repo="$2"
    local display="$3"

    local arch=""
    case "$(uname -m)" in
        x86_64) arch="x86_64" ;;
        aarch64|arm64) arch="arm64" ;;
        *) print_error "Unsupported architecture"; return 1 ;;
    esac

    local latest_url=$(curl -s "https://api.github.com/repos/$repo/releases/latest" | \
                       grep "browser_download_url.*Linux.*${arch}.*tar.gz" | \
                       head -1 | cut -d'"' -f4)

    if [ -z "$latest_url" ]; then
        print_warning "Could not find download URL for $display"
        return 1
    fi

    local temp_dir=$(mktemp -d)
    cd "$temp_dir" || return 1

    if wget -q "$latest_url" -O "${package}.tar.gz" 2>/dev/null; then
        tar -xzf "${package}.tar.gz" 2>/dev/null
        local binary=$(find . -name "$package" -type f | head -1)
        if [ -n "$binary" ] && [ -f "$binary" ]; then
            sudo mv "$binary" "/usr/local/bin/$package"
            sudo chmod +x "/usr/local/bin/$package"
            cd - >/dev/null
            rm -rf "$temp_dir"
            return 0
        fi
    fi

    cd - >/dev/null
    rm -rf "$temp_dir"
    return 1
}
