#!/bin/bash

# =============================================================================
# Android Programs Launcher
# Functions to launch Android apps in emulator
# Source this file to use feeld() and govee() functions
# Usage: source ~/android-programs.sh
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Android SDK paths
export ANDROID_SDK_ROOT="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator"

# Check if Android SDK is installed
check_android_sdk() {
    if [ ! -d "$ANDROID_SDK_ROOT" ]; then
        print_error "Android SDK not found at $ANDROID_SDK_ROOT"
        print_error "Please run the setup script first: ./setup-android-emulator.sh"
        return 1
    fi

    if [ ! -f "$ANDROID_SDK_ROOT/platform-tools/adb" ]; then
        print_error "ADB not found. Please run the setup script first."
        return 1
    fi

    if [ ! -f "$ANDROID_SDK_ROOT/emulator/emulator" ]; then
        print_error "Emulator not found. Please run the setup script first."
        return 1
    fi

    return 0
}

# Check if emulator is running
is_emulator_running() {
    "$ANDROID_SDK_ROOT/platform-tools/adb" devices | grep -q "emulator-"
}

# Check if app is running
is_app_running() {
    local package_name="$1"
    "$ANDROID_SDK_ROOT/platform-tools/adb" shell pidof "$package_name" >/dev/null 2>&1
}

# Check if app is installed
is_app_installed() {
    local package_name="$1"
    "$ANDROID_SDK_ROOT/platform-tools/adb" shell pm list packages | grep -q "package:$package_name"
}

# Start emulator
start_emulator() {
    print_status "Starting Android emulator..."

    # Fast startup options
    "$ANDROID_SDK_ROOT/emulator/emulator" \
        -avd Pixel_9_Pro \
        -no-snapshot-load \
        -no-boot-anim \
        -no-audio \
        -gpu host \
        -accel on \
        -memory 2048 \
        -cores 4 &

    local EMULATOR_PID=$!

    # Wait for boot
    local timeout=90
    local count=0

    while [ $count -lt $timeout ]; do
        if is_emulator_running && "$ANDROID_SDK_ROOT/platform-tools/adb" shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; then
            print_success "Emulator is ready"
            return 0
        fi
        sleep 1
        count=$((count + 1))
        if [ $((count % 10)) -eq 0 ]; then
            print_status "Still booting... (${count}s/${timeout}s)"
        fi
    done

    print_error "Emulator failed to boot"
    kill $EMULATOR_PID 2>/dev/null || true
    return 1
}

# Launch Android app
launch_android_app() {
    local app_name="$1"
    local package_name="$2"

    # Check if Android SDK is available
    if ! check_android_sdk; then
        return 1
    fi

    print_status "Launching $app_name..."

    # Check if app is installed
    if ! is_app_installed "$package_name"; then
        print_error "$app_name is not installed in the emulator"
        print_status "Please install $app_name from Google Play Store in the emulator"
        return 1
    fi

    # Check if emulator is running
    if ! is_emulator_running; then
        print_status "Emulator not running, starting it..."
        start_emulator || return 1
        sleep 5  # Give it extra time to settle
    fi

    # Check if app is already running (toggle behavior)
    if is_app_running "$package_name"; then
        print_status "$app_name is already running, stopping emulator..."
        "$ANDROID_SDK_ROOT/platform-tools/adb" emu kill
        return 0
    fi

    # Launch app
    if "$ANDROID_SDK_ROOT/platform-tools/adb" shell monkey -p "$package_name" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; then
        print_success "$app_name launched successfully!"
        print_status "Emulator is running in the background"
    else
        print_error "Failed to launch $app_name"
        print_status "Make sure the app is properly installed in the emulator"
        return 1
    fi
}

# Feeld app launcher
feeld() {
    launch_android_app "Feeld" "co.feeld"
}

# Govee app launcher
govee() {
    launch_android_app "Govee Home" "com.govee.home"
}

# Status checker
android_status() {
    if ! check_android_sdk; then
        return 1
    fi

    print_status "Android Emulator Status:"
    if is_emulator_running; then
        echo "  ✅ Emulator is running"
        echo "  📱 Device: $($ANDROID_SDK_ROOT/platform-tools/adb shell getprop ro.product.model 2>/dev/null || echo 'Unknown')"
        echo " 🤖 Android: $($ANDROID_SDK_ROOT/platform-tools/adb shell getprop ro.build.version.release 2>/dev/null || echo 'Unknown')"
    else
        echo "  ❌ Emulator is not running"
    fi

    echo ""
    print_status "App Status:"

    # Check Feeld
    if is_app_installed "co.feeld"; then
        if is_app_running "co.feeld"; then
            echo "  ✅ Feeld is running"
        else
            echo "  ⏸️  Feeld is installed but not running"
        fi
    else
        echo "  ❌ Feeld is not installed"
    fi

    # Check Govee
    if is_app_installed "com.govee.home"; then
        if is_app_running "com.govee.home"; then
            echo "  ✅ Govee Home is running"
        else
            echo "  ⏸️  Govee Home is installed but not running"
        fi
    else
        echo "  ❌ Govee Home is not installed"
    fi
}

# List installed packages
android_packages() {
    local filter="$1"

    if ! check_android_sdk; then
        return 1
    fi

    if ! is_emulator_running; then
        print_error "Emulator is not running"
        print_status "Start the emulator first with: feeld or govee"
        return 1
    fi

    if [ -n "$filter" ]; then
        print_status "Installed packages matching '$filter':"
        "$ANDROID_SDK_ROOT/platform-tools/adb" shell pm list packages | grep -i "$filter" || print_warning "No packages found matching '$filter'"
    else
        print_status "All installed packages (showing first 20):"
        "$ANDROID_SDK_ROOT/platform-tools/adb" shell pm list packages | head -20
        print_status "Total packages: $($ANDROID_SDK_ROOT/platform-tools/adb shell pm list packages | wc -l)"
        print_status "Use 'android_packages <filter>' to search for specific apps"
    fi
}

# Start emulator manually
android_start() {
    if ! check_android_sdk; then
        return 1
    fi

    if is_emulator_running; then
        print_warning "Emulator is already running"
        return 0
    fi

    start_emulator
}

# Stop emulator
android_stop() {
    if ! check_android_sdk; then
        return 1
    fi

    if ! is_emulator_running; then
        print_warning "Emulator is not running"
        return 0
    fi

    print_status "Stopping emulator..."
    "$ANDROID_SDK_ROOT/platform-tools/adb" emu kill
    print_success "Emulator stopped"
}

# Restart emulator
android_restart() {
    android_stop
    sleep 2
    android_start
}

# Open emulator with GUI
android_gui() {
    if ! check_android_sdk; then
        return 1
    fi

    if is_emulator_running; then
        print_warning "Emulator is already running"
        print_status "Use 'android_stop' first to stop it, then start with GUI"
        return 0
    fi

    print_status "Starting emulator with GUI..."
    "$ANDROID_SDK_ROOT/emulator/emulator" -avd Pixel_9_Pro
}

# Help function
android_help() {
    echo "Android Programs Launcher - Available Commands:"
    echo ""
    echo "App Launchers:"
    echo "  feeld          - Launch Feeld app (toggles if already running)"
    echo "  govee          - Launch Govee Home app (toggles if already running)"
    echo ""
    echo "Emulator Control:"
    echo "  android_start  - Start emulator in background"
    echo "  android_stop   - Stop emulator"
    echo "  android_restart- Restart emulator"
    echo "  android_gui    - Start emulator with GUI window"
    echo ""
    echo "Information:"
    echo "  android_status - Check emulator and app status"
    echo "  android_packages [filter] - List installed packages"
    echo "  android_help   - Show this help"
    echo ""
    echo "Usage: source ~/android-programs.sh"
    echo ""
    echo "First time setup:"
    echo "1. Run: ./setup-android-emulator.sh"
    echo "2. Restart terminal or: source ~/.bashrc"
    echo "3. Use: feeld or govee"
}

# Auto-initialization check
auto_init_check() {
    if check_android_sdk; then
        print_success "Android Programs Launcher loaded successfully!"
        print_status "Ready to use: feeld, govee, android_status, android_help"

        # Quick status check
        if is_emulator_running; then
            echo "  📱 Emulator is running"
        else
            echo "  ⚠️  Emulator is stopped (will auto-start when needed)"
        fi
    else
        print_warning "Android Programs Launcher loaded but SDK not found"
        print_status "Please run: ./setup-android-emulator.sh"
    fi
}

# Initialize when sourced
if [ "${BASH_SOURCE[0]}" != "${0}" ]; then
    # Script is being sourced
    auto_init_check
else
    # Script is being executed directly
    echo "This script should be sourced, not executed:"
    echo "  source ~/android-programs.sh"
    echo ""
    android_help
fi