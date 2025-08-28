# If fish starts interactively, immediately hand off to zsh
if status is-interactive
    exec /usr/bin/zsh -l
end

