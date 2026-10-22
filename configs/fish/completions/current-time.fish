function __current_time_durations
    printf '%s\t%s\n' \
        15m "in 15 minutes" \
        30m "in 30 minutes" \
        45m "in 45 minutes" \
        1h "in 1 hour" \
        1h30m "in 1.5 hours" \
        2h "in 2 hours" \
        4h "in 4 hours" \
        8h "in 8 hours" \
        12h "in 12 hours" \
        1d "in 1 day"
end

set -l commands now in alarm zones help

complete -c current-time -f

complete -c current-time -s h -l help -d 'Show help'

complete -c current-time -n "not __fish_seen_subcommand_from $commands" -a now -d 'Show the current time everywhere'
complete -c current-time -n "not __fish_seen_subcommand_from $commands" -a in -d 'Show the time after a duration'
complete -c current-time -n "not __fish_seen_subcommand_from $commands" -a alarm -d 'Ring an alarm after a duration or at a time'
complete -c current-time -n "not __fish_seen_subcommand_from $commands" -a zones -d 'List the tracked locations'
complete -c current-time -n "not __fish_seen_subcommand_from $commands" -a help -d 'Show help for a command'

complete -c current-time -n "__fish_seen_subcommand_from in alarm" -a '(__current_time_durations)'
complete -c current-time -n "__fish_seen_subcommand_from alarm" -a at -d 'Ring at a clock time (HH:MM)'
complete -c current-time -n "__fish_seen_subcommand_from help" -a 'now in alarm zones help'
