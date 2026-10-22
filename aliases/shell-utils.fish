#!/usr/bin/env fish

# DOCSTRING: Clear terminal screen
alias c 'clear'

# DOCSTRING: Clear terminal screen and scrollback
alias clear "printf '\033[2J\033[3J\033[1;1H'"

# DOCSTRING: Exit terminal/shell
alias x 'exit'

# Use python3 as py
alias py 'python3'

# DOCSTRING: Use pip3 as pip
alias pip 'pip3'

# DOCSTRING: Typing `time` as a command expands to the `current-time` world clock
function __time_to_world_clock
    if test (count (commandline -xpc)) -le 1
        echo current-time
    else
        echo time
    end
end
abbr -a time_to_world_clock --position anywhere --regex '^time$' --function __time_to_world_clock

# DOCSTRING: Show disk usage in human-readable format
alias du='du -h'

# DOCSTRING: Show running processes
alias ps='ps aux'

# DOCSTRING: Faster grep replacement
alias grep='rg'

# DOCSTRING: rm + folder removal; task IDs (4, 1 2, 1,5,10-15) that aren't existing paths go to `todo rm`
function rm
    set -l is_task_ids (count $argv)
    for arg in $argv
        if not string match -qr '^#?\d+(-\d+)?(,#?\d+(-\d+)?)*$' -- $arg; or test -e $arg
            set is_task_ids 0
            break
        end
    end
    if test $is_task_ids -gt 0
        $HOME/.config/dotfiles/bin/todo rm $argv
    else
        set -l id_paths
        for arg in $argv
            if string match -qr '^#?\d+(-\d+)?(,#?\d+(-\d+)?)*$' -- $arg; and test -e $arg
                set -a id_paths $arg
            end
        end
        command rm -rf $argv
        or return
        for p in $id_paths
            set_color yellow
            echo "rm: deleted path '$p', not task #$p — use `todo rm $p` for the task" >&2
            set_color normal
        end
    end
end

# DOCSTRING: Create parent directories as needed
alias mkdir='mkdir -p'

# DOCSTRING: Modern system monitor
alias top='btm'

# DOCSTRING: Quick shell command helper
alias q='qs -c ii'

# DOCSTRING: Pacman shortcut
alias pamcan='pacman'

function claude-rjl --wraps claude
    env CLAUDE_CONFIG_DIR="$HOME/.claude" claude --dangerously-skip-permissions $argv
end

function claude --wraps claude
    env CLAUDE_CONFIG_DIR="$HOME/.claude-personal" claude $argv
end

# DOCSTRING: Explain `timer` usage and show the clock when `timer` is run without a command
function __timer_help
    set_color --bold yellow
    echo -n "timer"
    set_color normal
    echo " measures how long a command takes, so it needs one to run."
    echo
    set_color brblack
    echo -n "  usage  "
    set_color normal
    echo "timer <command> [args...]"
    set_color brblack
    echo -n "  e.g.   "
    set_color normal
    echo "timer bun run build"
    echo
    set_color brblack
    echo -n "  looking for the current time? it's "
    set_color --bold cyan
    echo -n (date '+%H:%M:%S')
    set_color brblack
    echo -n ", run "
    set_color normal
    echo -n time
    set_color brblack
    echo " for all time zones"
    set_color normal
end

# `time` is a fish keyword, so a bare `time` fails to parse before the abbreviation can run
function __time_guard_execute
    switch (string trim -- (commandline))
        case time
            commandline -r current-time
        case timer
            commandline -r __timer_help
    end
    commandline -f execute
end

if status is-interactive
    bind enter __time_guard_execute
end
