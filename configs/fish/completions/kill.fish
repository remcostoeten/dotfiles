# Fish completions for smart kill wrapper
# Install: symlink or copy to ~/.config/fish/completions/kill.fish

complete -c kill -f -a "(ps -eo comm= | sort -u)" -d "Process name"
complete -c kill -s l -l list -d "List signal names"
complete -c kill -s L -d "List signal names (table)"
