# Core dotfiles initialization
# Contains global utilities, colors, and environment variables

set core_dir (dirname (status --current-filename))

# Source env.fish first to ensure environment variables are loaded before anything else
if test -f $core_dir/env.fish
    source $core_dir/env.fish
end

# Source all other core files
for core_file in $core_dir/*.fish
    set core_basename (basename $core_file)
    if test "$core_basename" != "init.fish" -a "$core_basename" != "env.fish"
        source $core_file
    end
end