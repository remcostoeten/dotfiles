# Completions for the todo CLI (scripts/todo). Task IDs are read live from tasks.json.

function __todo_task_ids
    set -l data_dir $HOME/.dotfiles
    set -q DOTFILES_DATA_DIR; and set data_dir $DOTFILES_DATA_DIR
    set -l file $data_dir/todo/tasks.json
    test -r $file; or return
    command -q jq; or return
    jq -r '.[] | select(.status == "pending") | "\(.id)\t\(.description)"' $file 2>/dev/null
end

function __todo_unused_task_ids
    set -l typed (commandline -opc)
    __todo_task_ids | while read -l line
        set -l id (string split -f1 \t $line)
        contains -- $id $typed; or echo $line
    end
end

function __todo_at_positional --argument-names n
    set -l tokens (commandline -opc)
    set -e tokens[1]
    set -e tokens[1]
    set -l count 0
    set -l skip 0
    for token in $tokens
        if test $skip -eq 1
            set skip 0
            continue
        end
        switch $token
            case --due --priority --reminders --remind --under --parent --in --limit
                set skip 1
            case '-*'
            case '*'
                set count (math $count + 1)
        end
    end
    test $count -eq (math $n - 1)
end

set -l commands add epic sub due archive interactive i list tree shell-display done edit hide unhide move mv snooze rm delete rmall undo config typos help
set -l id_commands sub done edit hide unhide move mv snooze due
set -l add_like add epic sub

complete -c todo -f

# top level
complete -c todo -n __fish_use_subcommand -a add -d 'Add one or more tasks'
complete -c todo -n __fish_use_subcommand -a epic -d 'Create an epic that groups subtasks'
complete -c todo -n __fish_use_subcommand -a sub -d 'Add subtasks under an existing task'
complete -c todo -n __fish_use_subcommand -a archive -d 'List completed tasks, newest first'
complete -c todo -n __fish_use_subcommand -a interactive -d 'Open the keyboard-driven taskboard'
complete -c todo -n __fish_use_subcommand -a i -d 'Open the keyboard-driven taskboard'
complete -c todo -n __fish_use_subcommand -s i -l interactive -d 'Open the keyboard-driven taskboard'
complete -c todo -n __fish_use_subcommand -a list -d 'List tasks as a tree'
complete -c todo -n __fish_use_subcommand -a tree -d 'List tasks as a tree'
complete -c todo -n __fish_use_subcommand -a shell-display -d 'Print the compact pending-task panel'
complete -c todo -n __fish_use_subcommand -a done -d 'Complete a task and everything under it'
complete -c todo -n __fish_use_subcommand -a edit -d 'Replace a task description'
complete -c todo -n __fish_use_subcommand -a hide -d 'Hide a task or epic from the shell panel and list'
complete -c todo -n __fish_use_subcommand -a unhide -d 'Show a hidden task or epic again'
complete -c todo -n __fish_use_subcommand -a move -d 'Re-parent a task inside the tree'
complete -c todo -n __fish_use_subcommand -a mv -d 'Re-parent a task inside the tree'
complete -c todo -n __fish_use_subcommand -a due -d "Set, inspect, and clear due dates with reminders"
complete -c todo -n __fish_use_subcommand -a snooze -d "Push a task's due date forward"
complete -c todo -n __fish_use_subcommand -a rm -d 'Remove tasks and their subtasks'
complete -c todo -n __fish_use_subcommand -a delete -d 'Remove tasks and their subtasks'
complete -c todo -n __fish_use_subcommand -a rmall -d 'Remove every pending task'
complete -c todo -n __fish_use_subcommand -a undo -d 'Restore the most recently deleted tasks'
complete -c todo -n __fish_use_subcommand -a config -d 'Read or change persisted settings'
complete -c todo -n __fish_use_subcommand -a typos -d 'Review or forget learned typo corrections'
complete -c todo -n __fish_use_subcommand -a help -d 'Show help'
complete -c todo -n __fish_use_subcommand -s h -l help -d 'Show help'

# implicit add: plain text at the top level takes the add options too
complete -c todo -n "__fish_use_subcommand; or __fish_seen_subcommand_from $add_like" -l due -x -a '1h 30m tomorrow monday friday "next week"' -d 'Due date'
complete -c todo -n "__fish_use_subcommand; or __fish_seen_subcommand_from $add_like" -l priority -x -a 'none low medium high' -d 'Priority level'
complete -c todo -n "__fish_use_subcommand; or __fish_seen_subcommand_from $add_like" -l reminders -x -a '10 10,30 10,30,60' -d 'Minutes before due to notify'
complete -c todo -n "__fish_use_subcommand; or __fish_seen_subcommand_from $add_like" -l remind -x -a '10 10,30 10,30,60' -d 'Minutes before due to notify'
complete -c todo -n "__fish_use_subcommand; or __fish_seen_subcommand_from add epic" -l under -x -a '(__todo_task_ids)' -d 'Nest under task'
complete -c todo -n "__fish_use_subcommand; or __fish_seen_subcommand_from add epic" -l parent -x -a '(__todo_task_ids)' -d 'Nest under task'
complete -c todo -n "__fish_use_subcommand; or __fish_seen_subcommand_from add epic" -l in -x -a '(__todo_task_ids)' -d 'Nest under task'

# every command accepts --help
complete -c todo -n "__fish_seen_subcommand_from $commands" -s h -l help -d 'Show help for this command'

# first positional is a task id
complete -c todo -n "__fish_seen_subcommand_from $id_commands; and __todo_at_positional 1" -a '(__todo_task_ids)'

# rm accepts many ids, ranges, or all
complete -c todo -n '__fish_seen_subcommand_from rm delete' -a '(__todo_unused_task_ids)'
complete -c todo -n '__fish_seen_subcommand_from rm delete; and __todo_at_positional 1' -a all -d 'Remove every pending task'

# second positionals
complete -c todo -n '__fish_seen_subcommand_from move mv; and __todo_at_positional 2' -a '(__todo_task_ids)'
complete -c todo -n '__fish_seen_subcommand_from move mv; and __todo_at_positional 2' -a 'root top' -d 'Move to the top level'
complete -c todo -n '__fish_seen_subcommand_from snooze; and __todo_at_positional 2' -a '1h 30m tomorrow monday friday "next week"' -d 'New due date'

# list / shell-display flags
complete -c todo -n '__fish_seen_subcommand_from list tree' -l all -d 'Include completed tasks'
complete -c todo -n '__fish_seen_subcommand_from list tree' -l overdue -d 'Only pending tasks past their due date'
complete -c todo -n '__fish_seen_subcommand_from list tree' -l upcoming -d 'Only pending tasks due soon'
complete -c todo -n '__fish_seen_subcommand_from shell-display' -l limit -x -a '5 10 15 all' -d 'Rows to show'
complete -c todo -n '__fish_seen_subcommand_from shell-display' -l all -d 'Show every row'

# config keys and values
complete -c todo -n '__fish_seen_subcommand_from config; and __todo_at_positional 1' -a 'shell-limit' -d 'Pending tasks shown in the shell panel'
complete -c todo -n '__fish_seen_subcommand_from config; and __todo_at_positional 1' -a 'startup-notifications' -d 'Notify for due tasks on startup'
complete -c todo -n '__fish_seen_subcommand_from config; and __todo_at_positional 1' -a 'show-completed' -d 'Include completed tasks in listings'
complete -c todo -n '__fish_seen_subcommand_from config; and __todo_at_positional 2; and __fish_seen_subcommand_from shell-limit' -a '5 10 15 all'
complete -c todo -n '__fish_seen_subcommand_from config; and __todo_at_positional 1' -a 'autocorrect' -d 'Suggest and learn corrections for typos'
complete -c todo -n '__fish_seen_subcommand_from config; and __todo_at_positional 2; and __fish_seen_subcommand_from startup-notifications show-completed autocorrect' -a 'on off'

# typos
function __todo_learned_typos
    set -l data_dir $HOME/.dotfiles
    set -q DOTFILES_DATA_DIR; and set data_dir $DOTFILES_DATA_DIR
    set -l file $data_dir/todo/typos.json
    test -r $file; or return
    command -q jq; or return
    jq -r 'to_entries[] | "\(.key)\t→ \(.value | keys | join(", "))"' $file 2>/dev/null
end
complete -c todo -n '__fish_seen_subcommand_from typos; and __todo_at_positional 1' -a forget -d 'Forget one learned typo'
complete -c todo -n '__fish_seen_subcommand_from typos; and __todo_at_positional 1' -a reset -d 'Forget every learned typo'
complete -c todo -n '__fish_seen_subcommand_from typos; and __fish_seen_subcommand_from forget; and __todo_at_positional 2' -a '(__todo_learned_typos)'

# help <command>
complete -c todo -n '__fish_seen_subcommand_from help; and __todo_at_positional 1' -a "$commands"

# due: first positional is a task id or a subcommand, second is a date expression or a verb
complete -c todo -n '__fish_seen_subcommand_from due; and __todo_at_positional 1' -a list -d 'List todos with a due date'
complete -c todo -n '__fish_seen_subcommand_from due; and __todo_at_positional 1' -a daemon -d 'Background reminder scheduler'
complete -c todo -n '__fish_seen_subcommand_from due; and __todo_at_positional 2' -a 'clear' -d 'Remove the due date'
complete -c todo -n '__fish_seen_subcommand_from due; and __todo_at_positional 2' -a 'reset' -d 'Rearm the notification'
complete -c todo -n '__fish_seen_subcommand_from due; and __todo_at_positional 2' -a '30s 10m 1h 3,5h 2d today tomorrow yesterday "next week" "next monday" 12-06 "12 juli"' -d 'Due date'
complete -c todo -n '__fish_seen_subcommand_from due; and __fish_seen_subcommand_from list' -a 'overdue today week' -d 'Filter'
complete -c todo -n '__fish_seen_subcommand_from due; and __fish_seen_subcommand_from daemon' -a 'run install status' -d 'Scheduler action'
complete -c todo -n '__fish_seen_subcommand_from due' -l sound -x -a 'default none' -d 'Notification sound'
complete -c todo -n '__fish_seen_subcommand_from due' -l run -x -d 'Command to run when due'
complete -c todo -n '__fish_seen_subcommand_from due' -l cwd -x -a 'pwd' -d 'Working directory for --run'
