#!/usr/bin/env fish

# Notification handler for alarm system
# This script monitors notification actions and handles alarm dismissal

function handle_notification_action
    set -l action $argv[1]

    switch $action
        case dismiss
            # Remove the alarm active flag to stop the alarm
            rm -f /tmp/alarm_active
            if test -f /tmp/alarm_sound_pid
                set -l pid (cat /tmp/alarm_sound_pid)
                if kill -0 $pid 2>/dev/null
                    kill $pid 2>/dev/null
                end
                rm -f /tmp/alarm_sound_pid
            end
            # Send confirmation notification
            if command -v notify-send >/dev/null
                notify-send --urgency=low --app-name="Alarm" --icon="dialog-information" "Alarm Dismissed" "The alarm has been stopped."
            end

        case stop
            # Just stop the sound but keep alarm active (for repeating alarms)
            if test -f /tmp/alarm_sound_pid
                set -l pid (cat /tmp/alarm_sound_pid)
                if kill -0 $pid 2>/dev/null
                    kill $pid 2>/dev/null
                end
                rm -f /tmp/alarm_sound_pid
            end
            # Send confirmation notification
            if command -v notify-send >/dev/null
                notify-send --urgency=low --app-name="Alarm" --icon="dialog-information" "Sound Stopped" "Alarm sound has been stopped. Timer continues."
            end
    end
end

# If called with arguments, handle the action
if test (count $argv) -gt 0
    handle_notification_action $argv[1]
end