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
    set -l sound_files ~/Audio/alarm.mp3 ~/Music/alarm.mp3

    set -l sound_file ""
    for file in $sound_files
        if test -f $file
            set sound_file $file
            break
        end
    end

    if test -n "$sound_file"
        # Check if audio system is working
        set -l audio_working false

        # Try MPV with ALSA first (best compatibility)
        if command -v mpv >/dev/null
            mpv --no-terminal --volume=60 --ao=alsa $sound_file >/dev/null 2>&1 &
            set -l pid $last_pid

            # Wait a moment to see if MPV starts successfully
            sleep 0.5
            if kill -0 $pid 2>/dev/null
                # Audio started successfully, make it loop
                kill $pid 2>/dev/null
                mpv --no-terminal --volume=60 --ao=alsa --loop=inf $sound_file >/dev/null 2>&1 &
                echo $last_pid > /tmp/alarm_sound_pid
                set audio_working true
            end
        end

        # Fallback: Convert MP3 to WAV and use aplay if MPV didn't work
        if test "$audio_working" = false; and command -v ffmpeg >/dev/null; and command -v aplay >/dev/null
            if string match -q "*.mp3" $sound_file
                # Convert to WAV for better ALSA compatibility
                set -l wav_file "/tmp/alarm.wav"
                ffmpeg -i $sound_file -acodec pcm_s16le -ar 44100 -ac 2 $wav_file -y 2>/dev/null

                if test -f $wav_file
                    aplay $wav_file >/dev/null 2>&1 &
                    echo $last_pid > /tmp/alarm_sound_pid
                    set audio_working true
                end
            else
                aplay $sound_file >/dev/null 2>&1 &
                echo $last_pid > /tmp/alarm_sound_pid
                set audio_working true
            end
        end

        # If still no audio working, try pulseaudio
        if test "$audio_working" = false; and command -v paplay >/dev/null
            if pactl info >/dev/null 2>&1
                paplay --loop $sound_file >/dev/null 2>&1 &
                echo $last_pid > /tmp/alarm_sound_pid
                set audio_working true
            end
        end

        # Final fallback - show status and use system bell
        if test "$audio_working" = false
            printf "%s%s[WARNING]%s Audio playback failed - no working audio output found\n" "$fish_color_yellow" "$fish_color_bold" "$fish_color_reset"
            printf "%s%s[INFO]%s Check if audio system is running or headphones are connected\n" "$fish_color_blue" "$fish_color_bold" "$fish_color_reset"
            # Fallback: use system bell and visual alerts
            for i in (seq 1 5)
                printf "\a"
                sleep 0.2
            end
        end
    else
        printf "%s%s[WARNING]%s Alarm sound not found. Please download one to ~/Audio/alarm.mp3\n" "$fish_color_yellow" "$fish_color_bold" "$fish_color_reset"
        # Fallback: use system bell
        printf "\a"
    end
end

function stop_alarm_sound
    if test -f /tmp/alarm_sound_pid
        set -l pid (cat /tmp/alarm_sound_pid)
        if kill -0 $pid 2>/dev/null
            kill $pid 2>/dev/null
        end
        rm -f /tmp/alarm_sound_pid
    end
end

function send_alarm_notification
    set -l message $argv[1]
    set -l urgency $argv[2]

    # Method 1: Try notify-send with proper environment
    if command -v notify-send >/dev/null
        # Export DBUS session variables to ensure notification works
        set -lx DBUS_SESSION_BUS_ADDRESS $DBUS_SESSION_BUS_ADDRESS
        set -lx DISPLAY $DISPLAY
        set -lx XDG_RUNTIME_DIR $XDG_RUNTIME_DIR

        # Send notification
        notify-send \
            --urgency=$urgency \
            --app-name="Alarm" \
            --icon="alarm-clock" \
            --expire-time=0 \
            "🔔 ALARM! 🔔" \
            "$message

Run 'stop_alarm' to dismiss" &
    end

    # Method 2: Use zenity for visual dialog (GNOME friendly)
    if command -v zenity >/dev/null
        zenity --question --text="🔔 ALARM! 🔔\n\n$message\n\nClick OK to dismiss this alarm" --title="ALARM" --no-wrap --ok-label="Dismiss Alarm" &
        echo $last_pid > /tmp/alarm_zenity_pid
    end

    # Method 3: Use our custom notification script as fallback
    set -l script_dir (dirname (realpath (status --current-filename)))
    fish "$script_dir/../functions/send_notification.fish" "🔔 ALARM! 🔔" "$message\n\nRun 'stop_alarm' to dismiss" $urgency &

    # Method 4: Try to send a desktop notification via GNOME-specific method
    if command -v gdbus >/dev/null
        gdbus call --session --dest org.freedesktop.Notifications --object-path /org/freedesktop/Notifications --method org.freedesktop.Notifications.Notify "Alarm" 0 "alarm-clock" "🔔 ALARM! 🔔" "$message

Run 'stop_alarm' to dismiss" [] {} 0 2>/dev/null &
    end

    # Method 5: Terminal-based visual alert with blinking
    fish -c "
        for i in (seq 1 10)
            printf '\033]11;#ff0000\007'  # Red background
            printf '\r%s%s🔔 ALARM! 🔔%s\n' (tput setaf 1; tput bold) (tput sgr0)
            sleep 0.5
            printf '\033]11;#000000\007'  # Reset background
            printf '\r%s                     %s\n' (tput setaf 1; tput bold) (tput sgr0)
            sleep 0.5
        end
    " &
end

function stop_alarm
    printf "\n%s%s[STOPPED]%s Alarm stopped by user\n" "$fish_color_yellow" "$fish_color_bold" "$fish_color_reset"
    stop_alarm_sound

    # Stop zenity dialog if running
    if test -f /tmp/alarm_zenity_pid
        set -l zenity_pid (cat /tmp/alarm_zenity_pid)
        if kill -0 $zenity_pid 2>/dev/null
            kill $zenity_pid 2>/dev/null
        end
        rm -f /tmp/alarm_zenity_pid
    end

    rm -f /tmp/alarm_active /tmp/alarm_notify_id /tmp/alarm_notify_pid /tmp/alarm_notification_id
    exit 0
end

function run_alarm
    set -l duration_seconds $argv[1]
    set -l is_repeat $argv[2]

    set -l start_time (date +%s)
    set -l end_time (math $start_time + $duration_seconds)
    set -l formatted_duration (format_duration $duration_seconds)

    # Mark alarm as active
    echo "active" > /tmp/alarm_active

    # Setup signal handlers for clean shutdown
    trap stop_alarm INT TERM

    if test "$is_repeat" = true
        printf "%s%s[ALARM]%s Repeating alarm every %s%s%s started\n" "$fish_color_green" "$fish_color_bold" "$fish_color_reset" "$fish_color_cyan" $formatted_duration "$fish_color_reset"
    else
        printf "%s%s[ALARM]%s Timer for %s%s%s started\n" "$fish_color_green" "$fish_color_bold" "$fish_color_reset" "$fish_color_cyan" $formatted_duration "$fish_color_reset"
    end

    printf "%s%s[INFO]%s Run 'stop_alarm' to stop this alarm at any time\n" "$fish_color_blue" "$fish_color_bold" "$fish_color_reset"

    while true
        set -l current_time (date +%s)
        set -l remaining (math $end_time - $current_time)

        if test $remaining -le 0
            printf "\n%s%s🔔 ALARM! 🔔%s\n" "$fish_color_bright_red" "$fish_color_bold" "$fish_color_reset"
            printf "%s%s[ALARM]%s Timer finished! Duration: %s%s%s\n" "$fish_color_bright_red" "$fish_color_bold" "$fish_color_reset" "$fish_color_cyan" $formatted_duration "$fish_color_reset"

            # Play alarm sound
            play_alarm_sound

            # Send system-wide notification
            set -l notify_message "Timer finished! Duration: $formatted_duration\nClick to dismiss the alarm."
            if test "$is_repeat" = true
                set notify_message "Repeating alarm triggered! (Every $formatted_duration)\nClick to dismiss this cycle."
            end
            send_alarm_notification "$notify_message" "critical"

            if test "$is_repeat" = true
                printf "%s%s[INFO]%s Alarm sounding... Click notification to stop cycle\n" "$fish_color_blue" "$fish_color_bold" "$fish_color_reset"

                # Wait for user interaction or timeout
                set -l wait_count 0
                while test $wait_count -lt 90  # 90 seconds max per cycle
                    if not test -f /tmp/alarm_active
                        break
                    end
                    sleep 1
                    set wait_count (math $wait_count + 1)
                end

                # Stop current alarm sound
                stop_alarm_sound

                # Check if alarm should continue repeating
                if test -f /tmp/alarm_active
                    printf "%s%s[REPEAT]%s Starting next cycle in 2 seconds...\n" "$fish_color_yellow" "$fish_color_bold" "$fish_color_reset"
                    sleep 2
                    set end_time (math (date +%s) + $duration_seconds)
                    printf "%s%s[ALARM]%s Next alarm cycle started\n" "$fish_color_green" "$fish_color_bold" "$fish_color_reset"
                else
                    break
                end
            else
                # One-time alarm - wait for user interaction
                printf "%s%s[INFO]%s Alarm sounding... Click notification to stop\n" "$fish_color_blue" "$fish_color_bold" "$fish_color_reset"

                # Wait for user to dismiss notification or timeout
                set -l wait_count 0
                while test $wait_count -lt 90  # 90 seconds max
                    if not test -f /tmp/alarm_active
                        break
                    end
                    sleep 1
                    set wait_count (math $wait_count + 1)
                end

                stop_alarm_sound
                break
            end
        else
            set -l remaining_formatted (format_duration $remaining)
            printf "\r%s%s[TIMER]%s %s remaining" "$fish_color_blue" "$fish_color_bold" "$fish_color_reset" $remaining_formatted
        end

        sleep 1
    end

    printf "\n%s%s[DONE]%s Alarm completed\n" "$fish_color_green" "$fish_color_bold" "$fish_color_reset"
    stop_alarm_sound

    # Stop zenity dialog if running
    if test -f /tmp/alarm_zenity_pid
        set -l zenity_pid (cat /tmp/alarm_zenity_pid)
        if kill -0 $zenity_pid 2>/dev/null
            kill $zenity_pid 2>/dev/null
        end
        rm -f /tmp/alarm_zenity_pid
    end

    rm -f /tmp/alarm_active /tmp/alarm_notify_id /tmp/alarm_notify_pid /tmp/alarm_notification_id
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
            set mode once
            if test $i -lt $argc
                set time_arg $argv[(math $i + 1)]
            else
                printf "%s%s[ERROR]%s --in requires a time argument\n" "$fish_color_red" "$fish_color_bold" "$fish_color_reset"
                exit 1
            end

        case --repeat
            set mode repeat
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
