#!/usr/bin/env fish

# DOCSTRING: Android Emulator and App Launcher
# Comprehensive suite for managing Android emulator and launching apps

# DOCSTRING: Launch Android app by package name with toggle behavior - auto-starts emulator if needed
function launch_android_app
    set -l android_sdk "$HOME/Android/Sdk"
    set -l adb_path "$android_sdk/platform-tools/adb"
    set -l emulator_path "$android_sdk/emulator/emulator"
    
    if not test -f "$adb_path"
        set_color red
        echo "❌ ADB not found at: $adb_path"
        echo "💡 Please make sure Android SDK is installed correctly"
        set_color normal
        return 1
    end
    
    if test (count $argv) -ne 2
        set_color red
        echo "❌ Usage: launch_android_app <app_name> <package_name>"
        echo ""
        set_color yellow
        echo "Example: launch_android_app feeld co.feeld"
        set_color normal
        return 1
    end
    
    set -l app_name $argv[1]
    set -l package_name $argv[2]
    
    # Check if emulator is running
    set -l device_count (string trim ($adb_path devices | tail -n +2 | grep -v '^$' | wc -l))
    
    # If emulator is running, check if app is running and toggle
    if test "$device_count" -gt 0
        set -l app_running ($adb_path shell pidof $package_name 2>/dev/null)
        
        if test -n "$app_running"
            set_color yellow
            echo "🛑 $app_name is running, shutting down emulator..."
            set_color normal
            $adb_path emu kill >/dev/null 2>&1
            set_color green
            echo "✅ Emulator stopped"
            set_color normal
            return 0
        end
    end
    
    # Start emulator if not running
    if test "$device_count" -eq 0
        set_color yellow
        echo "🚀 Starting Android emulator (fast mode)..."
        set_color normal
        
        # Ultra-fast emulator startup with maximum optimizations
        nohup $emulator_path -avd Pixel_9_Pro \
            -no-snapshot-load \
            -no-boot-anim \
            -no-audio \
            -gpu host \
            -accel on \
            -memory 2048 \
            -cores 4 \
            >/dev/null 2>&1 &
        
        set_color cyan
        echo "⏳ Booting..."
        set_color normal
        
        # Wait for device to be online (with timeout)
        set -l timeout 90
        set -l elapsed 0
        while test $elapsed -lt $timeout
            set device_count (string trim ($adb_path devices | tail -n +2 | grep -v '^$' | wc -l))
            if test "$device_count" -gt 0
                # Device is listed, now wait for it to be fully booted
                set -l boot_complete ($adb_path shell getprop sys.boot_completed 2>/dev/null | string trim)
                if test "$boot_complete" = "1"
                    set_color green
                    echo "✅ Emulator ready!"
                    set_color normal
                    sleep 1
                    break
                end
            end
            sleep 1
            set elapsed (math $elapsed + 1)
            if test (math $elapsed % 5) -eq 0
                echo -n "."
            end
        end
        echo ""
        
        if test $elapsed -ge $timeout
            set_color red
            echo "❌ Emulator took too long to start"
            set_color normal
            return 1
        end
    end
    
    set_color yellow
    echo "📱 Launching $app_name..."
    set_color normal
    
    # Try to launch the app
    $adb_path shell monkey -p $package_name -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
    
    if test $status -eq 0
        set_color green
        echo "✅ $app_name launched successfully!"
        set_color normal
    else
        set_color red
        echo "❌ Failed to launch $app_name"
        echo "💡 Searching for correct package name..."
        set_color normal
        
        # Try to find the package by searching
        set -l found_packages ($adb_path shell pm list packages | grep -i (echo $app_name | string lower) | cut -d: -f2)
        
        if test -n "$found_packages"
            set_color cyan
            echo "📦 Found possible packages:"
            for pkg in $found_packages
                echo "   • $pkg"
            end
            set_color yellow
            echo ""
            echo "💡 Update the function with the correct package name"
            set_color normal
        else
            set_color yellow
            echo "💡 App might not be installed. Install it first."
            set_color normal
        end
        return 1
    end
end

# DOCSTRING: Launch Feeld app in Android emulator (auto-starts emulator, toggle to quit)
function feeld
    launch_android_app "Feeld" "co.feeld"
end

# DOCSTRING: Launch Govee app in Android emulator (auto-starts emulator, toggle to quit)
function govee
    launch_android_app "Govee" "com.govee.home"
end

# DOCSTRING: List all installed packages on Android emulator - search for app package names
function android_packages
    set -l android_sdk "$HOME/Android/Sdk"
    set -l adb_path "$android_sdk/platform-tools/adb"
    
    if not test -f "$adb_path"
        set_color red
        echo "❌ ADB not found"
        set_color normal
        return 1
    end
    
    set -l device_count (string trim ($adb_path devices | tail -n +2 | grep -v '^$' | wc -l))
    
    if test "$device_count" -eq 0
        set_color red
        echo "❌ No emulator running"
        echo "💡 Start an emulator first with: android"
        set_color normal
        return 1
    end
    
    set_color cyan
    echo "📦 Installed packages on emulator:"
    set_color normal
    echo ""
    
    if test (count $argv) -gt 0
        # Search for specific package
        set_color yellow
        echo "Searching for: $argv[1]"
        set_color normal
        $adb_path shell pm list packages | grep -i $argv[1] | cut -d: -f2 | sort
    else
        # List all packages
        $adb_path shell pm list packages -3 | cut -d: -f2 | sort
    end
end

# DOCSTRING: Start Android emulator without Android Studio - list AVDs, fast mode, headless
function android
    # Check for help flag
    if test "$argv[1]" = "--help" -o "$argv[1]" = "-h"
        _android_help
        return 0
    end
    
    # Set Android SDK path
    set -l android_sdk "$HOME/Android/Sdk"
    set -l emulator_path "$android_sdk/emulator/emulator"
    
    # Check if emulator exists
    if not test -f "$emulator_path"
        set_color red
        echo "❌ Android emulator not found at: $emulator_path"
        echo "💡 Please make sure Android SDK is installed correctly"
        set_color normal
        return 1
    end
    
    # Parse arguments
    set -l avd_name "Pixel_9_Pro"
    set -l show_list false
    set -l fast_mode false
    set -l no_window false
    
    for arg in $argv
        switch $arg
            case -l --list
                set show_list true
            case -f --fast
                set fast_mode true
            case -n --no-window
                set no_window true
            case '-*'
                set_color red
                echo "❌ Unknown option: $arg" >&2
                set_color yellow
                echo "💡 Use 'android --help' for usage information." >&2
                set_color normal
                return 1
        end
    end
    
    # Show list of available AVDs
    if test $show_list = true
        set_color cyan
        echo "📱 Available Android Virtual Devices:"
        set_color normal
        echo ""
        $emulator_path -list-avds
        echo ""
        return 0
    end
    
    # Build emulator command
    set -l emu_cmd "$emulator_path -avd $avd_name"
    
    if test $fast_mode = true
        set emu_cmd $emu_cmd " -no-snapshot -no-boot-anim -no-audio"
        set_color yellow
        echo "🚀 Starting emulator in fast mode..."
    else
        set_color yellow
        echo "🚀 Starting Android emulator..."
    end
    
    if test $no_window = true
        set emu_cmd $emu_cmd " -no-window"
        echo "🖥️  Starting in headless mode..."
    end
    
    echo "📱 Device: $avd_name"
    echo ""
    set_color normal
    
    # Launch emulator
    eval $emu_cmd
end

# DOCSTRING: Helper function to show Android emulator help menu
function _android_help
    set_color cyan
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                   🚀 ANDROID EMULATOR LAUNCHER                              ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    set_color normal
    echo ""
    set_color yellow
    echo "Usage: android [OPTIONS]"
    echo ""
    set_color green
    echo "Options:"
    printf "  %-20s %s\n" (set_color -o magenta)"-h, --help"(set_color green) (set_color normal)"Show this help message"
    printf "  %-20s %s\n" (set_color -o magenta)"-l, --list"(set_color green) (set_color normal)"List available AVDs"
    printf "  %-20s %s\n" (set_color -o magenta)"-f, --fast"(set_color green) (set_color normal)"Start with performance optimizations"
    printf "  %-20s %s\n" (set_color -o magenta)"-n, --no-window"(set_color green) (set_color normal)"Start without GUI window"
    echo ""
    set_color blue
    echo "Description:"
    echo "  🚀 Launch Android emulator directly without Android Studio"
    echo "  💾 Uses less system resources than full Android Studio"
    echo "  📱 Starts your Pixel 9 Pro emulator by default"
    echo ""
    set_color purple
    echo "Examples:"
    echo "  android          # Start Pixel 9 Pro emulator"
    echo "  android -l       # List all available devices"
    echo "  android -f       # Start with performance optimizations"
    echo "  android -n       # Start without GUI (headless mode)"
    echo ""
    set_color cyan
    echo "📱 Quick App Launch:"
    echo "  feeld            # Launch Feeld app (toggle to quit)"
    echo "  govee            # Launch Govee app (toggle to quit)"
    echo ""
    echo "  android_packages # List all installed packages"
    echo "  android_packages <name>  # Search for specific package"
    set_color normal
end

