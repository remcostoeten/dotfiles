complete -c ghostty-theme -f

complete -c ghostty-theme -n __fish_use_subcommand -a pick -d "Open the live Ghostty appearance studio"
complete -c ghostty-theme -n __fish_use_subcommand -a toggle -d "Cycle curated themes"
complete -c ghostty-theme -n __fish_use_subcommand -a list -d "List all available themes"
complete -c ghostty-theme -n __fish_use_subcommand -a decorations -d "Toggle window decorations"
complete -c ghostty-theme -n __fish_use_subcommand -a opacity -d "Set background opacity (0..1)"
complete -c ghostty-theme -n __fish_use_subcommand -a font -d "Set font family"
complete -c ghostty-theme -n __fish_use_subcommand -a letter-spacing -d "Set letter spacing (adjust-cell-width, e.g. 2%)"
complete -c ghostty-theme -n __fish_use_subcommand -a line-height -d "Set line height (adjust-cell-height, e.g. 15%)"
complete -c ghostty-theme -n __fish_use_subcommand -a bg -d "List / set / cycle background image"
complete -c ghostty-theme -n __fish_use_subcommand -a bg-opacity -d "Set background-image-opacity (0..1)"
complete -c ghostty-theme -n __fish_use_subcommand -a help -d "Show usage"
complete -c ghostty-theme -n __fish_use_subcommand -a "(ghostty-theme list)" -d Theme

complete -c ghostty-theme -n "__fish_seen_subcommand_from opacity" -a "0.7 0.75 0.8 0.82 0.85 0.9 0.95 1.0" -d Opacity
complete -c ghostty-theme -n "__fish_seen_subcommand_from letter-spacing" -a "-5% -2% 0% 2% 5% 8% 10%" -d "Letter spacing"
complete -c ghostty-theme -n "__fish_seen_subcommand_from line-height" -a "0% 5% 10% 15% 20% 25% 30%" -d "Line height"
complete -c ghostty-theme -n "__fish_seen_subcommand_from font" -a "'JetBrainsMono Nerd Font' 'FiraCode Nerd Font' 'Hack Nerd Font' 'CaskaydiaCove Nerd Font' 'MesloLGS Nerd Font' 'ComicShannsMono Nerd Font' '0xProto Nerd Font' 'AnonymicePro Nerd Font' 'SpaceMono Nerd Font' 'Terminess Nerd Font'" -d Font

complete -c ghostty-theme -n "__fish_seen_subcommand_from bg" -a "list toggle none" -d "Background action"
complete -c ghostty-theme -n "__fish_seen_subcommand_from bg" -a "(ghostty-theme bg list | string replace -r '^[* ] ' '')" -d Background
complete -c ghostty-theme -n "__fish_seen_subcommand_from bg-opacity" -a "0.2 0.3 0.4 0.5 0.6 0.7 0.8 0.9 1.0" -d "Image opacity"
