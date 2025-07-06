# ==============================================================================
# SECTION 3: PROCESS, PORT, AND FILE UTILITIES
# Dependencies: lsof or ss, fzf
# ==============================================================================

function kill-ports
    # Use the kill-dev tool from dotfiles
    set -l dotfiles_dir (dirname (status --current-filename))
    node $dotfiles_dir/../scripts/kill-development-ports/index.js $argv
end

function kill-dev
    kill-ports $argv
end


function ports
    kill-ports $argv
end

function backup
    if test (count $argv) -eq 0
        echo (set_color red)"Usage: backup <file>"(set_color normal)
        return 1
    end

    set -l file $argv[1]

    if not test -f $file
        echo (set_color red)"File not found: $file"(set_color normal)
        return 1
    end

    set -l timestamp (date "+%Y%m%d-%H%M%S")
    set -l backupfile "$file.$timestamp.bak"

    cp $file $backupfile

    if test $status -eq 0
        echo (set_color green)"Backup created: $backupfile"(set_color normal)
    else
        echo (set_color red)"Failed to create backup."(set_color normal)
    end
end
