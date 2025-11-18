#!/usr/bin/env fish

# Interactive alarm script with flexible time parsing
# Usage: alarm [--in TIME] [--repeat TIME] [--aggressive] [--super-aggressive] [--help]
# Examples: alarm --in 10s, alarm --in 1h30m, alarm --repeat 5m, alarm --in 5m --aggressive, alarm --in 5m --super-aggressive

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
    printf "  %s--aggressive%s     Enable aggressive mode (max volume, screen effects)%s\n" "$fish_color_bright_red" "$fish_color_reset" "$fish_color_reset"
    printf "  %s--super-aggressive%s Enable super-aggressive mode (multiple windows, escalation)%s\n" "$fish_color_bright_magenta" "$fish_color_reset" "$fish_color_reset"
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
    printf "  %salarm --in 5m --aggressive%s      %sSet aggressive alarm for 5 minutes%s\n" "$fish_color_red" "$fish_color_reset" "$fish_color_dim" "$fish_color_reset"
    printf "  %salarm --in 3m --super-aggressive%s %sSet super-aggressive alarm for 3 minutes%s\n" "$fish_color_magenta" "$fish_color_reset" "$fish_color_dim" "$fish_color_reset"
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
    set -l aggressive_mode $argv[1]

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
        if command -v mpv >/dev/null
            if test "$aggressive_mode" = true
                mpv --no-terminal --volume=100 --loop=inf $sound_file >/dev/null 2>&1 &
            else
                mpv --no-terminal --volume=80 --loop=inf $sound_file >/dev/null 2>&1 &
            end
            echo $last_pid > /tmp/alarm_sound_pid
        else if command -v paplay >/dev/null
            if test "$aggressive_mode" = true
                paplay --loop --volume=65536 $sound_file >/dev/null 2>&1 &  # Max volume
            else
                paplay --loop $sound_file >/dev/null 2>&1 &
            end
            echo $last_pid > /tmp/alarm_sound_pid
        else if command -v aplay >/dev/null
            aplay $sound_file >/dev/null 2>&1 &
            echo $last_pid > /tmp/alarm_sound_pid
        else
            printf "%s%s[WARNING]%s No audio player found (mpv, paplay, aplay)\n" "$fish_color_yellow" "$fish_color_bold" "$fish_color_reset"
        end
    else
        printf "%s%s[WARNING]%s Alarm sound not found. Please download one to ~/Music/alarm.mp3\n" "$fish_color_yellow" "$fish_color_bold" "$fish_color_reset"
        # Fallback: use system bell (more aggressive in aggressive mode)
        if test "$aggressive_mode" = true
            for i in (seq 1 10)
                printf "\a"
                sleep 0.1
            end
        else
            printf "\a"
        end
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
    set -l aggressive_mode $argv[3]

    # Method 1: Try notify-send with proper environment
    if command -v notify-send >/dev/null
        # Export DBUS session variables to ensure notification works
        set -lx DBUS_SESSION_BUS_ADDRESS $DBUS_SESSION_BUS_ADDRESS
        set -lx DISPLAY $DISPLAY
        set -lx XDG_RUNTIME_DIR $XDG_RUNTIME_DIR

        # Send notification
        if test "$aggressive_mode" = true
            notify-send \
                --urgency=critical \
                --app-name="ALARM AGGRESSIVE" \
                --icon="dialog-error" \
                --expire-time=0 \
                "🚨 AGGRESSIVE ALARM! 🚨" \
                "$message

IMMEDIATE ACTION REQUIRED!
Run 'stop_alarm' to dismiss" &
        else
            notify-send \
                --urgency=$urgency \
                --app-name="Alarm" \
                --icon="alarm-clock" \
                --expire-time=0 \
                "🔔 ALARM! 🔔" \
                "$message

Run 'stop_alarm' to dismiss" &
        end
    end

    # Method 2: Use zenity for visual dialog (GNOME friendly)
    if command -v zenity >/dev/null
        if test "$aggressive_mode" = true
            zenity --error --text="🚨 AGGRESSIVE ALARM! 🚨\n\n$message\n\nIMMEDIATE ACTION REQUIRED!\nClick OK to dismiss this alarm" --title="AGGRESSIVE ALARM" --no-wrap --ok-label="DISMISS NOW" &
        else
            zenity --question --text="🔔 ALARM! 🔔\n\n$message\n\nClick OK to dismiss this alarm" --title="ALARM" --no-wrap --ok-label="Dismiss Alarm" &
        end
        echo $last_pid > /tmp/alarm_zenity_pid
    end

    # Method 3: Use our custom notification script as fallback
    if test "$aggressive_mode" = true
        fish send_notification.fish "🚨 AGGRESSIVE ALARM! 🚨" "$message\n\nIMMEDIATE ACTION REQUIRED!\nRun 'stop_alarm' to dismiss" "critical" &
    else
        fish send_notification.fish "🔔 ALARM! 🔔" "$message\n\nRun 'stop_alarm' to dismiss" $urgency &
    end

    # Method 4: Try to send a desktop notification via GNOME-specific method
    if command -v gdbus >/dev/null
        if test "$aggressive_mode" = true
            gdbus call --session --dest org.freedesktop.Notifications --object-path /org/freedesktop/Notifications --method org.freedesktop.Notifications.Notify "ALARM AGGRESSIVE" 0 "dialog-error" "🚨 AGGRESSIVE ALARM! 🚨" "$message

IMMEDIATE ACTION REQUIRED!
Run 'stop_alarm' to dismiss" [] {} 0 2>/dev/null &
        else
            gdbus call --session --dest org.freedesktop.Notifications --object-path /org/freedesktop/Notifications --method org.freedesktop.Notifications.Notify "Alarm" 0 "alarm-clock" "🔔 ALARM! 🔔" "$message

Run 'stop_alarm' to dismiss" [] {} 0 2>/dev/null &
        end
    end

    # Method 5: Terminal-based visual alert with blinking (enhanced for aggressive mode)
    if test "$aggressive_mode" = true
        fish -c "
            for i in (seq 1 30)  # More cycles in aggressive mode
                # Flash between different colors
                printf '\033]11;#ff0000\007'  # Red background
                printf '\r\033[1;41m\033[97m🚨 AGGRESSIVE ALARM! 🚨\033[0m\n'
                sleep 0.2
                printf '\033]11;#ffff00\007'  # Yellow background
                printf '\r\033[1;43m\033[30m🚨 AGGRESSIVE ALARM! 🚨\033[0m\n'
                sleep 0.2
                printf '\033]11;#ff00ff\007'  # Magenta background
                printf '\r\033[1;45m\033[97m🚨 AGGRESSIVE ALARM! 🚨\033[0m\n'
                sleep 0.2
                printf '\033]11;#000000\007'  # Reset background
                printf '\r\033[1;5m\033[91m                       \033[0m\n'  # Blinking red text
                sleep 0.2
            end
        " &
    else
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
end

function aggressive_screen_effects
    # Function to create aggressive visual screen effects
    
    # SYSTEM-WIDE OVERLAY: Create fullscreen overlay that appears on top of ALL windows
    set -l overlay_script "$HOME/.config/dotfiles/scripts/alarm-overlay.py"
    if test -f "$overlay_script"; and python3 -c "import gi; gi.require_version('Gtk', '3.0')" 2>/dev/null
        # Ensure DISPLAY is set
        if test -z "$DISPLAY"
            set -lx DISPLAY ":0"
        else
            set -lx DISPLAY "$DISPLAY"
        end
        python3 "$overlay_script" 5 >/dev/null 2>&1 &
        set -l overlay_pid $last_pid
        echo $overlay_pid > /tmp/alarm_overlay_pid
        printf "%s%s[OVERLAY]%s System-wide overlay activated (appears on top of all windows for 5 seconds)\n" "$fish_color_bright_yellow" "$fish_color_bold" "$fish_color_reset"
        
        # Use wmctrl and xdotool to force window on top (wait a bit for window to appear)
        sleep 0.5
        if command -v wmctrl >/dev/null
            for i in (seq 1 15)
                wmctrl -a "ALARM OVERLAY" 2>/dev/null
                wmctrl -l | grep -i "ALARM OVERLAY" | while read -l line
                    set -l window_id (echo $line | awk '{print $1}')
                    wmctrl -i -r $window_id -b add,above 2>/dev/null
                    wmctrl -i -r $window_id -b add,fullscreen 2>/dev/null
                end
                sleep 0.2
            end
        end
        if command -v xdotool >/dev/null
            for i in (seq 1 10)
                xdotool search --name "ALARM OVERLAY" windowactivate 2>/dev/null
                sleep 0.2
            end
        end
    end
    
    if command -v xdotool >/dev/null
        # Try to simulate screen shaking by moving mouse slightly
        for i in (seq 1 20)
            xdotool mousemove_relative -- -5 0
            sleep 0.05
            xdotool mousemove_relative -- 10 0
            sleep 0.05
            xdotool mousemove_relative -- -5 0
            sleep 0.05
        end
    end

    # Rapid window flashing if possible
    if command -v wmctrl >/dev/null
        set -l active_window (wmctrl -a :ACTIVE: -v 2>&1 | head -1 | string match -r '0x[0-9a-f]+')
        if test -n "$active_window"
            for i in (seq 1 10)
                wmctrl -i -r $active_window -b toggle,hidden
                sleep 0.1
                wmctrl -i -r $active_window -b toggle,hidden
                sleep 0.1
            end
        end
    end

    # Terminal-based aggressive effects
    fish -c "
        # Clear and fill screen with flashing colors
        for i in (seq 1 15)
            clear
            printf '\033[48;5;196m'  # Red background
            for j in (seq 1 50)
                echo '🚨 AGGRESSIVE ALARM! 🚨'
            end
            printf '\033[0m'
            sleep 0.15
            clear
            printf '\033[48;5;226m'  # Yellow background
            for j in (seq 1 50)
                echo '🚨 AGGRESSIVE ALARM! 🚨'
            end
            printf '\033[0m'
            sleep 0.15
        end
    " &
end

function super_aggressive_effects
    # Multiple overlapping zenity dialogs
    for i in (seq 1 5)
        if command -v zenity >/dev/null
            zenity --error --text="🚨 SUPER-AGGRESSIVE ALARM! 🚨\n\nWINDOW $i/5\nIMMEDIATE ACTION REQUIRED!\nClick OK to dismiss this window" --title="SUPER-AGGRESSIVE ALARM $i/5" --no-wrap --ok-label="DISMISS $i" &
            echo $last_pid > /tmp/alarm_zenity_pid_$i
        end
        sleep 0.1
    end

    # Multiple system notifications
    if command -v notify-send >/dev/null
        for i in (seq 1 10)
            notify-send \
                --urgency=critical \
                --app-name="SUPER-ALARM" \
                --icon="dialog-error" \
                --expire-time=0 \
                "🚨 SUPER-AGGRESSIVE ALARM! 🚨" \
                "Notification $i/10 - IMMEDIATE ACTION REQUIRED!" &
            sleep 0.2
        end
    end

    # Browser fullscreen alarm if browser is available
    if command -v firefox >/dev/null
        # Create a temporary HTML file for fullscreen alarm
        set -l temp_html "/tmp/alarm_super_aggressive_$random.html"
        echo '<!DOCTYPE html>
<html>
<head>
    <title>🚨 SUPER-AGGRESSIVE ALARM! 🚨</title>
    <style>
        body {
            background: red;
            color: yellow;
            font-size: 72px;
            font-weight: bold;
            text-align: center;
            margin: 0;
            padding: 50px;
            animation: flash 0.5s infinite;
        }
        @keyframes flash {
            0% { background: red; color: yellow; }
            50% { background: yellow; color: red; }
            100% { background: red; color: yellow; }
        }
        .message {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        }
    </style>
</head>
<body>
    <div class="message">
        🚨 SUPER-AGGRESSIVE ALARM! 🚨<br>
        IMMEDIATE ACTION REQUIRED!<br>
        <small>Close this tab to dismiss</small>
    </div>
    <script>
        // Try to go fullscreen
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        }
        // Prevent closing easily
        window.onbeforeunload = function() {
            return "Are you sure you want to dismiss the alarm?";
        };
    </script>
</body>
</html>' > $temp_html

        firefox --fullscreen $temp_html >/dev/null 2>&1 &
        echo $last_pid > /tmp/alarm_firefox_pid
    end

    # Terminal takeover with multiple effects
    fish -c "
        for i in (seq 1 50)
            # Clear screen and fill with different patterns
            clear
            printf '\033[48;5;196m'  # Red background
            for j in (seq 1 20)
                echo '🚨 SUPER-AGGRESSIVE ALARM! 🚨 IMMEDIATE ACTION REQUIRED! 🚨'
            end
            printf '\033[0m'
            sleep 0.1

            clear
            printf '\033[48;5;226m'  # Yellow background
            for j in (seq 1 20)
                echo '🚨 ALARM ACTIVE! 🚨 CANNOT BE IGNORED! 🚨 ALARM ACTIVE! 🚨'
            end
            printf '\033[0m'
            sleep 0.1

            clear
            printf '\033[48;5;196m\033[97m'  # Red background, white text
            for j in (seq 1 15)
                echo '🚨 🚨 🚨 URGENT! URGENT! URGENT! 🚨 🚨 🚨'
            end
            printf '\033[0m'
            sleep 0.1
        end
    " &

    # Escalating system bell pattern
    for i in (seq 1 20)
        printf "\a"
        sleep 0.05
        printf "\a\a"
        sleep 0.05
        printf "\a\a\a"
        sleep 0.1
    end &

    # Try to make windows always on top (if wmctrl is available)
    if command -v wmctrl >/dev/null
        sleep 1  # Let windows open first
        for pid in /tmp/alarm_zenity_pid_*
            if test -f $pid
                set -l zenity_pid (cat $pid)
                if kill -0 $zenity_pid 2>/dev/null
                    # Find window ID and make it always on top
                    set -l window_id (wmctrl -lp | grep $zenity_pid | awk '{print $1}')
                    if test -n "$window_id"
                        wmctrl -i -r $window_id -b add,above
                    end
                end
            end
        end
    end
end

function stop_alarm
    printf "\n%s%s[STOPPED]%s Alarm stopped by user\n" "$fish_color_yellow" "$fish_color_bold" "$fish_color_reset"
    stop_alarm_sound

    # Stop overlay window if running
    if test -f /tmp/alarm_overlay_pid
        set -l overlay_pid (cat /tmp/alarm_overlay_pid)
        if kill -0 $overlay_pid 2>/dev/null
            kill $overlay_pid 2>/dev/null
        end
        rm -f /tmp/alarm_overlay_pid
    end
    
    # Also try to kill any remaining overlay processes
    pkill -f "alarm-overlay.py" 2>/dev/null

    # Stop zenity dialog if running
    if test -f /tmp/alarm_zenity_pid
        set -l zenity_pid (cat /tmp/alarm_zenity_pid)
        if kill -0 $zenity_pid 2>/dev/null
            kill $zenity_pid 2>/dev/null
        end
        rm -f /tmp/alarm_zenity_pid
    end

    # Stop super-aggressive zenity dialogs
    for pid_file in /tmp/alarm_zenity_pid_*
        if test -f $pid_file
            set -l zenity_pid (cat $pid_file)
            if kill -0 $zenity_pid 2>/dev/null
                kill $zenity_pid 2>/dev/null
            end
            rm -f $pid_file
        end
    end

    # Stop firefox if it was opened by super-aggressive mode
    if test -f /tmp/alarm_firefox_pid
        set -l firefox_pid (cat /tmp/alarm_firefox_pid)
        if kill -0 $firefox_pid 2>/dev/null
            kill $firefox_pid 2>/dev/null
        end
        rm -f /tmp/alarm_firefox_pid
    end

    # Clean up temporary HTML files
    rm -f /tmp/alarm_super_aggressive_*.html

    rm -f /tmp/alarm_active /tmp/alarm_notify_id /tmp/alarm_notify_pid /tmp/alarm_notification_id
    exit 0
end

function run_alarm
    set -l duration_seconds $argv[1]
    set -l is_repeat $argv[2]
    set -l aggressive_mode $argv[3]
    set -l super_aggressive_mode $argv[4]

    set -l start_time (date +%s)
    set -l end_time (math $start_time + $duration_seconds)
    set -l formatted_duration (format_duration $duration_seconds)

    # Mark alarm as active
    echo "active" > /tmp/alarm_active

    # Setup signal handlers for clean shutdown
    trap stop_alarm INT TERM

    if test "$super_aggressive_mode" = true
        if test "$is_repeat" = true
            printf "%s%s[SUPER-AGGRESSIVE ALARM]%s Repeating super-aggressive alarm every %s%s%s started\n" "$fish_color_bright_magenta" "$fish_color_bold" "$fish_color_reset" "$fish_color_cyan" $formatted_duration "$fish_color_reset"
        else
            printf "%s%s[SUPER-AGGRESSIVE ALARM]%s Super-aggressive timer for %s%s%s started\n" "$fish_color_bright_magenta" "$fish_color_bold" "$fish_color_reset" "$fish_color_cyan" $formatted_duration "$fish_color_reset"
        end
    else if test "$aggressive_mode" = true
        if test "$is_repeat" = true
            printf "%s%s[AGGRESSIVE ALARM]%s Repeating aggressive alarm every %s%s%s started\n" "$fish_color_bright_red" "$fish_color_bold" "$fish_color_reset" "$fish_color_cyan" $formatted_duration "$fish_color_reset"
        else
            printf "%s%s[AGGRESSIVE ALARM]%s Aggressive timer for %s%s%s started\n" "$fish_color_bright_red" "$fish_color_bold" "$fish_color_reset" "$fish_color_cyan" $formatted_duration "$fish_color_reset"
        end
    else
        if test "$is_repeat" = true
            printf "%s%s[ALARM]%s Repeating alarm every %s%s%s started\n" "$fish_color_green" "$fish_color_bold" "$fish_color_reset" "$fish_color_cyan" $formatted_duration "$fish_color_reset"
        else
            printf "%s%s[ALARM]%s Timer for %s%s%s started\n" "$fish_color_green" "$fish_color_bold" "$fish_color_reset" "$fish_color_cyan" $formatted_duration "$fish_color_reset"
        end
    end

    printf "%s%s[INFO]%s Run 'stop_alarm' to stop this alarm at any time\n" "$fish_color_blue" "$fish_color_bold" "$fish_color_reset"

    while true
        set -l current_time (date +%s)
        set -l remaining (math $end_time - $current_time)

        if test $remaining -le 0
            if test "$super_aggressive_mode" = true
                printf "\n%s%s🚨🚨 SUPER-AGGRESSIVE ALARM! 🚨🚨%s\n" "$fish_color_bright_magenta" "$fish_color_bold" "$fish_color_reset"
                printf "%s%s[SUPER-AGGRESSIVE ALARM]%s Timer finished! Duration: %s%s%s\n" "$fish_color_bright_magenta" "$fish_color_bold" "$fish_color_reset" "$fish_color_cyan" $formatted_duration "$fish_color_reset"
            else if test "$aggressive_mode" = true
                printf "\n%s%s🚨 AGGRESSIVE ALARM! 🚨%s\n" "$fish_color_bright_red" "$fish_color_bold" "$fish_color_reset"
                printf "%s%s[AGGRESSIVE ALARM]%s Timer finished! Duration: %s%s%s\n" "$fish_color_bright_red" "$fish_color_bold" "$fish_color_reset" "$fish_color_cyan" $formatted_duration "$fish_color_reset"
            else
                printf "\n%s%s🔔 ALARM! 🔔%s\n" "$fish_color_bright_red" "$fish_color_bold" "$fish_color_reset"
                printf "%s%s[ALARM]%s Timer finished! Duration: %s%s%s\n" "$fish_color_bright_red" "$fish_color_bold" "$fish_color_reset" "$fish_color_cyan" $formatted_duration "$fish_color_reset"
            end

            # Play alarm sound
            play_alarm_sound $aggressive_mode

            # Trigger super-aggressive effects if enabled
            if test "$super_aggressive_mode" = true
                super_aggressive_effects
            else
                # Trigger aggressive screen effects if enabled
                if test "$aggressive_mode" = true
                    aggressive_screen_effects
                end
            end

            # Send system-wide notification
            set -l notify_message "Timer finished! Duration: $formatted_duration\nClick to dismiss the alarm."
            if test "$is_repeat" = true
                set notify_message "Repeating alarm triggered! (Every $formatted_duration)\nClick to dismiss this cycle."
            end
            if test "$super_aggressive_mode" = true
                set notify_message "🚨🚨 SUPER-AGGRESSIVE ALARM TRIGGERED! 🚨🚨\nDuration: $formatted_duration\nIMMEDIATE ACTION REQUIRED!\nMultiple windows activated!"
            else if test "$aggressive_mode" = true
                set notify_message "🚨 AGGRESSIVE ALARM TRIGGERED! 🚨\nDuration: $formatted_duration\nIMMEDIATE ACTION REQUIRED!"
            end
            send_alarm_notification "$notify_message" "critical" $aggressive_mode

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

    # Stop overlay window if running
    if test -f /tmp/alarm_overlay_pid
        set -l overlay_pid (cat /tmp/alarm_overlay_pid)
        if kill -0 $overlay_pid 2>/dev/null
            kill $overlay_pid 2>/dev/null
        end
        rm -f /tmp/alarm_overlay_pid
    end
    pkill -f "alarm-overlay.py" 2>/dev/null

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
                run_alarm $seconds false false false
            else
                printf "%s%s[ERROR]%s Invalid time format\n" "$fish_color_red" "$fish_color_bold" "$fish_color_reset"
            end

        case 2
            echo
            printf "%sEnter repeat interval (e.g., 10s, 5m, 1h): %s" "$fish_color_cyan" "$fish_color_reset"
            read -l interval

            set -l seconds (parse_time_to_seconds $interval)
            if test $seconds -gt 0
                run_alarm $seconds true false false
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
set -l aggressive_mode false
set -l super_aggressive_mode false

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

        case --aggressive
            set aggressive_mode true

        case --super-aggressive
            set aggressive_mode true
            set super_aggressive_mode true
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
        run_alarm $seconds false $aggressive_mode $super_aggressive_mode
    case repeat
        run_alarm $seconds true $aggressive_mode $super_aggressive_mode
end
