# Fish completions for wallpaper

set -l wallpaper_commands set list next prev random rotate status stop open edit help interactive download add get browse open-site sites search find mkdir move rename delete rm remove import meta

function __wallpaper_names
    set -l manifest "$HOME/.config/dotfiles/configs/wallpapers/manifest.tsv"

    if not test -f "$manifest"
        return
    end

    awk -F '\t' '
        $1 !~ /^#/ && NF >= 2 && $1 != "" { print $1 }
    ' "$manifest"
end

function __wallpaper_folders
    set -l dir "$HOME/.config/dotfiles/configs/wallpapers"

    if not test -d "$dir"
        return
    end

    find "$dir" -mindepth 1 -type d -printf '%P\n' 2>/dev/null | sort
end

function __wallpaper_tags
    set -l metadata "$HOME/.config/dotfiles/configs/wallpapers/.metadata.tsv"

    if not test -f "$metadata"
        return
    end

    awk -F '\t' '$1 !~ /^#/ { print $2 }' "$metadata" \
        | string split ',' \
        | string trim \
        | string match -rv '^$' \
        | sort -u
end

complete -c wallpaper -f

complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a set -d "Set active wallpaper"
complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a list -d "List wallpapers"
complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a next -d "Next wallpaper"
complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a prev -d "Previous wallpaper"
complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a random -d "Random wallpaper"
complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a rotate -d "Start background rotation"
complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a status -d "Show rotation status"
complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a stop -d "Stop rotation"
complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a open -d "Open wallpapers folder"
complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a edit -d "Edit wallpaper manifest"
complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a download -d "Download wallpaper from URL"
complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a add -d "Alias for download"
complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a get -d "Alias for download"
complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a browse -d "Open a wallpaper site in the browser"
complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a sites -d "List known wallpaper sites"
complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a search -d "Search wallhaven and download results"
complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a mkdir -d "Create a wallpaper folder"
complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a move -d "Move wallpapers to a folder"
complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a rename -d "Rename a wallpaper"
complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a delete -d "Delete wallpapers"
complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a import -d "Import files, folders, or URLs"
complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a meta -d "Edit wallpaper metadata"
complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a help -d "Show help"
complete -c wallpaper -n "not __fish_seen_subcommand_from $wallpaper_commands" -a interactive -d "Interactive selection"

complete -c wallpaper -n "__fish_seen_subcommand_from set" -a "(__wallpaper_names)" -d "Wallpaper name"
complete -c wallpaper -n "__fish_seen_subcommand_from list" -l sort -a "name folder recent" -d "Sort order" -r
complete -c wallpaper -n "__fish_seen_subcommand_from list" -l folder -a "(__wallpaper_folders)" -d "Limit to folder" -r
complete -c wallpaper -n "__fish_seen_subcommand_from list" -l tag -a "(__wallpaper_tags)" -d "Limit to tag" -r
complete -c wallpaper -n "__fish_seen_subcommand_from list" -l query -d "Search names and metadata" -r
complete -c wallpaper -n "__fish_seen_subcommand_from rotate" -l duration -d "Rotation interval in seconds" -r
complete -c wallpaper -n "__fish_seen_subcommand_from rotate" -l folder -d "Limit rotation to folder" -r

complete -c wallpaper -n "__fish_seen_subcommand_from browse" -a "wallhaven unsplash pexels pixabay reddit wallpaperflare" -d Site

complete -c wallpaper -n "__fish_seen_subcommand_from download add get" -l folder -a "(__wallpaper_folders)" -d "Target folder" -r
complete -c wallpaper -n "__fish_seen_subcommand_from download add get" -l name -d "Manifest name" -r
complete -c wallpaper -n "__fish_seen_subcommand_from download add get" -l tags -d "Comma separated tags" -r
complete -c wallpaper -n "__fish_seen_subcommand_from download add get" -l clip -d "Take the URL from the clipboard"
complete -c wallpaper -n "__fish_seen_subcommand_from download add get" -l apply -d "Apply the wallpaper after downloading"
complete -c wallpaper -n "__fish_seen_subcommand_from download add get" -l source -d "Source page URL" -r
complete -c wallpaper -n "__fish_seen_subcommand_from download add get" -l author -d "Wallpaper author" -r
complete -c wallpaper -n "__fish_seen_subcommand_from download add get" -l license -d "Wallpaper license" -r

complete -c wallpaper -n "__fish_seen_subcommand_from search find" -l folder -a "(__wallpaper_folders)" -d "Target folder" -r
complete -c wallpaper -n "__fish_seen_subcommand_from search find" -l limit -d "How many results to download" -r
complete -c wallpaper -n "__fish_seen_subcommand_from search find" -l resolution -d "Minimum resolution (WxH)" -r
complete -c wallpaper -n "__fish_seen_subcommand_from search find" -l sorting -a "relevance date_added views favorites toplist random" -d "Sort order" -r
complete -c wallpaper -n "__fish_seen_subcommand_from search find" -l urls -d "Print URLs instead of downloading"

complete -c wallpaper -n "__fish_seen_subcommand_from mkdir" -a "(__wallpaper_folders)" -d "Parent folder"
complete -c wallpaper -n "__fish_seen_subcommand_from move" -a "(__wallpaper_folders) (__wallpaper_names)"
complete -c wallpaper -n "__fish_seen_subcommand_from rename delete rm remove meta" -a "(__wallpaper_names)" -d "Wallpaper name"
complete -c wallpaper -n "__fish_seen_subcommand_from rename" -l file -d "New image filename" -r
complete -c wallpaper -n "__fish_seen_subcommand_from rename" -l folder -a "(__wallpaper_folders)" -d "New folder" -r
complete -c wallpaper -n "__fish_seen_subcommand_from import" -F
