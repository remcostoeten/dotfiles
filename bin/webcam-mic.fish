#!/usr/bin/env fish

# ==============================================================================
# SECTION 4: DEVICE TESTING UTILITIES
# Dependencies: ffmpeg, v4l2-utils (Linux), pulseaudio-utils
# ==============================================================================

function webcam
    set -l arg (string lower $argv[1])
    if contains -- $arg help -h --h -help --help
        echo (set_color cyan)"\n📹 Webcam Test Command\n────────────────────────────"(set_color normal)
        echo (set_color green)"webcam" (set_color normal)"- Show webcam info and open webcam preview"
        echo (set_color cyan)"\nUsage:\n  "(set_color yellow)"webcam "(set_color normal)"# Open default webcam preview"
        echo (set_color cyan)"\nRequirements:\n  - ffmpeg, v4l2-utils (Linux), and a webcam device"(set_color normal)
        return 0
    end

    # Cross-platform webcam detection
    switch (uname)
        case Darwin
            # macOS - check for AVFoundation devices
            if type -q ffmpeg
                echo (set_color green)"Detecting macOS webcam devices..."(set_color normal)
                ffmpeg -f avfoundation -list_devices true -i "" 2>&1 | grep -E "AVFoundation video devices|^\[" | head -10
                echo (set_color cyan)"Opening default webcam preview. Press q to quit."(set_color normal)
                ffplay -f avfoundation -i 0 -vf "drawtext=text='%{localtime}':x=10:y=10:fontcolor=yellow" -loglevel quiet 2>/dev/null
            else
                echo (set_color red)"ffmpeg not found. Install with: brew install ffmpeg"(set_color normal)
                return 1
            end
        case Linux
            # Linux - check for v4l2 devices
            if test -d /dev && test -c /dev/video0
                set -l device /dev/video0
                echo (set_color green)"Using webcam device:" (set_color normal)$device

                if type -q v4l2-ctl
                    echo (set_color cyan)"Device info:"(set_color normal)
                    v4l2-ctl -d $device --all 2>/dev/null | grep -E 'Driver|Card|Bus|Format'
                end

                if type -q ffplay
                    echo (set_color cyan)"Opening webcam preview. Press q to quit."(set_color normal)
                    ffplay -f v4l2 -i $device -vf "drawtext=text='%{localtime}':x=10:y=10:fontcolor=yellow" -loglevel quiet 2>/dev/null
                else
                    echo (set_color red)"ffplay not found. Install ffmpeg package."(set_color normal)
                    return 1
                end
            else
                echo (set_color red)"No webcam device found at /dev/video0"(set_color normal)
                echo (set_color yellow)"Available video devices:"(set_color normal)
                ls /dev/video* 2>/dev/null || echo "None found"
                return 1
            end
        case '*'
            echo (set_color red)"Unsupported operating system: "(uname)(set_color normal)
            return 1
    end
end

function mic
    set -l arg (string lower $argv[1])
    if contains -- $arg help -h --h -help --help
        echo (set_color cyan)"\n🎤 Microphone Test Command\n──────────────────────────────"(set_color normal)
        echo (set_color green)"mic" (set_color normal)"- Show mic info and test audio input level meter"
        echo (set_color cyan)"\nUsage:\n  "(set_color yellow)"mic "(set_color normal)"# Start mic test"
        echo (set_color cyan)"\nRequirements:\n  - ffmpeg, pulseaudio-utils (Linux) or system audio (macOS)"(set_color normal)
        return 0
    end

    # Cross-platform microphone testing
    switch (uname)
        case Darwin
            # macOS - use coreaudio
            if type -q ffmpeg
                echo (set_color cyan)"Detecting macOS audio input devices..."(set_color normal)
                ffmpeg -f avfoundation -list_devices true -i "" 2>&1 | grep -E "AVFoundation audio devices|^\[" | head -10
                echo (set_color cyan)"Starting mic level meter. Press Ctrl+C to stop."(set_color normal)
                ffmpeg -f avfoundation -i ":0" -filter_complex "astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.Peak_level:file=-" -f null - 2>&1 | grep --line-buffered lavfi.astats.Overall.Peak_level | while read -l line
                    set -l peak (echo $line | sed -n 's/.*=//p')
                    set -l peak_db (math "$peak * -1")
                    if test (math "$peak_db > 30")
                        echo (set_color green)"Mic level: $peak_db dB"(set_color normal)
                    else if test (math "$peak_db > 15")
                        echo (set_color yellow)"Mic level: $peak_db dB"(set_color normal)
                    else
                        echo (set_color red)"Mic level: $peak_db dB"(set_color normal)
                    end
                end
            else
                echo (set_color red)"ffmpeg not found. Install with: brew install ffmpeg"(set_color normal)
                return 1
            end
        case Linux
            # Linux - use pulseaudio
            set -l default_source default
            if type -q pactl
                set default_source (pactl info 2>/dev/null | grep 'Default Source:' | cut -d ' ' -f3)
            end

            if test -z "$default_source"
                echo (set_color red)"No default microphone source found."(set_color normal)
                return 1
            end

            if type -q ffmpeg
                echo (set_color cyan)"Starting mic level meter for device: $default_source. Press Ctrl+C to stop."(set_color normal)
                ffmpeg -f pulse -i $default_source -filter_complex "astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.Peak_level:file=-" -f null - 2>&1 | grep --line-buffered lavfi.astats.Overall.Peak_level | while read -l line
                    set -l peak (echo $line | sed -n 's/.*=//p')
                    set -l peak_db (math "$peak * -1")
                    if test (math "$peak_db > 30")
                        echo (set_color green)"Mic level: $peak_db dB"(set_color normal)
                    else if test (math "$peak_db > 15")
                        echo (set_color yellow)"Mic level: $peak_db dB"(set_color normal)
                    else
                        echo (set_color red)"Mic level: $peak_db dB"(set_color normal)
                    end
                end
            else
                echo (set_color red)"ffmpeg not found. Please install ffmpeg to use this."(set_color normal)
                return 1
            end
        case '*'
            echo (set_color red)"Unsupported operating system: "(uname)(set_color normal)
            return 1
    end
end
