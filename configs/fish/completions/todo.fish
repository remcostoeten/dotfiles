# Generated from the command spec by `todo completions fish`. Do not edit by hand.

complete -c todo -e
complete -c todo -f

function __todo_walk --description 'Print the canonical todo command path and the count of arguments after it'
    set -l tokens (commandline -opc)
    set -e tokens[1]
    set -l path
    set -l extra 0
    for token in $tokens
        if string match -q -- '-*' $token
            continue
        end
        if test $extra -eq 0
            set -l key (string join ' ' -- $path $token)
            set -l index (contains -i -- $key $__todo_node_keys)
            if test -n "$index"
                set path (string split ' ' -- $__todo_node_paths[$index])
                continue
            end
        end
        set extra (math $extra + 1)
    end
    echo "path:$path"
    echo $extra
end

function __todo_at --description 'True when the command line sits right after the given todo command path'
    set -l state (__todo_walk)
    test "$state[1]" = "path:$argv[1]"; and test "$state[2]" -eq 0
end

function __todo_in --description 'True when the command line is inside the given todo command path'
    set -l state (__todo_walk)
    test "$state[1]" = "path:$argv[1]"
end

set -g __todo_node_keys 'add' 'epic' 'sub' 'board' 'focus' 'list' 'tree' 'panel' 'archive' 'removed' 'trash' 'interactive' 'i' 'done' 'edit' 'hide' 'unhide' 'due' 'move' 'mv' 'reorder' 'snooze' 'open' 'close' 'rm' 'delete' 'undo' 'revert' 'restore' 'config' 'help' 'typos' 'completions' 'board list' 'board ls' 'board new' 'board use' 'board off' 'board show' 'board add' 'board rm' 'board remove' 'board move' 'board mv' 'board later' 'board now' 'board extend' 'board rename' 'board end' 'board delete' 'archive restore' 'due list' 'due daemon' 'due daemon run' 'due daemon install' 'due daemon status' 'open all' 'close all' 'rm all' 'config panel-limit' 'config panel-layout' 'config panel-boards' 'config startup-notifications' 'config show-completed' 'config autocorrect' 'typos forget' 'typos reset' 'completions fish'
set -g __todo_node_paths 'add' 'epic' 'sub' 'board' 'focus' 'list' 'list' 'panel' 'archive' 'archive' 'archive' 'interactive' 'interactive' 'done' 'edit' 'hide' 'unhide' 'due' 'move' 'move' 'reorder' 'snooze' 'open' 'close' 'rm' 'rm' 'undo' 'undo' 'undo' 'config' 'help' 'typos' 'completions' 'board list' 'board list' 'board new' 'board use' 'board off' 'board show' 'board add' 'board rm' 'board rm' 'board move' 'board move' 'board later' 'board now' 'board extend' 'board rename' 'board end' 'board end' 'archive restore' 'due list' 'due daemon' 'due daemon run' 'due daemon install' 'due daemon status' 'open all' 'close all' 'rm all' 'config panel-limit' 'config panel-layout' 'config panel-boards' 'config startup-notifications' 'config show-completed' 'config autocorrect' 'typos forget' 'typos reset' 'completions fish'

complete -c todo -s h -l help -d 'Show help for the command'
complete -c todo -n '__todo_at \'\'' -a 'add' -d 'Add one or more tasks.'
complete -c todo -n '__todo_at \'\'' -a 'epic' -d 'Create an epic that groups subtasks.'
complete -c todo -n '__todo_at \'\'' -a 'sub' -d 'Add subtasks under an existing task.'
complete -c todo -n '__todo_at \'\'' -a 'board' -d 'Curated views of tasks with Now and Later lanes.'
complete -c todo -n '__todo_at \'\'' -a 'focus' -d 'Start a timed board: shortcut for board new --for.'
complete -c todo -n '__todo_at \'\'' -a 'list' -d 'List tasks as a tree.'
complete -c todo -n '__todo_at \'\'' -a 'panel' -d 'Print the compact task panel shown at shell startup.'
complete -c todo -n '__todo_at \'\'' -a 'archive' -d 'List completed and removed tasks, newest first.'
complete -c todo -n '__todo_at \'\'' -a 'interactive' -d 'Open the keyboard-driven taskboard.'
complete -c todo -n '__todo_at \'\'' -a 'done' -d 'Complete a task and everything under it.'
complete -c todo -n '__todo_at \'\'' -a 'edit' -d 'Replace a task description.'
complete -c todo -n '__todo_at \'\'' -a 'hide' -d 'Hide a task or epic from the shell panel and list.'
complete -c todo -n '__todo_at \'\'' -a 'unhide' -d 'Show a hidden task or epic again.'
complete -c todo -n '__todo_at \'\'' -a 'due' -d 'Set, inspect, and clear due dates with reminders.'
complete -c todo -n '__todo_at \'\'' -a 'move' -d 'Re-parent a task inside the tree.'
complete -c todo -n '__todo_at \'\'' -a 'reorder' -d 'Change a task\'s position among its siblings.'
complete -c todo -n '__todo_at \'\'' -a 'snooze' -d 'Push a task\'s due date forward.'
complete -c todo -n '__todo_at \'\'' -a 'open' -d 'Expand an epic so its subtickets render again.'
complete -c todo -n '__todo_at \'\'' -a 'close' -d 'Collapse an epic into a single subticket-count line.'
complete -c todo -n '__todo_at \'\'' -a 'rm' -d 'Remove tasks and their subtasks.'
complete -c todo -n '__todo_at \'\'' -a 'undo' -d 'Restore the most recently deleted task or tasks.'
complete -c todo -n '__todo_at \'\'' -a 'config' -d 'Read or change persisted settings.'
complete -c todo -n '__todo_at \'\'' -a 'help' -d 'Browse the searchable help, or show help for one command.'
complete -c todo -n '__todo_at \'\'' -a 'typos' -d 'Review or forget learned typo corrections.'
complete -c todo -n '__todo_at \'\'' -a 'completions' -d 'Print shell completions generated from the command tree.'
complete -c todo -n '__todo_in \'add\'' -l due -x -d 'Due date: 1h, 30m, tomorrow, monday, next week, 16/08/2026'
complete -c todo -n '__todo_in \'add\'' -l priority -x -a 'none low medium high' -d 'none (default), low, medium, or high'
complete -c todo -n '__todo_in \'add\'' -l reminders -l remind -x -d 'Comma list of minutes before the due date to notify'
complete -c todo -n '__todo_in \'add\'' -l under -l parent -l in -x -a '(todo completions --list task)' -d 'Nest the new tasks under an existing task'
complete -c todo -n '__todo_in \'add\'' -l later -d 'Put the new tasks in the active board\'s Later lane'
complete -c todo -n '__todo_in \'add\'' -l off-board -d 'Keep the new tasks off the active board'
complete -c todo -n '__todo_in \'epic\'' -l due -x -d 'Due date: 1h, 30m, tomorrow, monday, next week, 16/08/2026'
complete -c todo -n '__todo_in \'epic\'' -l priority -x -a 'none low medium high' -d 'none (default), low, medium, or high'
complete -c todo -n '__todo_in \'epic\'' -l reminders -l remind -x -d 'Comma list of minutes before the due date to notify'
complete -c todo -n '__todo_in \'epic\'' -l under -l parent -l in -x -a '(todo completions --list task)' -d 'Nest the epic under another task'
complete -c todo -n '__todo_in \'epic\'' -l later -d 'Put the new tasks in the active board\'s Later lane'
complete -c todo -n '__todo_in \'epic\'' -l off-board -d 'Keep the new tasks off the active board'
complete -c todo -n '__todo_in \'sub\'' -a '(todo completions --list task)'
complete -c todo -n '__todo_in \'sub\'' -l due -x -d 'Due date: 1h, 30m, tomorrow, monday, next week, 16/08/2026'
complete -c todo -n '__todo_in \'sub\'' -l priority -x -a 'none low medium high' -d 'none (default), low, medium, or high'
complete -c todo -n '__todo_in \'sub\'' -l reminders -l remind -x -d 'Comma list of minutes before the due date to notify'
complete -c todo -n '__todo_in \'sub\'' -l later -d 'Put the new tasks in the active board\'s Later lane'
complete -c todo -n '__todo_in \'sub\'' -l off-board -d 'Keep the new tasks off the active board'
complete -c todo -n '__todo_at \'board\'' -a 'list' -d 'List boards; * marks the active one.'
complete -c todo -n '__todo_at \'board\'' -a 'new' -d 'Create a board and make it active.'
complete -c todo -n '__todo_at \'board\'' -a 'use' -d 'Make a board the active one.'
complete -c todo -n '__todo_at \'board\'' -a 'off' -d 'Show all tasks again; boards and their timers keep running.'
complete -c todo -n '__todo_at \'board\'' -a 'show' -d 'Print a board\'s Now and Later lanes.'
complete -c todo -n '__todo_at \'board\'' -a 'add' -d 'Put tasks on a board (Now unless --later).'
complete -c todo -n '__todo_at \'board\'' -a 'rm' -d 'Take tasks off a board; the tasks themselves stay.'
complete -c todo -n '__todo_at \'board\'' -a 'move' -d 'Move tasks to another board, keeping their lane.'
complete -c todo -n '__todo_at \'board\'' -a 'later' -d 'Move tasks to Later, adding them when needed.'
complete -c todo -n '__todo_at \'board\'' -a 'now' -d 'Move tasks to Now, adding them when needed.'
complete -c todo -n '__todo_at \'board\'' -a 'extend' -d 'Give a timed board more time.'
complete -c todo -n '__todo_at \'board\'' -a 'rename' -d 'Rename a board.'
complete -c todo -n '__todo_at \'board\'' -a 'end' -d 'Delete a board; a timed one nests its new tasks under an epic.'
complete -c todo -n '__todo_in \'board new\'' -l for -x -d 'Make it a timed board: 4h, 90m, 2h30m (24h at most)'
complete -c todo -n '__todo_in \'board use\'' -a '(todo completions --list board)'
complete -c todo -n '__todo_in \'board show\'' -a '(todo completions --list board)'
complete -c todo -n '__todo_in \'board add\'' -a '(todo completions --list task)'
complete -c todo -n '__todo_in \'board add\'' -l later -d 'Put them in Later'
complete -c todo -n '__todo_in \'board add\'' -l on -x -a '(todo completions --list board)' -d 'Board to change instead of the active one'
complete -c todo -n '__todo_in \'board rm\'' -a '(todo completions --list task)'
complete -c todo -n '__todo_in \'board rm\'' -l on -x -a '(todo completions --list board)' -d 'Board to change instead of the active one'
complete -c todo -n '__todo_in \'board move\'' -a '(todo completions --list task)'
complete -c todo -n '__todo_in \'board move\'' -l to -x -a '(todo completions --list board)' -d 'Board to move them to'
complete -c todo -n '__todo_in \'board move\'' -l from -x -a '(todo completions --list board)' -d 'Board to take them off; defaults to the active one'
complete -c todo -n '__todo_in \'board move\'' -l later -d 'Put them in Later on the new board'
complete -c todo -n '__todo_in \'board move\'' -l now -d 'Put them in Now on the new board'
complete -c todo -n '__todo_in \'board later\'' -a '(todo completions --list task)'
complete -c todo -n '__todo_in \'board later\'' -l on -x -a '(todo completions --list board)' -d 'Board to change instead of the active one'
complete -c todo -n '__todo_in \'board now\'' -a '(todo completions --list task)'
complete -c todo -n '__todo_in \'board now\'' -l on -x -a '(todo completions --list board)' -d 'Board to change instead of the active one'
complete -c todo -n '__todo_in \'board extend\'' -l on -x -a '(todo completions --list board)' -d 'Board to change instead of the active one'
complete -c todo -n '__todo_in \'board rename\'' -a '(todo completions --list board)'
complete -c todo -n '__todo_in \'board end\'' -a '(todo completions --list board)'
complete -c todo -n '__todo_in \'list\'' -l all -d 'Every task including completed and hidden ones, ignoring the active board'
complete -c todo -n '__todo_in \'list\'' -l overdue -d 'Only pending tasks past their due date'
complete -c todo -n '__todo_in \'list\'' -l upcoming -d 'Only pending tasks due soon'
complete -c todo -n '__todo_in \'panel\'' -l side -d 'Board lanes in columns, however narrow the terminal'
complete -c todo -n '__todo_in \'panel\'' -l stack -d 'Board lanes stacked'
complete -c todo -n '__todo_in \'panel\'' -l boards -d 'Every board as a column, the active one marked with *'
complete -c todo -n '__todo_in \'panel\'' -l limit -x -a 'all' -d 'Rows per lane before folding the rest into a summary line'
complete -c todo -n '__todo_in \'panel\'' -l all -d 'Every pending task, ignoring the active board and the limit'
complete -c todo -n '__todo_at \'archive\'' -a 'restore' -d 'Bring archived tasks back.'
complete -c todo -n '__todo_in \'archive\'' -l removed -l deleted -d 'Only removed tasks'
complete -c todo -n '__todo_in \'archive\'' -l done -l completed -d 'Only completed tasks'
complete -c todo -n '__todo_in \'archive\'' -l since -x -d 'Newer than: 7d, 12h, 2w (ago) or a date'
complete -c todo -n '__todo_in \'archive\'' -l until -x -d 'Older than: 7d, 12h, 2w (ago) or a date'
complete -c todo -n '__todo_in \'archive\'' -l interactive -s i -d 'Open the restore picker'
complete -c todo -n '__todo_in \'archive restore\'' -a '(todo completions --list archive)'
complete -c todo -n '__todo_in \'archive restore\'' -l to -x -a '(todo completions --list task)' -d 'Restore under this task, or top for the top level'
complete -c todo -n '__todo_in \'done\'' -a '(todo completions --list task)'
complete -c todo -n '__todo_in \'edit\'' -a '(todo completions --list task)'
complete -c todo -n '__todo_in \'hide\'' -a '(todo completions --list task)'
complete -c todo -n '__todo_in \'unhide\'' -a '(todo completions --list task)'
complete -c todo -n '__todo_at \'due\'' -a 'list' -d 'Every pending todo that has a due date, most urgent first.'
complete -c todo -n '__todo_at \'due\'' -a 'daemon' -d 'The background scheduler that delivers reminders.'
complete -c todo -n '__todo_in \'due\'' -a '(todo completions --list task)'
complete -c todo -n '__todo_in \'due\'' -l sound -r -F -d 'default, none, or a sound file stored as an absolute path'
complete -c todo -n '__todo_in \'due\'' -l run -x -d 'Command to execute once when the reminder fires'
complete -c todo -n '__todo_in \'due\'' -l cwd -r -F -d 'Working directory for --run; pwd captures the current one'
complete -c todo -n '__todo_in \'due list\'' -a 'overdue today week'
complete -c todo -n '__todo_at \'due daemon\'' -a 'run' -d 'Run the scheduler in the foreground; this is what the service starts.'
complete -c todo -n '__todo_at \'due daemon\'' -a 'install' -d 'Write and enable a systemd user service so reminders survive a reboot.'
complete -c todo -n '__todo_at \'due daemon\'' -a 'status' -d 'Report whether the service is running.'
complete -c todo -n '__todo_in \'move\'' -a '(todo completions --list task)'
complete -c todo -n '__todo_in \'reorder\'' -a '(todo completions --list task)'
complete -c todo -n '__todo_in \'reorder\'' -l before -x -a '(todo completions --list task)' -d 'Place right above this sibling'
complete -c todo -n '__todo_in \'reorder\'' -l after -x -a '(todo completions --list task)' -d 'Place right below this sibling'
complete -c todo -n '__todo_in \'reorder\'' -l top -d 'First among its siblings'
complete -c todo -n '__todo_in \'reorder\'' -l bottom -d 'Last among its siblings'
complete -c todo -n '__todo_in \'snooze\'' -a '(todo completions --list task)'
complete -c todo -n '__todo_at \'open\'' -a 'all' -d 'Expand every epic.'
complete -c todo -n '__todo_in \'open\'' -a '(todo completions --list epic)'
complete -c todo -n '__todo_at \'close\'' -a 'all' -d 'Collapse every epic.'
complete -c todo -n '__todo_in \'close\'' -a '(todo completions --list epic)'
complete -c todo -n '__todo_at \'rm\'' -a 'all' -d 'Remove every pending task.'
complete -c todo -n '__todo_in \'rm\'' -a '(todo completions --list task)'
complete -c todo -n '__todo_at \'config\'' -a 'panel-limit' -d 'Pending tasks shown per lane in the shell panel (number, or \'all\')'
complete -c todo -n '__todo_at \'config\'' -a 'panel-layout' -d 'Board lanes in the shell panel: auto (columns when wide), side (always columns) or stack'
complete -c todo -n '__todo_at \'config\'' -a 'panel-boards' -d 'Boards in the shell panel: active (its Now and Later lanes) or all (one column per board)'
complete -c todo -n '__todo_at \'config\'' -a 'startup-notifications' -d 'Send desktop notifications for due tasks on startup (on/off)'
complete -c todo -n '__todo_at \'config\'' -a 'show-completed' -d 'Include completed tasks in listings by default (on/off)'
complete -c todo -n '__todo_at \'config\'' -a 'autocorrect' -d 'Suggest and learn corrections for mistyped commands, options and values (on/off)'
complete -c todo -n '__todo_in \'config panel-limit\'' -a 'all'
complete -c todo -n '__todo_in \'config panel-layout\'' -a 'auto side stack'
complete -c todo -n '__todo_in \'config panel-boards\'' -a 'active all'
complete -c todo -n '__todo_in \'config startup-notifications\'' -a 'on off'
complete -c todo -n '__todo_in \'config show-completed\'' -a 'on off'
complete -c todo -n '__todo_in \'config autocorrect\'' -a 'on off'
complete -c todo -n '__todo_in \'help\'' -l plain -d 'Print the overview instead of opening the browser'
complete -c todo -n '__todo_at \'typos\'' -a 'forget' -d 'Forget what was learned for one typo.'
complete -c todo -n '__todo_at \'typos\'' -a 'reset' -d 'Forget every learned typo.'
complete -c todo -n '__todo_at \'completions\'' -a 'fish' -d 'Fish completions for every command, flag and value.'
