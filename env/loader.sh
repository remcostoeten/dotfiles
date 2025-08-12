#!/usr/bin/env bash

# Environment Configuration Loader
# Auto-merges common and platform-specific configurations

# Get the directory of this script
ENV_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOTFILES_ROOT="$(dirname "$ENV_ROOT")"

# Logging functions
env_log_info() {
  if [ "$DOTFILES_QUIET" != "true" ]; then
    echo -e "\033[0;34m[ENV]\033[0m $1"
  fi
}

env_log_warn() {
  if [ "$DOTFILES_QUIET" != "true" ]; then
    echo -e "\033[0;33m[ENV]\033[0m $1"
  fi
}

env_log_error() {
  echo -e "\033[0;31m[ENV]\033[0m $1" >&2
}

# Platform detection
detect_platform() {
  local platform=""
  
  # macOS detection
  if [[ "$OSTYPE" == "darwin"* ]]; then
    platform="macos"
  # Linux detection
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    platform="linux"
  else
    platform="unknown"
  fi
  
  echo "$platform"
}

# Load secrets from the secrets directory
load_secrets() {
  local secrets_dir="$ENV_ROOT/secrets"
  if [ -d "$secrets_dir" ]; then
    env_log_info "Loading secrets"
    for secret_file in "$secrets_dir"/*.sh; do
      if [ -f "$secret_file" ]; then
        source "$secret_file"
      fi
    done
  fi
}

# Load environment configurations
load_environment() {
  local platform=$(detect_platform)
  
  env_log_info "Detected platform: $platform"
  
  # Always load common configuration first
  if [ -f "$ENV_ROOT/common/env.sh" ]; then
    env_log_info "Loading common environment configuration"
    source "$ENV_ROOT/common/env.sh"
  else
    env_log_warn "Common environment configuration not found: $ENV_ROOT/common/env.sh"
  fi
  
  # Load platform-specific configuration
  if [ "$platform" != "unknown" ] && [ -f "$ENV_ROOT/$platform/env.sh" ]; then
    env_log_info "Loading $platform-specific environment configuration"
    source "$ENV_ROOT/$platform/env.sh"
  elif [ "$platform" = "unknown" ]; then
    env_log_warn "Unknown platform, only common configuration loaded"
  else
    env_log_warn "Platform-specific configuration not found: $ENV_ROOT/$platform/env.sh"
  fi
  
  load_secrets
}

# Generate merged module list
get_modules_list() {
  local platform=$(detect_platform)
  local modules_list=""
  
  # Start with common modules
  if [ -f "$ENV_ROOT/common/modules.list" ]; then
    modules_list=$(cat "$ENV_ROOT/common/modules.list" | grep -v '^#' | sed '/^\s*$/d')
  fi
  
  # Add platform-specific modules
  if [ "$platform" != "unknown" ] && [ -f "$ENV_ROOT/$platform/modules.list" ]; then
    local platform_modules=$(cat "$ENV_ROOT/$platform/modules.list" | grep -v '^#' | sed '/^\s*$/d')
    if [ -n "$platform_modules" ]; then
      if [ -n "$modules_list" ]; then
        modules_list="$modules_list"$'\n'"$platform_modules"
      else
        modules_list="$platform_modules"
      fi
    fi
  fi
  
  echo "$modules_list"
}

# Load modules based on the merged list
load_modules() {
  local modules_list=$(get_modules_list)
  
  if [ -z "$modules_list" ]; then
    env_log_warn "No modules to load"
    return 0
  fi
  
  env_log_info "Loading modules..."
  
  while IFS= read -r module; do
    if [ -n "$module" ]; then
      load_module "$module"
    fi
  done <<< "$modules_list"
}

# Load a specific module
load_module() {
  local module_name="$1"
  local module_path="$DOTFILES_ROOT/modules/$module_name"
  
  if [ -d "$module_path" ]; then
    env_log_info "Loading module: $module_name"
    
    # Look for common module files
    local module_files=(
      "$module_path/init.sh"
      "$module_path/env.sh"
      "$module_path/aliases.sh"
      "$module_path/functions.sh"
    )
    
    for file in "${module_files[@]}"; do
      if [ -f "$file" ]; then
        source "$file"
      fi
    done
    
    # Look for platform-specific module files
    local platform=$(detect_platform)
    if [ "$platform" != "unknown" ]; then
      local platform_files=(
        "$module_path/$platform.sh"
        "$module_path/env.$platform.sh"
        "$module_path/aliases.$platform.sh"
      )
      
      for file in "${platform_files[@]}"; do
        if [ -f "$file" ]; then
          source "$file"
        fi
      done
    fi
  else
    env_log_warn "Module not found: $module_name ($module_path)"
  fi
}

# Export environment information
export_env_info() {
  export DOTFILES_PLATFORM=$(detect_platform)
  export DOTFILES_ENV_ROOT="$ENV_ROOT"
  export DOTFILES_ROOT="$DOTFILES_ROOT"
}

# Main function
main() {
  case "${1:-load}" in
    "load")
      export_env_info
      load_environment
      load_modules
      ;;
    "platform")
      detect_platform
      ;;
    "modules")
      get_modules_list
      ;;
    "info")
      echo "Platform: $(detect_platform)"
      echo "Environment root: $ENV_ROOT"
      echo "Dotfiles root: $DOTFILES_ROOT"
      echo "Modules:"
      get_modules_list | sed 's/^/  - /'
      ;;
    *)
      echo "Usage: $0 [load|platform|modules|info]"
      echo "  load     - Load environment and modules (default)"
      echo "  platform - Show detected platform"
      echo "  modules  - Show merged modules list"
      echo "  info     - Show environment information"
      exit 1
      ;;
  esac
}

# If script is executed directly, run main function
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  main "$@"
fi
