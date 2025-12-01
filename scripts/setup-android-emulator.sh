#!/bin/bash

# =============================================================================
# Android Emulator Setup Script for Ubuntu
# Installs Android SDK, creates emulator, installs Feeld and Govee apps
# Creates android-programs.sh with feeld/govee functions
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
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

# Check if running as root for package installation
check_sudo() {
    if ! sudo -n true 2>/dev/null; then
        print_status "This script requires sudo privileges for package installation"
        sudo -v || {
            print_error "Please run with sudo privileges"
            exit 1
        }
    fi
}

# Check if running on Ubuntu
check_ubuntu() {
    if [ ! -f /etc/os-release ]; then
        print_error "Cannot detect Ubuntu version"
        exit 1
    fi

    . /etc/os-release
    if [ "$ID" != "ubuntu" ]; then
        print_error "This script is designed for Ubuntu only. Detected: $ID"
        exit 1
    fi

    print_status "Detected Ubuntu $VERSION_ID"
}

# Update system packages
update_system() {
    print_status "Updating system packages..."
    sudo apt update
    sudo apt upgrade -y
    print_success "System packages updated"
}

# Install required packages
install_dependencies() {
    print_status "Installing required dependencies..."
    sudo apt install -y \
        wget \
        unzip \
        curl \
        openjdk-11-jdk \
        python3 \
        python3-pip \
        git \
        build-essential \
        libc6:i386 \
        libncurses5:i386 \
        libstdc++6:i386 \
        lib32z1 \
        libbz2-1.0:i386
    print_success "Dependencies installed"
}

# Install Android SDK
install_android_sdk() {
    print_status "Installing Android SDK..."

    # Create Android directory
    mkdir -p "$HOME/Android/Sdk"

    # Download Android command line tools
    local CMDTOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip"
    local CMDTOOLS_ZIP="/tmp/cmdtools.zip"

    print_status "Downloading Android command line tools..."
    wget -O "$CMDTOOLS_ZIP" "$CMDTOOLS_URL"

    # Extract command line tools
    print_status "Extracting Android command line tools..."
    cd /tmp
    unzip -q "$CMDTOOLS_ZIP"
    mkdir -p "$HOME/Android/Sdk/cmdline-tools/latest"
    mv cmdline-tools/* "$HOME/Android/Sdk/cmdline-tools/latest/" 2>/dev/null || true

    # Set up environment variables
    export ANDROID_SDK_ROOT="$HOME/Android/Sdk"
    export PATH="$PATH:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator"

    # Add to shell profile
    {
        echo ""
        echo "# Android SDK Environment Variables"
        echo "export ANDROID_SDK_ROOT=\"\$HOME/Android/Sdk\""
        echo "export PATH=\"\$PATH:\$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:\$ANDROID_SDK_ROOT/platform-tools:\$ANDROID_SDK_ROOT/emulator\""
    } >> "$HOME/.bashrc"

    # Also add to .profile for non-interactive shells
    {
        echo ""
        echo "# Android SDK Environment Variables"
        echo "export ANDROID_SDK_ROOT=\"\$HOME/Android/Sdk\""
        echo "export PATH=\"\$PATH:\$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:\$ANDROID_SDK_ROOT/platform-tools:\$ANDROID_SDK_ROOT/emulator\""
    } >> "$HOME/.profile"

    rm -f "$CMDTOOLS_ZIP"
    print_success "Android SDK installed"
}

# Accept Android SDK licenses
accept_licenses() {
    print_status "Accepting Android SDK licenses..."
    yes | "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" --licenses
    print_success "Licenses accepted"
}

# Install Android SDK components
install_sdk_components() {
    print_status "Installing Android SDK components..."

    "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" \
        "platform-tools" \
        "platforms;android-34" \
        "system-images;android-34;google_apis;x86_64" \
        "emulator"

    print_success "Android SDK components installed"
}

# Create Android Virtual Device
create_avd() {
    print_status "Creating Android Virtual Device (Pixel_9_Pro)..."

    # Create AVD
    echo "no" | "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/avdmanager" create avd \
        -n "Pixel_9_Pro" \
        -k "system-images;android-34;google_apis;x86_64" \
        --force

    # Configure AVD for better performance
    cat > "$HOME/.android/avd/Pixel_9_Pro.avd/config.ini" << EOF
hw.device.name=Pixel 9 Pro
hw.cpu.arch=x86_64
hw.cpu.ncore=4
hw.ramSize=2048
hw.gpu.enabled=yes
hw.gpu.mode=host
hw.initialOrientation=Portrait
skin.name=1080x2340
hw.keyboard=yes
hw.lcd.density=560
hw.sensor.hinge=no
hw.sensor.proximity=no
hw.sensor.light=no
hw.sensor.pressure=no
hw.sensor.humidity=no
hw.sensor.magnetic=no
hw.sensor.gyroscope=no
hw.sensor.accelerometer=yes
hw.camera.back=none
hw.camera.front=none
disk.cachePartition=yes
disk.cachePartition.size=42m
sdcard.size=512M
showDeviceFrame=no
avd.ini.displayname=Pixel 9 Pro
EOF

    print_success "Android Virtual Device created"
}

# Start emulator for initial setup
start_emulator_initial() {
    print_status "Starting emulator for initial setup..."

    # Start emulator in background
    "$ANDROID_SDK_ROOT/emulator/emulator" -avd Pixel_9_Pro -no-snapshot -no-window -no-audio &
    EMULATOR_PID=$!

    # Wait for emulator to boot (max 3 minutes)
    print_status "Waiting for emulator to boot (this may take a few minutes)..."
    local timeout=180
    local count=0

    while [ $count -lt $timeout ]; do
        if "$ANDROID_SDK_ROOT/platform-tools/adb" shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; then
            print_success "Emulator booted successfully"
            break
        fi
        sleep 1
        count=$((count + 1))
        if [ $((count % 10)) -eq 0 ]; then
            print_status "Still waiting for emulator to boot... (${count}s/${timeout}s)"
        fi
    done

    if [ $count -eq $timeout ]; then
        print_error "Emulator failed to boot within timeout"
        kill $EMULATOR_PID 2>/dev/null || true
        exit 1
    fi

    # Stop emulator
    print_status "Stopping emulator..."
    "$ANDROID_SDK_ROOT/platform-tools/adb" emu kill
    wait $EMULATOR_PID 2>/dev/null || true

    print_success "Initial emulator setup completed"
}

# Install Android apps from Play Store (requires manual intervention)
install_android_apps() {
    print_warning "Android apps installation requires manual intervention"
    print_status "Please follow these steps to install the required apps:"
    echo ""
    echo "1. The emulator will start automatically"
    echo "2. Open Google Play Store in the emulator"
    echo "3. Sign in with your Google account"
    echo "4. Search and install 'Feeld' (co.feeld)"
    echo "5. Search and install 'Govee Home' (com.govee.home)"
    echo "6. Close the emulator when done"
    echo ""
    print_status "Press Enter to start the emulator for app installation..."
    read -r

    # Start emulator with GUI
    "$ANDROID_SDK_ROOT/emulator/emulator" -avd Pixel_9_Pro -no-snapshot &
    EMULATOR_PID=$!

    print_status "Waiting for you to install the apps..."
    print_status "Press Enter when you have finished installing both apps and closed the emulator..."
    read -r

    # Clean up
    kill $EMULATOR_PID 2>/dev/null || true
    "$ANDROID_SDK_ROOT/platform-tools/adb" emu kill 2>/dev/null || true

    print_success "Android apps installation completed"
}

# Create android-programs.sh
create_android_programs_script() {
    print_status "Creating android-programs.sh script..."

    cat > "$HOME/android-programs.sh" << 'EOF'
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

# Check if emulator is running
is_emulator_running() {
    "$ANDROID_SDK_ROOT/platform-tools/adb" devices | grep -q "emulator-"
}

# Check if app is running
is_app_running() {
    local package_name="$1"
    "$ANDROID_SDK_ROOT/platform-tools/adb" shell pidof "$package_name" >/dev/null 2>&1
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

    print_status "Launching $app_name..."

    # Check if emulator is running
    if ! is_emulator_running; then
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
    else
        print_error "Failed to launch $app_name"
        print_status "Make sure the app is installed in the emulator"
        print_status "You can check installed apps with: adb shell pm list packages"
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
    print_status "Android Emulator Status:"
    if is_emulator_running; then
        echo "  ✅ Emulator is running"
    else
        echo "  ❌ Emulator is not running"
    fi

    echo ""
    print_status "App Status:"
    if is_app_running "co.feeld"; then
        echo "  ✅ Feeld is running"
    else
        echo "  ❌ Feeld is not running"
    fi

    if is_app_running "com.govee.home"; then
        echo "  ✅ Govee Home is running"
    else
        echo "  ❌ Govee Home is not running"
    fi
}

# List installed packages
android_packages() {
    local filter="$1"
    if [ -n "$filter" ]; then
        print_status "Installed packages matching '$filter':"
        "$ANDROID_SDK_ROOT/platform-tools/adb" shell pm list packages | grep -i "$filter" || print_warning "No packages found matching '$filter'"
    else
        print_status "All installed packages:"
        "$ANDROID_SDK_ROOT/platform-tools/adb" shell pm list packages
    fi
}

# Help function
android_help() {
    echo "Android Programs Launcher - Available Commands:"
    echo ""
    echo "  feeld          - Launch Feeld app"
    echo "  govee          - Launch Govee Home app"
    echo "  android_status - Check emulator and app status"
    echo "  android_packages [filter] - List installed packages"
    echo "  android_help   - Show this help"
    echo ""
    echo "Usage: source ~/android-programs.sh"
}

# Initialize
print_success "Android Programs Launcher loaded!"
print_status "Available commands: feeld, govee, android_status, android_packages, android_help"
EOF

    chmod +x "$HOME/android-programs.sh"
    print_success "android-programs.sh created at $HOME/android-programs.sh"
}

# Add source command to shell profile
add_to_shell_profile() {
    print_status "Adding android-programs.sh to shell profile..."

    # Add to .bashrc
    if ! grep -q "android-programs.sh" "$HOME/.bashrc"; then
        echo "" >> "$HOME/.bashrc"
        echo "# Android Programs Launcher" >> "$HOME/.bashrc"
        echo "if [ -f ~/android-programs.sh ]; then" >> "$HOME/.bashrc"
        echo "    source ~/android-programs.sh" >> "$HOME/.bashrc"
        echo "fi" >> "$HOME/.bashrc"
    fi

    # Add to .profile
    if ! grep -q "android-programs.sh" "$HOME/.profile"; then
        echo "" >> "$HOME/.profile"
        echo "# Android Programs Launcher" >> "$HOME/.profile"
        echo "if [ -f ~/android-programs.sh ]; then" >> "$HOME/.profile"
        echo "    source ~/android-programs.sh" >> "$HOME/.profile"
        echo "fi" >> "$HOME/.profile"
    fi

    print_success "android-programs.sh added to shell profiles"
}

# Create desktop shortcuts (optional)
create_desktop_shortcuts() {
    print_status "Creating desktop shortcuts..."

    mkdir -p "$HOME/Desktop"

    # Feeld desktop shortcut
    cat > "$HOME/Desktop/Feeld.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Feeld
Comment=Launch Feeld app in Android emulator
Exec=bash -c "source ~/android-programs.sh && feeld"
Icon=applications-system
Terminal=false
Categories=Application;
EOF

    # Govee desktop shortcut
    cat > "$HOME/Desktop/Govee Home.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Govee Home
Comment=Launch Govee Home app in Android emulator
Exec=bash -c "source ~/android-programs.sh && govee"
Icon=applications-system
Terminal=false
Categories=Application;
EOF

    chmod +x "$HOME/Desktop/Feeld.desktop" "$HOME/Desktop/Govee.desktop"
    print_success "Desktop shortcuts created"
}

# Final verification
verify_installation() {
    print_status "Verifying installation..."

    # Check if environment variables are set
    if [ -z "$ANDROID_SDK_ROOT" ]; then
        export ANDROID_SDK_ROOT="$HOME/Android/Sdk"
        export PATH="$PATH:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator"
    fi

    # Check if tools are accessible
    if [ -f "$ANDROID_SDK_ROOT/platform-tools/adb" ]; then
        print_success "ADB found"
    else
        print_error "ADB not found"
        return 1
    fi

    if [ -f "$ANDROID_SDK_ROOT/emulator/emulator" ]; then
        print_success "Emulator found"
    else
        print_error "Emulator not found"
        return 1
    fi

    if [ -f "$HOME/android-programs.sh" ]; then
        print_success "android-programs.sh found"
    else
        print_error "android-programs.sh not found"
        return 1
    fi

    print_success "Installation verification completed"
}

# Main function
main() {
    print_status "Starting Android Emulator Setup for Ubuntu"
    echo "=============================================="

    check_sudo
    check_ubuntu
    update_system
    install_dependencies
    install_android_sdk
    accept_licenses
    install_sdk_components
    create_avd
    start_emulator_initial
    install_android_apps
    create_android_programs_script
    add_to_shell_profile
    create_desktop_shortcuts
    verify_installation

    echo ""
    print_success "🎉 Setup completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Restart your terminal or run: source ~/.bashrc"
    echo "2. Use the commands:"
    echo "   - feeld    (launch Feeld app)"
    echo "   - govee    (launch Govee Home app)"
    echo "   - android_status (check status)"
    echo "   - android_help (show help)"
    echo ""
    echo "Desktop shortcuts are also available on your Desktop."
    echo ""
    print_warning "Note: The first time you run feeld or govee, the emulator will need to start."
    print_warning "This may take 1-2 minutes initially."
}

# Run main function
main "$@"