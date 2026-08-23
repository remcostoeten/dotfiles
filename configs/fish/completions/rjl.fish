complete -c rjl -f

complete -c rjl -n __fish_use_subcommand -a vdwv -d 'Target the vanderwalvans profile'
complete -c rjl -n __fish_use_subcommand -a vanderwalvans -d 'Target the vanderwalvans profile'
complete -c rjl -n __fish_use_subcommand -a all -d 'Target both app profiles'
complete -c rjl -n __fish_use_subcommand -a both -d 'Target both app profiles'

complete -c rjl -n '__fish_seen_subcommand_from vdwv vdw vanderwalvans rjl rj regeljelease all both' \
    -a 'stop down flush jira board pr newpr pipelines workspace help' -d 'Command for the selected app'

complete -c rjl -n __fish_use_subcommand -a stop -d 'Stop the stack'
complete -c rjl -n __fish_use_subcommand -a down -d 'Stop the stack'
complete -c rjl -n __fish_use_subcommand -a stopall -d 'Stop ALL running docker containers'
complete -c rjl -n __fish_use_subcommand -a flush -d 'Flush the Symfony cache (bin/console cache:clear)'
complete -c rjl -n __fish_use_subcommand -a jira -d "Open the current branch's DCR ticket in Jira"
complete -c rjl -n __fish_use_subcommand -a board -d 'Open the DCR Jira board'
complete -c rjl -n __fish_use_subcommand -a pr -d 'Open the current branch on Bitbucket (links to its PR)'
complete -c rjl -n __fish_use_subcommand -a newpr -d 'Create a PR from the current branch'
complete -c rjl -n __fish_use_subcommand -a pipelines -d "Open the repo's Bitbucket pipelines"
complete -c rjl -n __fish_use_subcommand -a workspace -d 'Open the Bitbucket workspace overview'
complete -c rjl -n __fish_use_subcommand -a help -d 'Show help'
complete -c rjl -n __fish_use_subcommand -l verbose -d 'Start attached, streaming logs in the foreground'
complete -c rjl -n __fish_use_subcommand -s s -l stop -d 'Stop the stack'
complete -c rjl -n __fish_use_subcommand -s f -l flush -d 'Flush the Symfony cache'
complete -c rjl -n __fish_use_subcommand -s h -l help -d 'Show help'

complete -c rjl -n '__fish_seen_subcommand_from stop' -a all -d 'Stop ALL running docker containers'
complete -c rjl -n '__fish_seen_subcommand_from pr' -a new -d 'Create a PR from the current branch'
