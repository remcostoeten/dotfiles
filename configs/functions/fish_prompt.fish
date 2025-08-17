function __git_info
    if not command -q git
        return 1
    end
    if not git rev-parse --is-inside-work-tree 2>/dev/null
        return 1
    end
    set -l branch (git symbolic-ref --short HEAD 2>/dev/null)
    if test -z "$branch"
        set branch (git describe --tags --always 2>/dev/null)
    end
    set -l dirty ""
    set -l porcelain (git status --porcelain 2>/dev/null)
    if test -n "$porcelain"
        set dirty "*"
    end
    printf "%s%s" $branch $dirty
end

function fish_prompt
    set -l last_status $status
    set -l c_reset (set_color normal)
    set -l c_dir (set_color brcyan)
    set -l c_git (set_color brmagenta)
    set -l c_symbol (set_color brgreen)
    if test $last_status -ne 0
        set c_symbol (set_color brred)
    end
    set -l folder_icon " "
    set -l git_icon "  "
    set -l cwd (prompt_pwd)
    set -l git_segment ""
    set -l info (__git_info)
    if test -n "$info"
        set git_segment "$c_git$git_icon$info$c_reset"
    end
    printf "%s%s%s %s%s%s %s" $c_dir $folder_icon $cwd $c_reset $git_segment $c_reset $c_symbol
    printf "❯ %s" $c_reset
end

