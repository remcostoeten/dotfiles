complete -c kuizer -f
complete -c kuizer -n "__fish_use_subcommand" -a "detect fix restore init completion revert info help version"
complete -c kuizer -n "__fish_seen_subcommand_from completion" -l shell -s s -a "bash zsh fish"
complete -c kuizer -n "__fish_seen_subcommand_from init" -l global
complete -c kuizer -n "__fish_seen_subcommand_from init" -l project
complete -c kuizer -n "__fish_seen_subcommand_from restore revert" -l snapshot
complete -c kuizer -n "__fish_seen_subcommand_from detect fix restore" -l config -s c
complete -c kuizer -n "__fish_seen_subcommand_from detect fix restore" -l tsconfig
complete -c kuizer -n "__fish_seen_subcommand_from detect fix" -l only -s o
complete -c kuizer -n "__fish_seen_subcommand_from detect fix" -l skip -s s
complete -c kuizer -n "__fish_seen_subcommand_from detect" -l reporter -s r -a "terminal json"
complete -c kuizer -n "__fish_seen_subcommand_from detect" -l report -a "terminal json"
complete -c kuizer -n "__fish_seen_subcommand_from detect" -l json
complete -c kuizer -n "__fish_seen_subcommand_from detect" -l filter -s f
complete -c kuizer -n "__fish_seen_subcommand_from detect" -l exclude-pattern
complete -c kuizer -n "__fish_seen_subcommand_from detect" -l interactive
complete -c kuizer -n "__fish_seen_subcommand_from detect fix" -l include-ui
complete -c kuizer -n "__fish_seen_subcommand_from fix" -l dry-run
complete -c kuizer -n "__fish_seen_subcommand_from fix" -l dry
complete -c kuizer -n "__fish_seen_subcommand_from fix" -l dr
complete -c kuizer -n "__fish_seen_subcommand_from fix" -l write -s w
complete -c kuizer -n "__fish_seen_subcommand_from fix" -l no-backup
