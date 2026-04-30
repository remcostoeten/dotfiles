# Fish completions for wallpaper

function __wallpaper_names
    set -l manifest "$HOME/.config/dotfiles/configs/wallpapers/manifest.tsv"

    if not test -f "$manifest"
        return
    end

    awk -F '\t' '
        $1 !~ /^#/ && NF >= 2 && $1 != "" { print $1 }
    ' "$manifest"
end

complete -c wallpaper -f

complete -c wallpaper -n "not __fish_seen_subcommand_from set list next prev random rotate status stop open edit help" -a set -d "Set active wallpaper"
complete -c wallpaper -n "not __fish_seen_subcommand_from set list next prev random rotate status stop open edit help" -a list -d "List wallpapers"
complete -c wallpaper -n "not __fish_seen_subcommand_from set list next prev random rotate status stop open edit help" -a next -d "Next wallpaper"
complete -c wallpaper -n "not __fish_seen_subcommand_from set list next prev random rotate status stop open edit help" -a prev -d "Previous wallpaper"
complete -c wallpaper -n "not __fish_seen_subcommand_from set list next prev random rotate status stop open edit help" -a random -d "Random wallpaper"
complete -c wallpaper -n "not __fish_seen_subcommand_from set list next prev random rotate status stop open edit help" -a rotate -d "Start background rotation"
complete -c wallpaper -n "not __fish_seen_subcommand_from set list next prev random rotate status stop open edit help" -a status -d "Show rotation status"
complete -c wallpaper -n "not __fish_seen_subcommand_from set list next prev random rotate status stop open edit help" -a stop -d "Stop rotation"
complete -c wallpaper -n "not __fish_seen_subcommand_from set list next prev random rotate status stop open edit help" -a open -d "Open wallpapers folder"
complete -c wallpaper -n "not __fish_seen_subcommand_from set list next prev random rotate status stop open edit help" -a edit -d "Edit wallpaper manifest"
complete -c wallpaper -n "not __fish_seen_subcommand_from set list next prev random rotate status stop open edit help" -a help -d "Show help"
complete -c wallpaper -n "not __fish_seen_subcommand_from set list next prev random rotate status stop open edit help" -a interactive -d "Interactive selection"

complete -c wallpaper -n "__fish_seen_subcommand_from set" -a "(__wallpaper_names)" -d "Wallpaper name"
complete -c wallpaper -n "__fish_seen_subcommand_from rotate" -l duration -d "Rotation interval in seconds" -r
complete -c wallpaper -n "__fish_seen_subcommand_from rotate" -l folder -d "Limit rotation to folder" -r
