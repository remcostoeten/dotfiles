function fish_right_prompt
    set -l last_status $status
    set -l c_reset (set_color normal)
    set -l c_dim (set_color brblack)
    set -l parts
    if test $last_status -ne 0
        set parts "$c_dim⬤ $last_status$c_reset"
    end
    if test (count (jobs -p)) -gt 0
        set -a parts "$c_dim "(count (jobs -p))"$c_reset"
    end
    if set -q CMD_DURATION
        if test $CMD_DURATION -gt 100
            set -l ms $CMD_DURATION
            set -l s (math --scale=2 "$ms/1000")
            set -a parts (string join "" "$c_dim⏱  " $s "s" "$c_reset")
        end
    end
    printf "%s" (string join "  " $parts)
end

