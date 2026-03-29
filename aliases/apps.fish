#!/usr/bin/env fish

# DOCSTRING: Desktop Application Launchers
# Quick launchers for commonly used desktop applications

# DOCSTRING: Launch WhatsApp desktop app - runs in background without occupying terminal
function whatsapp
    # Try different possible names for WhatsApp
    if command -v whatsapp-web-desktop >/dev/null 2>&1
        nohup whatsapp-web-desktop >/dev/null 2>&1 &
    else if command -v whatsapp-desktop >/dev/null 2>&1
        nohup whatsapp-desktop >/dev/null 2>&1 &
    else if command -v whatsapp >/dev/null 2>&1
        nohup whatsapp >/dev/null 2>&1 &
    else
        set_color red
        echo "❌ WhatsApp not found"
        echo "💡 Install it with: snap install whatsapp-desktop"
        set_color normal
        return 1
    end
end

# DOCSTRING: Launch Spotify desktop app - runs in background without occupying terminal
function spotify
    if command -v spotify >/dev/null 2>&1
        nohup spotify >/dev/null 2>&1 &
    else
        set_color red
        echo "❌ Spotify not found"
        echo "💡 Install it with: snap install spotify"
        set_color normal
        return 1
    end
end

# DOCSTRING: Launch Discord desktop app - runs in background without occupying terminal
function discord
    if command -v discord >/dev/null 2>&1
        nohup discord >/dev/null 2>&1 &
    else
        set_color red
        echo "❌ Discord not found"
        echo "💡 Install it with: snap install discord"
        set_color normal
        return 1
    end
end

# DOCSTRING: Launch VS Code editor - runs in background, accepts file paths as arguments
function code
    if command -v code >/dev/null 2>&1
        nohup code $argv >/dev/null 2>&1 &
    else if command -v codium >/dev/null 2>&1
        nohup codium $argv >/dev/null 2>&1 &
    else
        set_color red
        echo "❌ VS Code not found"
        echo "💡 Install it from https://code.visualstudio.com/"
        set_color normal
        return 1
    end
end

# DOCSTRING: Launch Firefox browser - runs in background, accepts URLs as arguments
function firefox
    if command -v firefox >/dev/null 2>&1
        nohup firefox $argv >/dev/null 2>&1 &
    else
        set_color red
        echo "❌ Firefox not found"
        set_color normal
        return 1
    end
end

# DOCSTRING: Launch Chrome/Chromium browser - runs in background, accepts URLs as arguments
function chrome
    if command -v google-chrome >/dev/null 2>&1
        nohup google-chrome $argv >/dev/null 2>&1 &
    else if command -v chromium >/dev/null 2>&1
        nohup chromium $argv >/dev/null 2>&1 &
    else if command -v chromium-browser >/dev/null 2>&1
        nohup chromium-browser $argv >/dev/null 2>&1 &
    else
        set_color red
        echo "❌ Chrome/Chromium not found"
        set_color normal
        return 1
    end
end

# DOCSTRING: Launch Slack desktop app - runs in background without occupying terminal
function slack
    if command -v slack >/dev/null 2>&1
        nohup slack >/dev/null 2>&1 &
    else
        set_color red
        echo "❌ Slack not found"
        echo "💡 Install it with: snap install slack"
        set_color normal
        return 1
    end
end

# DOCSTRING: Launch Zoom video conferencing app - runs in background without occupying terminal
function zoom
    if command -v zoom >/dev/null 2>&1
        nohup zoom >/dev/null 2>&1 &
    else
        set_color red
        echo "❌ Zoom not found"
        echo "💡 Install it with: snap install zoom-client"
        set_color normal
        return 1
    end
end

# DOCSTRING: Launch Telegram desktop app - runs in background without occupying terminal
function telegram
    if command -v telegram-desktop >/dev/null 2>&1
        nohup telegram-desktop >/dev/null 2>&1 &
    else if command -v telegram >/dev/null 2>&1
        nohup telegram >/dev/null 2>&1 &
    else
        set_color red
        echo "❌ Telegram not found"
        echo "💡 Install it with: snap install telegram-desktop"
        set_color normal
        return 1
    end
end

# DOCSTRING: Launch Obsidian note-taking app - runs in background without occupying terminal
function obsidian
    if command -v obsidian >/dev/null 2>&1
        nohup obsidian >/dev/null 2>&1 &
    else
        set_color red
        echo "❌ Obsidian not found"
        echo "💡 Install it from https://obsidian.md/"
        set_color normal
        return 1
    end
end

# DOCSTRING: Launch Thunderbird email client - runs in background without occupying terminal
function thunderbird
    if command -v thunderbird >/dev/null 2>&1
        nohup thunderbird >/dev/null 2>&1 &
    else
        set_color red
        echo "❌ Thunderbird not found"
        set_color normal
        return 1
    end
end

# DOCSTRING: Launch LibreOffice Writer word processor - runs in background, accepts files
function writer
    if command -v libreoffice >/dev/null 2>&1
        nohup libreoffice --writer $argv >/dev/null 2>&1 &
    else
        set_color red
        echo "❌ LibreOffice not found"
        set_color normal
        return 1
    end
end

# DOCSTRING: Launch LibreOffice Calc spreadsheet - runs in background, accepts files
function calc
    if command -v libreoffice >/dev/null 2>&1
        nohup libreoffice --calc $argv >/dev/null 2>&1 &
    else
        set_color red
        echo "❌ LibreOffice not found"
        set_color normal
        return 1
    end
end

# DOCSTRING: Launch LibreOffice Impress presentation app - runs in background, accepts files
function impress
    if command -v libreoffice >/dev/null 2>&1
        nohup libreoffice --impress $argv >/dev/null 2>&1 &
    else
        set_color red
        echo "❌ LibreOffice not found"
        set_color normal
        return 1
    end
end

