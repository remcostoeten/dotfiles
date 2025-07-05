# Environment Initialization for Fish Shell
# This script can be sourced from Fish shell to load environment configurations

# Get the directory of this script
set ENV_DIR (dirname (realpath (status --current-filename)))

# Load environment configurations
if test -f "$ENV_DIR/loader.sh"
    bash "$ENV_DIR/loader.sh" load
else
    echo "Environment loader not found: $ENV_DIR/loader.sh" >&2
end
