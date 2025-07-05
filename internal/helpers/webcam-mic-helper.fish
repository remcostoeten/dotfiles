#!/usr/bin/env fish

# Helper registration for webcam-mic script using the central factory
source (dirname (status --current-filename))/../helper-factory.fish

# Register helper for webcam-mic script
create_helper "webcam-mic" \
    "Webcam & Microphone Tester" \
    "Test webcam and microphone functionality with device detection and monitoring" \
    "usage|USAGE|webcam|mic|[options]|Test video and audio devices" \
    "examples|EXAMPLES|Test webcam:webcam|Test microphone:mic|List devices:webcam --list" \
    "features|FEATURES|Webcam testing and preview|Microphone level monitoring|Device detection and listing|Audio/video device management" \
    "commands|COMMANDS|webcam:Test and preview webcam|mic:Test microphone levels|webcam --list:List available video devices"
