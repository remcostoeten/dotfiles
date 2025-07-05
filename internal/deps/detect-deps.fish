#!/usr/bin/env fish

# ==============================================================================
# DEPENDENCY DETECTION HELPER
# Reads deps.yaml and checks dependencies for tools in ~/.config/dotfiles/bin
# ==============================================================================

# Color helper functions
function _color_success
    echo -e (set_color green)"✓ $argv"(set_color normal)
end

function _color_error
    echo -e (set_color red)"✗ $argv"(set_color normal)
end

function _color_warning
    echo -e (set_color yellow)"⚠ $argv"(set_color normal)
end

function _color_info
    echo -e (set_color cyan)"ℹ $argv"(set_color normal)
end

function _color_header
    echo -e (set_color cyan --bold)"$argv"(set_color normal)
end

function _color_dim
    echo -e (set_color brblack)"$argv"(set_color normal)
end

# Simple YAML parser for deps.yaml
function _parse_deps_yaml
    set -l deps_file "/home/remco-stoeten/.config/dotfiles/internal/deps/deps.yaml"
    
    if not test -f "$deps_file"
        _color_error "deps.yaml not found at $deps_file"
        return 1
    end
    
    # Parse YAML and extract tool dependencies
    set -l current_tool ""
    set -l in_tools_section 0
    set -l parsing_requires 0
    
    while read -l line
        # Skip comments and empty lines
        if test -z "$line"; or string match -q "#*" "$line"
            continue
        end
        
        # Check if we're in the tools section
        if string match -q "tools:" "$line"
            set in_tools_section 1
            continue
        end
        
        if test $in_tools_section -eq 0
            continue
        end
        
        # Parse tool entries
        if string match -q "  - tool:*" "$line"
            set current_tool (string replace "  - tool: " "" "$line")
            set parsing_requires 0
            continue
        end
        
        # Parse requires section
        if string match -q "*requires:*" "$line"
            set parsing_requires 1
            set -l requires_content (string replace -r ".*requires:\s*" "" "$line")
            
            # Handle inline array format: requires: [dep1, dep2]
            if string match -q "*[*" "$requires_content"
                set requires_content (string replace -a "[" "" "$requires_content")
                set requires_content (string replace -a "]" "" "$requires_content")
                set requires_content (string replace -a "," " " "$requires_content")
                
                if test -n "$current_tool"; and test -n "$requires_content"
                    for dep in (string split " " "$requires_content")
                        set dep (string trim "$dep")
                        if test -n "$dep"
                            echo "$current_tool:$dep"
                        end
                    end
                end
                set parsing_requires 0
            end
            continue
        end
        
        # Handle multi-line requires arrays
        if test $parsing_requires -eq 1; and string match -q "*-*" "$line"
            set -l dep (string replace -r "^\s*-\s*" "" "$line")
            set dep (string trim "$dep")
            if test -n "$current_tool"; and test -n "$dep"
                echo "$current_tool:$dep"
            end
            continue
        end
        
        # Stop parsing requires if we hit another section
        if string match -q "*optional:*" "$line"; or string match -q "*notes:*" "$line"
            set parsing_requires 0
            continue
        end
    end < "$deps_file"
end

# Get list of tools in bin directory
function _get_bin_tools
    set -l bin_dir "/home/remco-stoeten/.config/dotfiles/bin"
    
    if not test -d "$bin_dir"
        _color_error "Bin directory not found at $bin_dir"
        return 1
    end
    
    for file in "$bin_dir"/*
        if test -f "$file"
            basename "$file"
        end
    end
end

# Check if a command is available
function _check_command
    set -l cmd "$argv[1]"
    command -v "$cmd" >/dev/null 2>&1
end

# Main dependency detection function
function detect_deps
    if test (count $argv) -gt 0
        switch $argv[1]
            case help -h --help
                echo ""
                _color_header "╔═══════════════════════════════════════════════════════════╗"
                _color_header "║                                                           ║"
                _color_header "║              Dependency Detection Helper                 ║"
                _color_header "║                    by @remcostoeten                      ║"
                _color_header "║                                                           ║"
                _color_header "╚═══════════════════════════════════════════════════════════╝"
                echo ""
                _color_info "Usage:"
                echo "  detect-deps                  → Check all dependencies"
                echo "  detect-deps [tool]           → Check specific tool dependencies"
                echo "  detect-deps help             → Show this help"
                echo ""
                _color_info "Output:"
                echo "  • Missing: Dependencies that are required but not installed"
                echo "  • Present: Dependencies that are installed and available"
                echo "  • Unknown: Tools in bin/ that aren't defined in deps.yaml"
                echo ""
                return 0
        end
    end
    
    echo ""
    _color_header "Dependency Detection Results"
    _color_dim "════════════════════════════════════════"
    
    # Get parsed dependencies and available tools
    set -l tool_deps (_parse_deps_yaml)
    set -l bin_tools (_get_bin_tools)
    
    if test $status -ne 0
        return 1
    end
    
    # Create associative arrays (using Fish lists)
    set -l missing_deps
    set -l present_deps
    set -l unknown_tools
    set -l tools_with_deps
    
    # Check specific tool if provided
    set -l target_tool ""
    if test (count $argv) -gt 0
        set target_tool "$argv[1]"
    end
    
    # Process tool dependencies
    for entry in $tool_deps
        set -l tool_name (string split ":" "$entry")[1]
        set -l dependency (string split ":" "$entry")[2]
        
        # Skip if we're checking a specific tool and this isn't it
        if test -n "$target_tool"; and test "$tool_name" != "$target_tool"
            continue
        end
        
        # Track tools that have dependencies defined
        if not contains "$tool_name" $tools_with_deps
            set -a tools_with_deps "$tool_name"
        end
        
        # Check if dependency is available
        if _check_command "$dependency"
            set -a present_deps "$tool_name:$dependency"
        else
            set -a missing_deps "$tool_name:$dependency"
        end
    end
    
    # Find unknown tools (tools in bin/ but not in deps.yaml)
    if test -z "$target_tool"
        for tool in $bin_tools
            if not contains "$tool" $tools_with_deps
                set -a unknown_tools "$tool"
            end
        end
    end
    
    # Display results
    echo ""
    
    # Missing dependencies
    if test (count $missing_deps) -gt 0
        _color_error "Missing Dependencies:"
        for entry in $missing_deps
            set -l tool_name (string split ":" "$entry")[1]
            set -l dependency (string split ":" "$entry")[2]
            echo "  • $tool_name requires: $dependency"
        end
        echo ""
    end
    
    # Present dependencies
    if test (count $present_deps) -gt 0
        _color_success "Present Dependencies:"
        for entry in $present_deps
            set -l tool_name (string split ":" "$entry")[1]
            set -l dependency (string split ":" "$entry")[2]
            echo "  • $tool_name has: $dependency"
        end
        echo ""
    end
    
    # Unknown tools
    if test (count $unknown_tools) -gt 0
        _color_warning "Unknown Tools (not in deps.yaml):"
        for tool in $unknown_tools
            echo "  • $tool"
        end
        echo ""
    end
    
    # Summary
    _color_dim "Summary:"
    echo "  Missing: "(count $missing_deps)" dependencies"
    echo "  Present: "(count $present_deps)" dependencies"
    echo "  Unknown: "(count $unknown_tools)" tools"
    
    # Return appropriate exit code
    if test (count $missing_deps) -gt 0
        return 1
    else
        return 0
    end
end

# Auto-execute if script is run directly
if test "(status filename)" = "/home/remco-stoeten/.config/dotfiles/internal/deps/detect-deps.fish"
    detect_deps $argv
end
