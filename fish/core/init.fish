# Core dotfiles initialization
# Contains global utilities, colors, and environment variables

set core_dir (dirname (status --current-filename))

# Source all core files
for core_file in $core_dir/*.fish
    if test (basename $core_file) != "init.fish"
        source $core_file
    end
end