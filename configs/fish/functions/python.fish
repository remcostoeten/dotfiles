#!/usr/bin/env fish
#
# smart_python_runner.fish
#
# A modular Fish shell Python runner that wraps `python` with dependency-aware behavior.
# Designed for dotfiles setups where this file is sourced by a loader.
#
# Goals:
# - Run `python main.py` normally.
# - If dependency config exists, offer to install it first.
# - Prefer uv for speed and project-local isolation.
# - Fall back to pip/pip3 only when needed.
# - Detect ModuleNotFoundError and offer self-healing installs.
# - Track installs, logs, history, config, and reversibility under ~/.dotfiles.
#
# Source this file from your Fish loader:
#   source ~/.config/fish/modules/internal/python/smart_python_runner.fish
#
# Then use:
#   python main.py
#   python --help
#   python --config
#   python --history
#   python --installed
#   python --revert

# ==============================================================================
# CONFIGURATION
# ==============================================================================

set -g SMART_PY_DEFAULT_MANAGER "uv"
set -g SMART_PY_FALLBACK_MANAGER "pip3"
set -g SMART_PY_BASE_DIR "$HOME/.dotfiles/python-installer"
set -g SMART_PY_LOG_DIR "$SMART_PY_BASE_DIR/logs"
set -g SMART_PY_CACHE_DIR "$SMART_PY_BASE_DIR/cache"
set -g SMART_PY_HISTORY_FILE "$SMART_PY_BASE_DIR/history.log"
set -g SMART_PY_INSTALLED_FILE "$SMART_PY_BASE_DIR/installed.log"
set -g SMART_PY_GLOBAL_FILE "$SMART_PY_BASE_DIR/global-installed.log"
set -g SMART_PY_PROJECT_MARKER_DIR ".smart-python"
set -g SMART_PY_MAX_RETRIES 3
set -g SMART_PY_DESCRIPTION_LOOKUP true
set -g SMART_PY_ASSUME_LOCAL true

# Common import-name -> package-name mappings.
set -g SMART_PY_PACKAGE_MAP \
    "psycopg2=psycopg2-binary" \
    "PIL=pillow" \
    "cv2=opencv-python" \
    "dotenv=python-dotenv" \
    "yaml=PyYAML" \
    "bs4=beautifulsoup4" \
    "sklearn=scikit-learn" \
    "Crypto=pycryptodome"

# ==============================================================================
# COLORS / UI
# ==============================================================================

function __smart_py_color
    set_color $argv[1]
end

function __smart_py_info
    echo (set_color cyan)$argv(set_color normal)
end

function __smart_py_ok
    echo (set_color green)$argv(set_color normal)
end

function __smart_py_warn
    echo (set_color yellow)$argv(set_color normal)
end

function __smart_py_error
    echo (set_color red)$argv(set_color normal)
end

function __smart_py_dim
    echo (set_color brblack)$argv(set_color normal)
end

function __smart_py_header
    echo ""
    echo (set_color cyan)"smart-python"(set_color normal)(set_color brblack)" · dependency-aware Python runner"(set_color normal)
    echo (set_color brblack)"──────────────────────────────────────────────"(set_color normal)
end

# ==============================================================================
# FILESYSTEM / LOGGING
# ==============================================================================

function __smart_py_init_dirs
    mkdir -p "$SMART_PY_BASE_DIR" "$SMART_PY_LOG_DIR" "$SMART_PY_CACHE_DIR"
end

function __smart_py_project_id
    pwd | string replace -a '/' '__' | string replace -a ' ' '_'
end

function __smart_py_project_dir
    echo "$PWD/$SMART_PY_PROJECT_MARKER_DIR"
end

function __smart_py_project_log
    set -l id (__smart_py_project_id)
    echo "$SMART_PY_LOG_DIR/$id.log"
end

function __smart_py_log
    __smart_py_init_dirs
    set -l timestamp (date "+%Y-%m-%d %H:%M:%S")
    echo "$timestamp | $PWD | $argv" >> "$SMART_PY_HISTORY_FILE"
    echo "$timestamp | $argv" >> (__smart_py_project_log)
end

function __smart_py_mark_project_install
    set -l config_file "$argv[1]"
    set -l hash "$argv[2]"
    set -l manager "$argv[3]"
    set -l mode "$argv[4]"

    set -l dir (__smart_py_project_dir)
    mkdir -p "$dir"
    echo "config=$config_file" > "$dir/install.meta"
    echo "hash=$hash" >> "$dir/install.meta"
    echo "manager=$manager" >> "$dir/install.meta"
    echo "mode=$mode" >> "$dir/install.meta"
    echo "date="(date "+%Y-%m-%d %H:%M:%S") >> "$dir/install.meta"
end

function __smart_py_read_project_meta
    set -l meta (__smart_py_project_dir)"/install.meta"
    if test -f "$meta"
        cat "$meta"
    end
end

function __smart_py_file_hash
    set -l file "$argv[1]"
    if command -v sha256sum >/dev/null 2>&1
        sha256sum "$file" | awk '{print $1}'
    else if command -v shasum >/dev/null 2>&1
        shasum -a 256 "$file" | awk '{print $1}'
    else
        stat -c "%Y-%s" "$file" 2>/dev/null
    end
end

# ==============================================================================
# HELP / FLAGS
# ==============================================================================

function __smart_py_help
    __smart_py_header
    echo "Usage:"
    echo "  python <script.py> [args...]"
    echo "  python -m <module> [args...]"
    echo ""
    echo "Flags:"
    echo "  -h, --help                 Show this help"
    echo "  -c, --config               Show health/config information"
    echo "  -i, --installed            Show logged installed packages"
    echo "  --global-installed         Show globally installed packages"
    echo "  --history                  Show global history log"
    echo "  --project-history          Show history for the current directory"
    echo "  --revert, --revert-install Revert packages installed for this project"
    echo "  --clear-cache              Clear smart-python cache"
    echo "  --logs                     Print log directory"
    echo ""
    echo "Behavior:"
    echo "  1. Detect pyproject.toml / requirements.txt"
    echo "  2. Ask whether to install locally or globally"
    echo "  3. Run Python"
    echo "  4. On ModuleNotFoundError, map import names to package names and offer install"
    echo ""
    echo "Default manager: $SMART_PY_DEFAULT_MANAGER"
end

function __smart_py_config
    __smart_py_header
    echo "Config:"
    echo "  SMART_PY_DEFAULT_MANAGER:      $SMART_PY_DEFAULT_MANAGER"
    echo "  SMART_PY_BASE_DIR:             $SMART_PY_BASE_DIR"
    echo "  SMART_PY_MAX_RETRIES:          $SMART_PY_MAX_RETRIES"
    echo ""
    echo "Health:"

    for bin in python3 uv pip3 pip curl jq
        if command -v $bin >/dev/null 2>&1
            echo (set_color green)"  ✔ $bin"(set_color normal)" -> "(command -v $bin)
        else
            echo (set_color yellow)"  - $bin not found"(set_color normal)
        end
    end

    echo ""
    echo "Current project:"
    echo "  Path: $PWD"
    set -l meta (__smart_py_read_project_meta)
    if test -n "$meta"
        echo "$meta" | sed 's/^/  /'
    else
        echo "  No smart-python project metadata found."
    end
end

# ==============================================================================
# MANAGER DETECTION / INSTALLATION
# ==============================================================================

function __smart_py_require_python
    if command -v python3 >/dev/null 2>&1
        return 0
    end

    __smart_py_error "Python 3 was not found."
    read -l -P "Install Python 3 with apt? [y/N] " answer
    if test "$answer" = "y" -o "$answer" = "Y"
        if command -v sudo >/dev/null 2>&1; and command -v apt >/dev/null 2>&1
            sudo apt update && sudo apt install -y python3 python3-pip python3-venv
            return $status
        else
            __smart_py_error "Cannot auto-install Python: apt or sudo not available."
            return 1
        end
    end

    __smart_py_warn "Goodbye."
    return 1
end

function __smart_py_install_uv
    __smart_py_warn "uv is not installed."
    read -l -P "Install uv now? [y/N] " answer

    if test "$answer" != "y" -a "$answer" != "Y"
        return 1
    end

    if not command -v curl >/dev/null 2>&1
        __smart_py_error "curl is required to install uv automatically."
        return 1
    end

    __smart_py_info "Installing uv..."
    curl -Ls https://astral.sh/uv/install.sh | sh

    if test -d "$HOME/.local/bin"
        fish_add_path "$HOME/.local/bin" >/dev/null 2>&1
    end

    if command -v uv >/dev/null 2>&1
        __smart_py_ok "uv installed: "(command -v uv)
        return 0
    end

    __smart_py_error "uv install did not complete or is not on PATH."
    return 1
end

function __smart_py_get_manager
    if test "$SMART_PY_DEFAULT_MANAGER" = "uv"
        if command -v uv >/dev/null 2>&1
            echo "uv"
            return 0
        end

        if __smart_py_install_uv
            echo "uv"
            return 0
        end
    end

    if command -v pip3 >/dev/null 2>&1
        echo "pip3"
        return 0
    end

    if command -v pip >/dev/null 2>&1
        echo "pip"
        return 0
    end

    __smart_py_error "No package manager found: uv, pip3, or pip."
    return 1
end

# ==============================================================================
# DEPENDENCY CONFIG DETECTION
# ==============================================================================

function __smart_py_detect_dependency_file
    if test -f "pyproject.toml"
        echo "pyproject.toml"
        return 0
    end

    if test -f "requirements.txt"
        echo "requirements.txt"
        return 0
    end

    for file in requirements-dev.txt requirements.prod.txt dev-requirements.txt Pipfile setup.py setup.cfg
        if test -f "$file"
            echo "$file"
            return 0
        end
    end

    return 1
end

function __smart_py_parse_requirement_names
    set -l file "$argv[1]"

    if not test -f "$file"
        return 1
    end

    cat "$file" \
        | sed 's/#.*$//' \
        | rg -v '^\s*$' \
        | rg -v '^-' \
        | sed -E 's/[<>=!~].*$//' \
        | sed -E 's/\[.*\]//' \
        | string trim \
        | sort -u
end

# ==============================================================================
# PACKAGE DESCRIPTIONS
# ==============================================================================

function __smart_py_package_description
    set -l pkg "$argv[1]"
    set -l cache "$SMART_PY_CACHE_DIR/descriptions.tsv"
    mkdir -p "$SMART_PY_CACHE_DIR"

    if test -f "$cache"
        set -l hit (rg -m 1 "^$pkg	" "$cache")
        if test -n "$hit"
            echo "$hit" | cut -f2-
            return 0
        end
    end

    if test "$SMART_PY_DESCRIPTION_LOOKUP" != true
        echo "No description cached."
        return 0
    end

    if not command -v python3 >/dev/null 2>&1
        echo "No description available."
        return 0
    end

    set -l desc (python3 -c "import json, urllib.request, sys
pkg=sys.argv[1]
try:
    with urllib.request.urlopen('https://pypi.org/pypi/'+pkg+'/json', timeout=2) as r:
        data=json.load(r)
    print((data.get('info',{}).get('summary') or 'No summary provided.').replace('\n',' '))
except Exception:
    print('No description available.')
" $pkg 2>/dev/null)

    echo -e "$pkg	$desc" >> "$cache"
    echo "$desc"
end

# ==============================================================================
# INSTALL HELPERS
# ==============================================================================

function __smart_py_choose_scope
    echo ""
    __smart_py_info "Install scope"
    echo "  1) local   recommended; project-isolated via uv .venv"
    echo "  2) global  user/global environment"
    echo ""
    read -l -P "Choose scope [1/local, 2/global, default: local]: " scope

    switch "$scope"
        case 2 global g
            echo "global"
        case '*'
            echo "local"
    end
end

function __smart_py_install_config_deps
    set -l file "$argv[1]"
    set -l manager "$argv[2]"
    set -l scope "$argv[3]"

    set -l hash (__smart_py_file_hash "$file")
    set -l marker (__smart_py_project_dir)"/install.meta"

    if test -f "$marker"
        set -l previous_hash (rg '^hash=' "$marker" | sed 's/^hash=//')
        if test "$previous_hash" = "$hash"
            __smart_py_dim "Dependencies already handled for $file."
            return 0
        end
    end

    __smart_py_info "Dependency file detected: $file"

    if string match -q "requirements*.txt" "$file"; or test "$file" = "dev-requirements.txt"
        set -l names (__smart_py_parse_requirement_names "$file")
        set -l count (count $names)
        echo "Packages listed: $count"
        for pkg in $names
            set -l desc (__smart_py_package_description "$pkg")
            echo "  - "(set_color green)$pkg(set_color normal)(set_color brblack)" — $desc"(set_color normal)
        end
    else
        echo "Project config will be handled by $manager."
    end

    echo ""
    read -l -P "Install dependencies from $file? [y/N] " answer
    if test "$answer" != "y" -a "$answer" != "Y"
        __smart_py_warn "Skipped dependency file install."
        return 1
    end

    __smart_py_info "Installing dependencies with $manager ($scope)..."
    set -l start (date +%s)
    set -l install_output ""
    set -l status_code 0

    if test "$manager" = "uv"
        if test "$file" = "pyproject.toml"
            set install_output (uv sync 2>&1)
            set status_code $status
        else if string match -q "requirements*.txt" "$file"; or test "$file" = "dev-requirements.txt"
            if test "$scope" = "local"
                uv venv >/dev/null 2>&1
                set install_output (uv pip install -r "$file" 2>&1)
                set status_code $status
            else
                set install_output (uv pip install --system -r "$file" 2>&1)
                set status_code $status
            end
        else
            __smart_py_warn "Unsupported config installer for $file; skipping."
            return 1
        end
    else
        if string match -q "requirements*.txt" "$file"; or test "$file" = "dev-requirements.txt"
            if test "$scope" = "global"
                set install_output ($manager install --user -r "$file" 2>&1)
            else
                command python3 -m venv .venv
                set install_output (.venv/bin/python -m pip install -r "$file" 2>&1)
            end
            set status_code $status
        else
            __smart_py_warn "pip fallback cannot reliably install $file."
            return 1
        end
    end

    set -l end (date +%s)
    set -l elapsed (math $end - $start)

    if test $status_code -eq 0
        __smart_py_ok "Installed dependencies from $file in $elapsed seconds."
        __smart_py_mark_project_install "$file" "$hash" "$manager" "$scope"
        __smart_py_log "config-install success file=$file manager=$manager scope=$scope elapsed=$elapsed seconds"
        echo "$install_output" >> (__smart_py_project_log)
        return 0
    end

    __smart_py_error "Dependency install failed for $file."
    echo "$install_output"
    __smart_py_log "config-install failed file=$file manager=$manager scope=$scope"
    return $status_code
end

function __smart_py_map_package
    set -l import_name "$argv[1]"
    for pair in $SMART_PY_PACKAGE_MAP
        set -l key (string split '=' $pair)[1]
        set -l value (string split '=' $pair)[2]
        if test "$import_name" = "$key"
            echo "$value"
            return 0
        end
    end
    echo "$import_name"
end

function __smart_py_install_packages
    set -l manager "$argv[1]"
    set -l scope "$argv[2]"
    set -e argv[1]
    set -e argv[1]
    set -l packages $argv

    if test (count $packages) -eq 0
        return 0
    end

    __smart_py_info "Packages to install:"
    for pkg in $packages
        set -l desc (__smart_py_package_description "$pkg")
        echo "  - "(set_color green)$pkg(set_color normal)(set_color brblack)" — $desc"(set_color normal)
    end

    echo ""
    read -l -P "Install these packages ($scope)? [y/N] " answer
    if test "$answer" != "y" -a "$answer" != "Y"
        __smart_py_warn "Install cancelled."
        return 1
    end

    set -l total (count $packages)
    set -l i 1
    set -l failed

    for pkg in $packages
        __smart_py_dim "[$i/$total] Installing $pkg with $manager ($scope)..."
        set -l start (date +%s)
        set -l output ""

        if test "$manager" = "uv"
            if test "$scope" = "local"
                uv venv >/dev/null 2>&1
                set output (uv pip install "$pkg" 2>&1)
            else
                set output (uv pip install --system "$pkg" 2>&1)
            end
        else
            if test "$scope" = "local"
                command python3 -m venv .venv
                set output (.venv/bin/python -m pip install "$pkg" 2>&1)
            else
                set output ($manager install --user "$pkg" 2>&1)
            end
        end

        set -l code $status
        set -l end (date +%s)
        set -l elapsed (math $end - $start)

        echo "$output" >> (__smart_py_project_log)

        if test $code -eq 0
            __smart_py_ok "✔ Installed $pkg in $elapsed seconds"
            echo (date "+%Y-%m-%d %H:%M:%S")" | $PWD | $pkg | $manager | $scope" >> "$SMART_PY_INSTALLED_FILE"
            if test "$scope" = "global"
                echo "$pkg | $manager | "(date "+%Y-%m-%d %H:%M:%S") >> "$SMART_PY_GLOBAL_FILE"
            end
            __smart_py_log "package-install success package=$pkg manager=$manager scope=$scope elapsed=$elapsed seconds"
        else
            __smart_py_error "✖ Failed installing $pkg"
            echo "$output"
            set failed $failed $pkg
            __smart_py_log "package-install failed package=$pkg manager=$manager scope=$scope"
        end

        set i (math $i + 1)
    end

    if test (count $failed) -gt 0
        return 1
    end

    return 0
end

# ==============================================================================
# ERROR PARSING
# ==============================================================================

function __smart_py_missing_modules_from_output
    for line in $argv
        echo "$line" | rg "No module named"
    end | sort -u
end

# ==============================================================================
# REVERT
# ==============================================================================

function __smart_py_revert_project
    __smart_py_header
    set -l project_log (__smart_py_project_log)
    if not test -f "$project_log"
        __smart_py_warn "No project log found for this directory."
        return 0
    end

    set -l packages (rg 'package-install success' "$project_log" \
        | sed -E 's/.*package=([^ ]+).*/\1/' \
        | sort -u)

    if test (count $packages) -eq 0
        __smart_py_warn "No package installs found for this project."
        return 0
    end

    echo "Packages installed by smart-python in this project:"
    for pkg in $packages
        echo "  - $pkg"
    end

    echo ""
    read -l -P "Uninstall these from the current environment? [y/N] " answer
    if test "$answer" != "y" -a "$answer" != "Y"
        __smart_py_warn "Revert cancelled."
        return 1
    end

    if test -d .venv
        for pkg in $packages
            .venv/bin/python -m pip uninstall -y "$pkg"
        end
    else if command -v uv >/dev/null 2>&1
        for pkg in $packages
            uv pip uninstall "$pkg"
        end
    else if command -v pip3 >/dev/null 2>&1
        for pkg in $packages
            pip3 uninstall -y "$pkg"
        end
    else
        __smart_py_error "No uninstall-capable manager found."
        return 1
    end

    __smart_py_ok "Revert attempted. See project log for details."
    __smart_py_log "revert attempted packages="(string join ',' $packages)
end

# ==============================================================================
# MAIN WRAPPER
# ==============================================================================

function python --description "Smart Python wrapper"
    __smart_py_init_dirs

    if test (count $argv) -eq 0
        command python3
        return $status
    end

    switch "$argv[1]"
        case "--help" "-h"
            __smart_py_help
            return 0
        case "--installed" "-i"
            if test -f "$SMART_PY_INSTALLED_FILE"
                cat "$SMART_PY_INSTALLED_FILE"
            else
                __smart_py_warn "No installed package log yet."
            end
            return 0
            if test -f "$SMART_PY_INSTALLED_FILE"
                cat "$SMART_PY_INSTALLED_FILE"
            else
                __smart_py_warn "No installed package log yet."
            end
            return 0
        case "--global-installed"
            if test -f "$SMART_PY_GLOBAL_FILE"
                cat "$SMART_PY_GLOBAL_FILE"
            else
                __smart_py_warn "No global installs logged yet."
            end
            return 0
        case "--history"
            if test -f "$SMART_PY_HISTORY_FILE"
                cat "$SMART_PY_HISTORY_FILE"
            else
                __smart_py_warn "No history yet."
            end
            return 0
        case "--project-history"
            set -l log (__smart_py_project_log)
            if test -f "$log"
                cat "$log"
            else
                __smart_py_warn "No project history yet."
            end
            return 0
        case "--logs"
            echo "$SMART_PY_LOG_DIR"
            return 0
        case "--clear-cache"
            rm -rf "$SMART_PY_CACHE_DIR"
            mkdir -p "$SMART_PY_CACHE_DIR"
            __smart_py_ok "Cleared cache: $SMART_PY_CACHE_DIR"
            return 0
        case "--revert" "--revert-install"
            __smart_py_revert_project
            return $status
    end

    __smart_py_require_python
    or return 1

    set -l manager (__smart_py_get_manager)
    or return 1

    set -l dep_file (__smart_py_detect_dependency_file)
    if test -n "$dep_file"
        set -l scope (__smart_py_choose_scope)
        __smart_py_install_config_deps "$dep_file" "$manager" "$scope"
    end

    set -l python_cmd "python3"
    if test -x ".venv/bin/python"
        set python_cmd ".venv/bin/python"
    end

    set -l attempt 1
    while test $attempt -le $SMART_PY_MAX_RETRIES
        __smart_py_dim "Running Python attempt $attempt/$SMART_PY_MAX_RETRIES..."
        set -l output ($python_cmd $argv 2>&1)
        set -l code $status

        if test $code -eq 0
            if test -n "$output"
                echo "$output"
            end
            __smart_py_ok "Done."
            return 0
        end

        set -l missing
        for line in $output
            set -l match (echo "$line" | sed "s/.*No module named '\([^']*\)'.*/\1/")
            if test -n "$match" -a "$match" != "$line"
                set missing $missing $match
            end
        end

        if test (count $missing) -eq 0
            __smart_py_error "Python failed, but this does not look like a missing-module error."
            echo "$output"
            __smart_py_log "python-runtime-error code=$code"
            echo "$output" >> (__smart_py_project_log)
            return $code
        end

        __smart_py_warn "Missing modules detected:"
        set -l install_packages
        for mod in $missing
            set -l pkg (__smart_py_map_package "$mod")
            set install_packages $install_packages $pkg
            echo "  - $mod -> $pkg"
        end

        if test -n "$dep_file"
            __smart_py_warn "A dependency file was already checked, so this is fallback self-healing."
        end

        set -l scope (__smart_py_choose_scope)
        __smart_py_install_packages "$manager" "$scope" $install_packages
        or begin
            __smart_py_error "Could not install one or more missing modules."
            echo "$output"
            return 1
        end

        if test -x ".venv/bin/python"
            set python_cmd ".venv/bin/python"
        end

        set attempt (math $attempt + 1)
    end

    __smart_py_error "Failed after $SMART_PY_MAX_RETRIES attempts."
    return 1
end