#!/usr/bin/env fish

# Notification sender script that ensures proper environment
# Usage: send_notification.fish "title" "message" [urgency]

set -l title $argv[1]
set -l message $argv[2]
set -l urgency "normal"
if test (count $argv) -gt 2
    set urgency $argv[3]
end

# Ensure we have the necessary environment variables
if test -z "$DBUS_SESSION_BUS_ADDRESS"
    set -lx DBUS_SESSION_BUS_ADDRESS (cat /run/user/(id -u)/dbus-session 2>/dev/null; or echo "unix:path=/run/user/(id -u)/bus")
end

if test -z "$DISPLAY"
    set -lx DISPLAY ":0"
end

# Try to send notification with different methods
if command -v notify-send >/dev/null
    # Method 1: Direct notify-send
    notify-send --urgency=$urgency --app-name="Alarm" --icon="alarm-clock" --expire-time=0 "$title" "$message" &
    return 0
end

# Fallback: Try to write to system log
echo "ALARM NOTIFICATION: $title - $message" >&2
return 1