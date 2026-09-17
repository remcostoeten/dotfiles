function __dotfiles_prompts
    for f in $HOME/.config/dotfiles/configs/starship/prompts/*.toml
        basename $f .toml
    end
end

complete -c dotfiles -f

complete -c dotfiles -n __fish_use_subcommand -a interactive -d 'Launch interactive menu'
complete -c dotfiles -n __fish_use_subcommand -a list -d 'List all tools'
complete -c dotfiles -n __fish_use_subcommand -a search -d 'Search tools'
complete -c dotfiles -n __fish_use_subcommand -a run -d 'Run a tool'
complete -c dotfiles -n __fish_use_subcommand -a help -d 'Help for a tool'
complete -c dotfiles -n __fish_use_subcommand -a categories -d 'Show categories'
complete -c dotfiles -n __fish_use_subcommand -a links -d 'Show managed symlinks'
complete -c dotfiles -n __fish_use_subcommand -a config -d 'Show or set config'
complete -c dotfiles -n __fish_use_subcommand -a prompt -d 'Switch starship prompt'

complete -c dotfiles -n '__fish_seen_subcommand_from prompt prompts' -a '(__dotfiles_prompts)' -d 'prompt'
complete -c dotfiles -n '__fish_seen_subcommand_from prompt prompts' -a next -d 'Cycle to next prompt'
complete -c dotfiles -n '__fish_seen_subcommand_from prompt prompts' -a prev -d 'Cycle to previous prompt'
complete -c dotfiles -n '__fish_seen_subcommand_from prompt prompts' -a preview -d 'Render prompts live'
complete -c dotfiles -n '__fish_seen_subcommand_from prompt prompts' -a current -d 'Print active prompt'
complete -c dotfiles -n '__fish_seen_subcommand_from prompt prompts' -a list -d 'List prompts'
