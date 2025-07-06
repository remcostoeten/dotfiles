#!/usr/bin/env bash

# Environment Initialization
# This script can be sourced from bootstrap scripts to load environment configurations

# Get the directory of this script
ENV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source the loader and run it
if [ -f "$ENV_DIR/loader.sh" ]; then
  source "$ENV_DIR/loader.sh"
  main load
else
  echo "Environment loader not found: $ENV_DIR/loader.sh" >&2
fi
