#!/usr/bin/env fish

# DOCSTRING: Open current directory in file manager
function .
    xdg-open .
end

# DOCSTRING: Go back one directory
alias ..='cd ..'

# DOCSTRING: Go back two directories
alias ...='cd ../..'

# DOCSTRING: Go back three directories
alias ....='cd ../../..'

# DOCSTRING: Replace ls with eza
alias ls='eza --icons=auto'

# DOCSTRING: Better find replacement
if type -q fd
    alias find='fd'
else
    alias find='find'
end

# DOCSTRING: Custom list command showing size and name with ricer styling
function l
    if contains -- -h $argv; or contains -- --help $argv
        set -l rows \
            "#Usage" \
            "l [OPTIONS] [PATH...]|Sizes, age and git status, newest first" \
            "#Layout" \
            "-T, --tree|Show as a tree" \
            "-R, --recurse|Recurse into directories" \
            "-L, --level DEPTH|Limit recursion depth (with -T or -R)" \
            "--follow-symlinks|Follow symlinked directories" \
            "-w, --width COLS|Set screen width" \
            "#Filtering" \
            "-a, --all|Show hidden files, twice for . and .." \
            "-d, --treat-dirs-as-files|List folders themselves, not their contents" \
            "-D, --only-dirs|Only folders" \
            "-f, --only-files|Only files" \
            "--no-symlinks|Hide symlinks" \
            "-I, --ignore-glob GLOBS|Hide matching names, separate globs with a pipe" \
            "--git-ignore|Hide files in .gitignore" \
            "#Sorting" \
            "-s, --sort FIELD|name ext size modified created type none" \
            "-r, --reverse|Reverse the sort" \
            "--group-directories-last|Folders after files" \
            "#Columns" \
            "--header|Header row (-h shows this help)" \
            "-g, --group|File group" \
            "-i, --inode|Inode number" \
            "-H, --links|Hard link count" \
            "-o, --octal-permissions|Permissions as 0644" \
            "-@, --extended|Extended attributes" \
            "-Z, --context|SELinux context" \
            "-M, --mounts|Mount details" \
            "--loc|Lines of code and language" \
            "--git|Git status per file" \
            "--git-repos|Branch and state per repo folder" \
            "#Sizes" \
            "--total-size|Recursive folder size" \
            "-b, --binary|Binary prefixes (KiB, MiB)" \
            "-B, --bytes|Raw bytes" \
            "-S, --blocksize|Allocated blocks" \
            "#Time" \
            "-m / -u / -U|Modified / accessed / created time" \
            "--changed|Changed time" \
            "--time-style STYLE|default iso long-iso full-iso relative +FORMAT" \
            "#Hide columns" \
            "--no-permissions|Permissions" \
            "--no-filesize|Size" \
            "--no-user|Owner" \
            "--no-time|Date" \
            "--no-git|Git columns" \
            "#Display" \
            "-F, --classify|Type indicator after names" \
            "--absolute|Absolute paths" \
            "--color-scale all|Color sizes and ages by scale" \
            "--hyperlink|Clickable file names" \
            "--icons=WHEN|always auto never" \
            "-h, --help|Show this help" \
            "#Examples" \
            "l -a apps|Hidden files in apps" \
            "l --git -s modified -r|Recently changed first, with git status" \
            "l -T -L 2 --git-ignore|Two-level tree without ignored files" \
            "l -D --total-size|Folder sizes" \
            "l --header --time-style=iso|Header row and ISO dates"

        set -l width 80
        set -l blocks
        set -l block
        for row in $rows
            if string match -q -- "#*" $row
                set -q block[1]; and set -a blocks (string join \n -- $block "" | string collect)
                set block (set_color -o yellow)(string pad -r -w $width -- (string sub -s 2 -- $row))(set_color normal)
                continue
            end
            set -l parts (string split -m 1 "|" -- $row)
            set -a block "  "(set_color magenta)(string pad -r -w 28 -- $parts[1])(set_color normal)" "(string pad -r -w (math $width - 31) -- $parts[2])
        end
        set -a blocks (string join \n -- $block "" | string collect)

        set -l lines (string split \n -- (string join \n -- $blocks))
        if test "$COLUMNS" -ge (math "2 * $width + 2")
            set -l half (math "ceil("(count $lines)" / 2)")
            set -l split 0
            for b in $blocks
                test $split -ge $half; and break
                set split (math $split + (count (string split \n -- $b)))
            end
            set -l left $lines[1..$split]
            set -l right $lines[(math $split + 1)..-1]
            set -l blank (string repeat -n $width " ")
            set lines
            for i in (seq (math max (count $left), (count $right)))
                set -l l $blank
                set -l r ""
                set -q left[$i]; and set l $left[$i]
                set -q right[$i]; and set r $right[$i]
                test -z "$l"; and set l $blank
                set -a lines "$l  $r"
            end
        end

        if isatty stdout
            printf "%s\n" $lines | less -RFX
        else
            printf "%s\n" $lines
        end
        return 0
    end

    eza -l --icons=always --color=always --group-directories-first --header --git --no-user --no-permissions --time-style=relative -s modified -r $argv
end
