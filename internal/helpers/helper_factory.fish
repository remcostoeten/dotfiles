# Helper Factory - Fish shell script for managing helper script registrations
# Provides functions to register scripts, check for help flags, and display help

# Global associative array to store helper registrations
# Format: script_name -> "description|usage_string"
set -gA __helper_registry

# Function to register a helper script with its description and usage
function register_helper
    if test (count $argv) -ne 3
        echo "Usage: register_helper <script> <description> <usage-string>" >&2
        return 1
    end
    
    set script $argv[1]
    set description $argv[2]
    set usage $argv[3]
    
    # Store in global registry with pipe separator
    set -g __helper_registry[$script] "$description|$usage"
    return 0
end

# Function to check if help should be shown based on common CLI flags
function should_show_help
    for arg in $argv
        switch $arg
            case '-h' '--help' 'help'
                return 0
        end
    end
    return 1
end

# Function to print help for a specific script from the registry
function print_help
    if test (count $argv) -ne 1
        echo "Usage: print_help <script>" >&2
        return 1
    end
    
    set script $argv[1]
    
    # Check if script is registered
    if not set -q __helper_registry[$script]
        echo "No help registered for script: $script" >&2
        return 1
    end
    
    # Parse the stored registration data
    set registry_data $__helper_registry[$script]
    set parts (string split '|' $registry_data)
    
    if test (count $parts) -eq 2
        set description $parts[1]
        set usage $parts[2]
        
        echo "$script - $description"
        echo "Usage: $usage"
    else
        echo "Error: Invalid registry data for $script" >&2
        return 1
    end
    
    return 0
end
