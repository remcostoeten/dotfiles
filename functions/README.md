# Functions Architecture

This directory contains internal shell helpers for the dotfiles framework itself.

It is not the general-purpose runtime helper layer for `bin/` and `scripts/`. User-facing tools should remain isolated from this directory and use local helpers or a dedicated runtime library instead.

## Structure

- **`safe-source`** - Safely source directories or files with optional include/exclude filters
- **`functions.higher-order`** - Higher-order function registry providing interactive menu
- **`functions`** - Bridge file that loads the registry system
- **`get-script-data-dir`** - Helper function to get script-specific data directory path
- **`ensure-script-data-dir`** - Ensures script data directory exists and returns path

## Boundary

- `functions/` is for framework bootstrapping, setup, sourcing, and internal orchestration
- `setup/` may source files from `functions/`
- `bin/` and `scripts/` should not source `functions/`
- `packages/_vendor/` is the runtime connector layer for third-party shell integration
- `configs/fish/functions/` is a separate Fish-native runtime layer

If a helper exists primarily to support an end-user tool, it should live with that tool or in a dedicated runtime helper directory such as `scripts/lib/`, not here.

## Usage

### Loading Functions

Source the bridge file only from framework/bootstrap code that needs the internal registry:

```fish
# In config.fish
source $HOME/.config/dotfiles/functions/functions
```

### Using Functions

```bash
# Interactive menu
functions

# Direct execution
functions safe-source

# Help
functions.help
```

## Creating New Functions

1. **Create function file** (extensionless) in `functions/`:
   ```bash
   # functions/my-function
   # DOCSTRING: Description of what this function does
   my-function() {
       echo "Hello from my-function"
   }
   ```

2. **Register in bridge file** (`functions/functions`):
   ```bash
   if [ -f "$FUNCTIONS_DIR/my-function" ]; then
       . "$FUNCTIONS_DIR/my-function" 2>/dev/null || \
       source "$FUNCTIONS_DIR/my-function" 2>/dev/null || true
   fi
   ```

3. **Make executable**:
   ```bash
   chmod +x functions/my-function
   ```

Only add a new file here if it supports the dotfiles framework itself. Do not add tool-specific runtime helpers for `scripts/` or `bin/`.

## Safe Source Usage

**Always use `safe-source` when sourcing files:**

```bash
# Instead of: source "$file"
safe-source "$file"

# With filters:
safe-source "$directory" --include "sh,fish" --exclude "test.sh"
```

## Data Storage Helper

**Framework code may use data helper functions to work with script-specific data directories:**

```bash
# Get data directory for your script
SCRIPT_DATA_DIR=$(ensure-script-data-dir "my-script")
CONFIG_FILE="$SCRIPT_DATA_DIR/config.json"
LOG_FILE="$SCRIPT_DATA_DIR/app.log"

# Create and reference a subdirectory
LOG_DIR=$(ensure-script-data-dir "my-script" "logs")

# Build file paths directly
STATE_FILE=$(script-data-file "my-script" "state.json")
```

This follows the pattern: `$HOME/.dotfiles/$SCRIPT_NAME/*.{json,log,md,txt}`

## Requirements

- Functions must be shell-compatible (Fish, Bash, Zsh)
- Include DOCSTRING comment at top
- Use POSIX-compliant syntax when possible
- Include error handling
- Make files executable
- Data helpers default to storing files in `$HOME/.dotfiles` (override with `DOTFILES_DATA_DIR`)
