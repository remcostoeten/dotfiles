#!/usr/bin/env fish

# Symlink manager for dotfiles
# Handles creation, updating, and verification of symlinks

set -l DOTFILES_DIR (realpath (dirname (dirname (status -f))))
set -l HOME_DIR $HOME

# Color definitions
set -l GREEN (set_color green)
set -l RED (set_color red)
set -l YELLOW (set_color yellow)
set -l BLUE (set_color blue)
set -l NORMAL (set_color normal)

# Symlink configurations
# Format: source_path:target_path
set -l SYMLINKS \
    "$DOTFILES_DIR/config/kitty:$HOME/.config/kitty" \
    "$DOTFILES_DIR/config/nvim:$HOME/.config/nvim" \
    
    "$DOTFILES_DIR/configs/config.fish:$HOME/.config/fish/config.fish" \
    "$DOTFILES_DIR/configs/functions:$HOME/.config/fish/functions"

function print_status
    set -l msg_type $argv[1]
    set -l message $argv[2]
    
    switch $msg_type
        case "success"
            echo "$GREEN✓$NORMAL $message"
        case "error"
            echo "$RED✗$NORMAL $message"
        case "warning"
            echo "$YELLOW⚠$NORMAL $message"
        case "info"
            echo "$BLUE→$NORMAL $message"
    end
end

function create_symlink
    set -l source $argv[1]
    set -l target $argv[2]
    
    # Check if source exists
    if not test -e $source
        print_status error "Source does not exist: $source"
        return 1
    end
    
    # Create parent directory if needed
    set -l parent_dir (dirname $target)
    if not test -d $parent_dir
        print_status info "Creating parent directory: $parent_dir"
        command mkdir -p $parent_dir
        set -l mkdir_status $status
        if test $mkdir_status -ne 0
            print_status error "Failed to create directory: $parent_dir"
            return 1
        end
    end
    
    # Handle existing target
    if test -e $target
        if test -L $target
            # It's already a symlink
            set -l current_source (readlink $target)
            if test $current_source = $source
                print_status success "Symlink already correct: $target"
                return 0
            else
                print_status warning "Updating existing symlink: $target"
                rm $target
            end
        else
            # It's a real file/directory, back it up
            set -l backup_path "$target.backup."(date +%Y%m%d_%H%M%S)
            print_status warning "Backing up existing file/directory to: $backup_path"
            mv $target $backup_path
        end
    end
    
    # Create the symlink
    ln -s $source $target
    set -l link_status $status
    if test $link_status -eq 0
        print_status success "Created symlink: $target → $source"
    else
        print_status error "Failed to create symlink: $target"
        return 1
    end
end

function remove_symlink
    set -l target $argv[1]
    
    if test -L $target
        rm $target
        print_status success "Removed symlink: $target"
    else if test -e $target
        print_status error "Not a symlink: $target"
        return 1
    else
        print_status warning "Symlink does not exist: $target"
    end
end

function verify_symlink
    set -l source $argv[1]
    set -l target $argv[2]
    
    if not test -L $target
        print_status error "Not a symlink: $target"
        return 1
    end
    
    set -l current_source (readlink $target)
    if test $current_source = $source
        print_status success "Valid: $target → $source"
        return 0
    else
        print_status error "Invalid: $target → $current_source (expected: $source)"
        return 1
    end
end

function show_help
    echo "Symlink Manager - Manage dotfile symlinks"
    echo ""
    echo "Usage: symlink-manager [command]"
    echo ""
    echo "Commands:"
    echo "  setup     Create all configured symlinks"
    echo "  verify    Check if all symlinks are valid"
    echo "  clean     Remove all configured symlinks"
    echo "  status    Show symlink status"
    echo "  help      Show this help message"
    echo ""
    echo "Flags:"
    echo "  -h, --help  Show this help message"
    echo ""
    echo "Configured symlinks:"
    for link in $SYMLINKS
        set -l parts (string split ":" $link)
        echo "  $parts[2] → $parts[1]"
    end
end

# Main command handler
set -l command ""
if test (count $argv) -eq 0
    set command "help"
else
    set command $argv[1]
end

switch $command
    case -h --help help ''
        show_help
        
    case setup
        echo "Setting up symlinks..."
        echo ""
        set -l failed 0
        for link in $SYMLINKS
            set -l parts (string split ":" $link)
            if not create_symlink $parts[1] $parts[2]
                set failed (math $failed + 1)
            end
        end

        # Automatically create symlinks for each warp theme
        # Use correct Linux location: ${XDG_DATA_HOME:-$HOME/.local/share}/warp-terminal/themes/
        set warp_themes_dir "$HOME/.local/share/warp-terminal/themes"
        if test -n "$XDG_DATA_HOME"
            set warp_themes_dir "$XDG_DATA_HOME/warp-terminal/themes"
        end
        
        for theme in $DOTFILES_DIR/config/warp-themes/*.yaml
            set theme_name (basename $theme)
            set target "$warp_themes_dir/$theme_name"
            create_symlink $theme $target
        end
        echo ""
        if test $failed -eq 0
            print_status success "All symlinks created successfully!"
        else
            print_status error "$failed symlink(s) failed to create"
            exit 1
        end
        
    case verify
        echo "Verifying symlinks..."
        echo ""
        set -l invalid 0
        for link in $SYMLINKS
            set -l parts (string split ":" $link)
            if not verify_symlink $parts[1] $parts[2]
                set invalid (math $invalid + 1)
            end
        end
        echo ""
        if test $invalid -eq 0
            print_status success "All symlinks are valid!"
        else
            print_status error "$invalid symlink(s) are invalid"
            exit 1
        end
        
    case clean
        echo "Removing symlinks..."
        echo ""
        for link in $SYMLINKS
            set -l parts (string split ":" $link)
            remove_symlink $parts[2]
        end
        echo ""
        print_status success "Cleanup complete!"
        
    case status
        echo "$BLUE╔══════════════════════════════════════════════════════════════════╗$NORMAL"
        echo "$BLUE║                          Symlink Status                         ║$NORMAL"
        echo "$BLUE╚══════════════════════════════════════════════════════════════════╝$NORMAL"
        echo ""
        
        # Get warp themes directory
        set warp_themes_dir "$HOME/.local/share/warp-terminal/themes"
        if test -n "$XDG_DATA_HOME"
            set warp_themes_dir "$XDG_DATA_HOME/warp-terminal/themes"
        end
        
        # Count all theme files
        set -l theme_count 0
        if test -d "$DOTFILES_DIR/config/warp-themes"
            set theme_count (count $DOTFILES_DIR/config/warp-themes/*.yaml 2/dev/null || echo 0)
        end
        
        set -l total_links (math (count $SYMLINKS) + $theme_count)
        set -l valid_links 0
        set -l invalid_links 0
        set -l missing_links 0
        
        echo "$BLUE→ Dotfiles Directory:$NORMAL $DOTFILES_DIR"
        echo "$BLUE→ Total Configured Links:$NORMAL $total_links ($(count $SYMLINKS) main + $theme_count warp themes)"
        echo ""
        
        for link in $SYMLINKS
            set -l parts (string split ":" $link)
            set -l source $parts[1]
            set -l target $parts[2]
            
            # Extract just the filename/dirname for cleaner display
            set -l source_name (basename $source)
            set -l target_short (string replace $HOME "~" $target)
            
            if test -L $target
                set -l current (readlink $target)
                if test $current = $source
                    echo "  $GREEN✓$NORMAL $source_name"
                    echo "    $BLUE└─$NORMAL $target_short → $(string replace $DOTFILES_DIR '.' $source)"
                    set valid_links (math $valid_links + 1)
                else
                    echo "  $YELLOW⚠$NORMAL $source_name (points to wrong location)"
                    echo "    $BLUE├─$NORMAL Target: $target_short"
                    echo "    $BLUE├─$NORMAL Current: $(string replace $HOME '~' $current)"
                    echo "    $BLUE└─$NORMAL Expected: $(string replace $DOTFILES_DIR '.' $source)"
                    set invalid_links (math $invalid_links + 1)
                end
            else if test -e $target
                echo "  $RED✗$NORMAL $source_name (target exists but is not a symlink)"
                echo "    $BLUE├─$NORMAL Target: $target_short"
                echo "    $BLUE└─$NORMAL Source: $(string replace $DOTFILES_DIR '.' $source)"
                set invalid_links (math $invalid_links + 1)
            else
                echo "  $RED○$NORMAL $source_name (not linked)"
                echo "    $BLUE├─$NORMAL Target: $target_short (does not exist)"
                echo "    $BLUE└─$NORMAL Source: $(string replace $DOTFILES_DIR '.' $source)"
                set missing_links (math $missing_links + 1)
            end
            echo ""
        end
        
        # Show warp themes section
        if test $theme_count -gt 0
            echo "  $GREEN✓$NORMAL warp-themes"
            set warp_themes_short (string replace $HOME "~" $warp_themes_dir)
            echo "    $BLUE└─$NORMAL $warp_themes_short → ./config/warp-themes"
            
            # Check individual theme files
            for theme in $DOTFILES_DIR/config/warp-themes/*.yaml
                set theme_name (basename $theme)
                set target "$warp_themes_dir/$theme_name"
                
                if test -L $target
                    set -l current (readlink $target)
                    if test $current = $theme
                        set valid_links (math $valid_links + 1)
                    else
                        set invalid_links (math $invalid_links + 1)
                    end
                else if test -e $target
                    set invalid_links (math $invalid_links + 1)
                else
                    set missing_links (math $missing_links + 1)
                end
            end
            echo ""
        end
        
        # Dependencies section
        echo "$BLUE╔══════════════════════════════════════════════════════════════════╗$NORMAL"
        echo "$BLUE║                       Dependency Status                         ║$NORMAL"
        echo "$BLUE╚══════════════════════════════════════════════════════════════════╝$NORMAL"
        echo ""
        
        # Call detect-deps.fish and capture output
        set -l deps_script "$DOTFILES_DIR/internal/deps/detect-deps.fish"
        if test -f "$deps_script"
            # Get dependency information by parsing detect-deps output
            set -l temp_output (mktemp)
            fish -c "source '$deps_script'; detect_deps" > "$temp_output" 2>&1
            set -l deps_exit_code $status
            
            # Parse the output to show individual dependency status
            set -l missing_count 0
            set -l present_count 0
            set -l has_missing_deps false
            
            # Read the output and extract dependency information
            while read -l line
                # Look for missing dependencies lines
                if string match -q "  • * requires: *" "$line"
                    set -l tool_part (string replace "  • " "" "$line" | string split " requires: ")
                    set -l tool_name $tool_part[1]
                    set -l dependency $tool_part[2]
                    echo "  $RED✗$NORMAL $tool_name (missing: $dependency)"
                    set missing_count (math $missing_count + 1)
                    set has_missing_deps true
                else if string match -q "  • * has: *" "$line"
                    set -l tool_part (string replace "  • " "" "$line" | string split " has: ")
                    set -l tool_name $tool_part[1]
                    set -l dependency $tool_part[2]
                    echo "  $GREEN✓$NORMAL $tool_name ($dependency available)"
                    set present_count (math $present_count + 1)
                end
            end < "$temp_output"
            
            # Clean up temp file
            rm -f "$temp_output"
            
            # Show dependency summary
            echo ""
            echo "$BLUE→ Dependencies Found:$NORMAL $present_count available, $missing_count missing"
            
            # Show suggestion if there are missing dependencies
            if test $has_missing_deps = true
                echo ""
                echo "$YELLOW💡 Dependencies Missing:$NORMAL Run '$BLUE dotfiles-install-deps$NORMAL' to install missing dependencies"
            else if test $present_count -gt 0
                echo ""
                echo "$GREEN🎉 All required dependencies are available!$NORMAL"
            else
                echo ""
            echo "$BLUE→$NORMAL No dependencies detected or dependency detection unavailable"
            end
        else
            echo "$YELLOW⚠$NORMAL Dependency detection script not found at: $deps_script"
        end
        
        echo ""
        
        # Summary
        echo "$BLUE╔══════════════════════════════════════════════════════════════════╗$NORMAL"
        echo "$BLUE║                            Summary                              ║$NORMAL"
        echo "$BLUE╠══════════════════════════════════════════════════════════════════╣$NORMAL"
        echo "$BLUE║$NORMAL $GREEN✓ Valid symlinks:$NORMAL    $valid_links/$total_links                                     $BLUE║$NORMAL"
        echo "$BLUE║$NORMAL $YELLOW⚠ Invalid symlinks:$NORMAL  $invalid_links/$total_links                                     $BLUE║$NORMAL"
        echo "$BLUE║$NORMAL $RED○ Missing symlinks:$NORMAL   $missing_links/$total_links                                     $BLUE║$NORMAL"
        echo "$BLUE╚══════════════════════════════════════════════════════════════════╝$NORMAL"
        
        if test $invalid_links -gt 0 -o $missing_links -gt 0
            echo ""
            echo "$YELLOW💡 Tip:$NORMAL Run '$BLUE symlink-manager setup$NORMAL' to fix issues"
        else
            echo ""
            echo "$GREEN🎉 All symlinks are working perfectly!$NORMAL"
        end
        
    case '*'
        print_status error "Unknown command: $command"
        echo ""
        show_help
        exit 1
end

