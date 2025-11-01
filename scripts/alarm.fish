#!/usr/bin/env fish

# Interactive alarm script with flexible time parsing
# Usage: alarm [--in TIME] [--repeat TIME] [--help]
# Examples: alarm --in 10s, alarm --in 1h30m, alarm --repeat 5m

# Source colors
source ~/.config/dotfiles/configs/fish/core/colors.fish

function show_help
    echo
    printf "%s%s╔════════════════════════════════════════════════════════════════╗%s\n" "$fish_color_bright_cyan" "$fish_color_bold" "$fish_color_reset"
    printf "%s%s║%s  %sALARM%s %s- Interactive Timer & Alarm System%s               %s%s║%s\n" "$fish_color_bright_cyan" "$fish_color_bold" "$fish_color_reset" "$fish_color_bright_yellow" "$fish_color_reset" "$fish_color_dim" "$fish_color_reset" "$fish_color_bright_cyan" "$fish_color_bold" "$fish_color_reset"
    printf "%s%s╚════════════════════════════════════════════════════════════════╝%s\n" "$fish_color_bright_cyan" "$fish_color_bold" "$fish_color_reset"
    echo

    printf "%s%sUSAGE%s\n" "$fish_color_bright_yellow" "$fish_color_bold" "$fish_color_reset"
    printf "  %salarm%s %s[OPTIONS]%s\n" "$fish_color_green" "$fish_color_reset" "$fish_color_dim" "$fish_color_reset"
    echo

    printf "%s%sOPTIONS%s\n" "$fish_color_bright_yellow" "$fish_color_bold" "$fish_color_reset"
    printf "  %s--in%s %sTIME%s      Trigger alarm after %sTIME%s\n" "$fish_color_bright_green" "$fish_color_reset" "$fish_color_cyan" "$fish_color_reset" "$fish_color_cyan" "$fish_color_reset"
    printf "  %s--repeat%s %sTIME%s   Repeat alarm every %sTIME%s\n" "$fish_color_bright_green" "$fish_color_reset" "$fish_color_cyan" "$fish_color_reset" "$fish_color_cyan" "$fish_color_reset"
    printf "  %s--help%s          Show this help message\n" "$fish_color_bright_green" "$fish_color_reset"
    echo

    printf "%s%sTIME FORMATS%s\n" "$fish_color_bright_yellow" "$fish_color_bold" "$fish_color_reset"
    printf "  %s10s%s           10 seconds\n" "$fish_color_cyan" "$fish_color_reset"
    printf "  %s5m%s            5 minutes\n" "$fish_color_cyan" "$fish_color_reset"
    printf "  %s2h%s            2 hours\n" "$fish_color_cyan" "$fish_color_reset"
    printf "  %s1h30m15s%s      1 hour, 30 minutes, 15 seconds\n" "$fish_color_cyan" "$fish_color_reset"
    echo

    printf "%s%sEXAMPLES%s\n" "$fish_color_bright_yellow" "$fish_color_bold" "$fish_color_reset"
    printf "  %salarm --in 10s%s                  %sSet alarm for 10 seconds%s\n" "$fish_color_green" "$fish_color_reset" "$fish_color_dim" "$fish_color_reset"
    printf "  %salarm --in 1h30m%s                %sSet alarm for 1.5 hours%s\n" "$fish_color_green" "$fish_color_reset" "$fish_color_dim" "$fish_color_reset"
    printf "  %salarm --repeat 5m%s               %sRepeat every 5 minutes%s\n" "$fish_color_green" "$fish_color_reset" "$fish_color_dim" "$fish_color_reset"
    printf "  %salarm%s                          %sInteractive mode%s\n" "$fish_color_green" "$fish_color_reset" "$fish_color_dim" "$fish_color_reset"
    echo

    printf "%s%sINTERACTIVE MODE%s\n" "$fish_color_bright_yellow" "$fish_color_bold" "$fish_color_reset"
    printf "  %sRun without arguments to enter interactive configuration%s\n" "$fish_color_dim" "$fish_color_reset"
    echo
end

function parse_time_to_seconds
    set -l time_str $argv[1]
    set -l total_seconds 0

    # Remove spaces
    set time_str (string replace -a ' ' '' $time_str)

    # Parse hours
    if string match -qr '\d+h' $time_str
        set -l hours (string match -r '(\d+)h' $time_str | head -1 | string match -r '\d+')
        if test -n "$hours"
            set total_seconds (math $total_seconds + $hours \* 3600)
        end
    end

    # Parse minutes (not followed by 's' to avoid matching 'ms')
    if string match -qr '\d+m' $time_str; and not string match -qr '\d+ms' $time_str
        set -l minutes (string match -r '(\d+)m' $time_str | head -1 | string match -r '\d+')
        if test -n "$minutes"
            set total_seconds (math $total_seconds + $minutes \* 60)
        end
    end

    # Parse seconds
    if string match -qr '\d+s' $time_str
        set -l seconds (string match -r '(\d+)s' $time_str | head -1 | string match -r '\d+')
        if test -n "$seconds"
            set total_seconds (math $total_seconds + $seconds)
        end
    end

    # If no unit specified, assume seconds
    if not string match -qr '[hms]' $time_str
        if string match -qr '^\d+$' $time_str
            set total_seconds $time_str
        end
    end

    echo $total_seconds
end

function format_duration
    set -l seconds $argv[1]
    set -l hours (math -s0 $seconds / 3600)
    set -l remaining (math $seconds % 3600)
    set -l minutes (math -s0 $remaining / 60)
    set -l secs (math $remaining % 60)

    set -l parts

    if test $hours -gt 0
        set parts $parts {$hours}h
    end

    if test $minutes -gt 0
        set parts $parts {$minutes}m
    end

    if test $secs -gt 0; or test (count $parts) -eq 0
        set parts $parts {$secs}s
    end

    string join '' $parts
end

function play_alarm_sound
    # Try multiple possible alarm sound locations
    set -l sound_files ~/Audio/alarm.mp3 ~/Audio/2869-preview.mp3
    
    set -l sound_file ""
    for file in $sound_files
        if test -f $file
            set sound_file $file
            break
        end
    end

    if test -n "$sound_file"
        if command -v mpv >/dev/null
            mpv --no-terminal --volume=80 $sound_file >/dev/null 2>&1 &
        else if command -v paplay >/dev/null
            paplay $sound_file >/dev/null 2>&1 &
        else if command -v aplay >/dev/null
            aplay $sound_file >/dev/null 2>&1 &
        else
            printf "%s%s[WARNING]%s No audio player found (mpv, paplay, aplay)\n" "$fish_color_yellow" "$fish_color_bold" "$fish_color_reset"
        end
    else
        printf "%s%s[WARNING]%s Alarm sound not found. Please download one to ~/Audio/alarm.mp3\n" "$fish_color_yellow" "$fish_color_bold" "$fish_color_reset"
        # Fallback: use system bell
        printf "\a"
    end
end

function run_alarm
    set -l duration_seconds $argv[1]
    set -l is_repeat $argv[2]

    set -l start_time (date +%s)
    set -l end_time (math $start_time + $duration_seconds)
    set -l formatted_duration (format_duration $duration_seconds)

    if test "$is_repeat" = "true"
        printf "%s%s[ALARM]%s Repeating alarm every %s%s%s started\n" "$fish_color_green" "$fish_color_bold" "$fish_color_reset" "$fish_color_cyan" $formatted_duration "$fish_color_reset"
    else
        printf "%s%s[ALARM]%s Timer for %s%s%s started\n" "$fish_color_green" "$fish_color_bold" "$fish_color_reset" "$fish_color_cyan" $formatted_duration "$fish_color_reset"
    end

    while true
        set -l current_time (date +%s)
        set -l remaining (math $end_time - $current_time)

        if test $remaining -le 0
            printf "\n%s%s🔔 ALARM! 🔔%s\n" "$fish_color_bright_red" "$fish_color_bold" "$fish_color_reset"
            printf "%s%s[ALARM]%s Timer finished! Duration: %s%s%s\n" "$fish_color_bright_red" "$fish_color_bold" "$fish_color_reset" "$fish_color_cyan" $formatted_duration "$fish_color_reset"

            play_alarm_sound

            if test "$is_repeat" = "true"
                printf "%s%s[REPEAT]%s Starting next cycle in 2 seconds...\n" "$fish_color_yellow" "$fish_color_bold" "$fish_color_reset"
                sleep 2
                set end_time (math (date +%s) + $duration_seconds)
                printf "%s%s[ALARM]%s Next alarm cycle started\n" "$fish_color_green" "$fish_color_bold" "$fish_color_reset"
            else
                break
            end
        else
            set -l remaining_formatted (format_duration $remaining)
            printf "\r%s%s[TIMER]%s %s remaining" "$fish_color_blue" "$fish_color_bold" "$fish_color_reset" $remaining_formatted
        end

        sleep 1
    end

    printf "\n%s%s[DONE]%s Alarm completed\n" "$fish_color_green" "$fish_color_bold" "$fish_color_reset"
end

function interactive_mode
    printf "%s%s╔════════════════════════════════════════════════════════════════╗%s\n" "$fish_color_bright_cyan" "$fish_color_bold" "$fish_color_reset"
    printf "%s%s║%s  %sINTERACTIVE ALARM SETUP%s                                  %s%s║%s\n" "$fish_color_bright_cyan" "$fish_color_bold" "$fish_color_reset" "$fish_color_bright_yellow" "$fish_color_reset" "$fish_color_bright_cyan" "$fish_color_bold" "$fish_color_reset"
    printf "%s%s╚════════════════════════════════════════════════════════════════╝%s\n" "$fish_color_bright_cyan" "$fish_color_bold" "$fish_color_reset"
    echo

    printf "%s%s[1]%s One-time alarm\n" "$fish_color_green" "$fish_color_bold" "$fish_color_reset"
    printf "%s%s[2]%s Repeating alarm\n" "$fish_color_green" "$fish_color_bold" "$fish_color_reset"
    printf "%s%s[3]%s Help\n" "$fish_color_green" "$fish_color_bold" "$fish_color_reset"
    printf "%s%s[q]%s Quit\n" "$fish_color_red" "$fish_color_bold" "$fish_color_reset"
    echo

    printf "%sSelect option: %s" "$fish_color_cyan" "$fish_color_reset"
    read -l choice

    switch $choice
        case 1
            echo
            printf "%sEnter duration (e.g., 10s, 5m, 1h30m): %s" "$fish_color_cyan" "$fish_color_reset"
            read -l duration
            
            set -l seconds (parse_time_to_seconds $duration)
            if test $seconds -gt 0
                run_alarm $seconds false
            else
                printf "%s%s[ERROR]%s Invalid time format\n" "$fish_color_red" "$fish_color_bold" "$fish_color_reset"
            end

        case 2
            echo
            printf "%sEnter repeat interval (e.g., 10s, 5m, 1h): %s" "$fish_color_cyan" "$fish_color_reset"
            read -l interval
            
            set -l seconds (parse_time_to_seconds $interval)
            if test $seconds -gt 0
                run_alarm $seconds true
            else
                printf "%s%s[ERROR]%s Invalid time format\n" "$fish_color_red" "$fish_color_bold" "$fish_color_reset"
            end

        case 3
            show_help

        case q Q quit exit
            printf "%s%s[INFO]%s Goodbye!\n" "$fish_color_blue" "$fish_color_bold" "$fish_color_reset"

        case '*'
            printf "%s%s[ERROR]%s Invalid choice\n" "$fish_color_red" "$fish_color_bold" "$fish_color_reset"
    end
end

# Main execution
set -l argc (count $argv)

if test $argc -eq 0
    interactive_mode
    exit 0
end

# Parse arguments
set -l mode ""
set -l time_arg ""

for i in (seq 1 $argc)
    switch $argv[$i]
        case --help -h
            show_help
            exit 0

        case --in
            set mode "once"
            if test $i -lt $argc
                set time_arg $argv[(math $i + 1)]
            else
                printf "%s%s[ERROR]%s --in requires a time argument\n" "$fish_color_red" "$fish_color_bold" "$fish_color_reset"
                exit 1
            end

        case --repeat
            set mode "repeat"
            if test $i -lt $argc
                set time_arg $argv[(math $i + 1)]
            else
                printf "%s%s[ERROR]%s --repeat requires a time argument\n" "$fish_color_red" "$fish_color_bold" "$fish_color_reset"
                exit 1
            end
    end
end

if test -z "$mode"
    interactive_mode
    exit 0
end

if test -z "$time_arg"
    printf "%s%s[ERROR]%s No time specified\n" "$fish_color_red" "$fish_color_bold" "$fish_color_reset"
    exit 1
end

set -l seconds (parse_time_to_seconds $time_arg)

if test $seconds -le 0
    printf "%s%s[ERROR]%s Invalid time format: %s\n" "$fish_color_red" "$fish_color_bold" "$fish_color_reset" $time_arg
    exit 1
end

switch $mode
    case once
        run_alarm $seconds false
    case repeat
        run_alarm $seconds true
end