# Completions for rig (apps/rig)

complete -c rig -f
complete -c rig -n __fish_use_subcommand -a dev -d 'Start the dev server'
complete -c rig -n __fish_use_subcommand -a start -d 'Install, build, then run the production server'
complete -c rig -n __fish_use_subcommand -a install -d 'Install dependencies'
complete -c rig -n __fish_use_subcommand -a build -d 'Run the production build'
complete -c rig -n __fish_use_subcommand -a info -d 'Show what was detected'
complete -c rig -n __fish_use_subcommand -a help -d 'Show help'
complete -c rig -n '__fish_seen_subcommand_from help' -a 'dev start install build info'
complete -c rig -s p -l port -x -d 'Start from this port'
complete -c rig -s w -l workspace -x -d 'Package to run in a monorepo'
complete -c rig -s C -l cwd -r -d 'Run against another folder'
complete -c rig -l skip-build -d 'Start without building first'
complete -c rig -l no-color -d 'Plain output'
complete -c rig -s h -l help -d 'Show help'
complete -c rig -s V -l version -d 'Print the version'
