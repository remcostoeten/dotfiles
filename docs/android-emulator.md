# Android Emulator Tools

A comprehensive suite for running Android apps on Linux using Android emulator. Perfectly configured for running mobile apps like Feeld and Govee Home on your desktop.

## 🚀 Quick Start

### Installation (First-time setup)
```bash
# Run the complete setup
./setup-android-emulator.sh
```

### Daily Usage
```bash
# Start Android emulator with smart device detection
./android-emulator start

# Launch Feeld app (auto-starts emulator if needed)
fish -c "feeld"

# Launch Govee Home app
fish -c "govee"

# Check emulator status
./android-emulator status
```

## 📁 Files Overview

### Core Tools

| File | Purpose | Features |
|------|---------|----------|
| `setup-android-emulator.sh` | Complete Android SDK installer | Installs Android SDK, creates AVD, sets up environment |
| `android-emulator` | Advanced emulator management | Smart device detection, performance optimizations, beautiful UI |
| `android.fish` | Fish shell integration | Quick app launchers, aliases, enhanced CLI experience |

### Key Features

#### 🎯 Smart App Launching
- **Toggle behavior**: If app is running, stops emulator; if not, starts and launches
- **Auto-start**: Automatically starts emulator when needed
- **Fast mode**: Optimized startup with no audio, host GPU, 4GB RAM
- **Quick commands**: `feeld`, `govee` for instant app access

#### 🛠️ Advanced Emulator Management
```bash
./android-emulator start    # Start with smart device detection
./android-emulator stop     # Stop running emulator
./android-emulator restart  # Restart emulator
./android-emulator status   # Check status and device info
./android-emulator list     # List available AVDs
./android-emulator packages # List installed apps
./android-emulator logcat   # Show live logs
./android-emulator screenshot # Take screenshot
```

#### 🎨 Beautiful Interface
- Gradient ASCII art with Android robot
- Pastel color scheme
- Enhanced error messages and troubleshooting tips
- Progress indicators and status updates

## 📱 Device Configuration

### Preferred Devices (in order):
1. Pixel_9_Pro_Fold
2. Pixel_9_Pro
3. Pixel_9_Pro_Test
4. Pixel_9_Pro_Test_API_35
5. Pixel_9
6. Pixel_8_Pro

### Performance Optimizations:
- **Memory**: 4GB RAM (configurable)
- **CPU**: 4 cores
- **GPU**: Host acceleration
- **Startup**: No boot animation, no audio, no snapshot load
- **Network**: Full system network access

## 🎮 Target Apps

### Pre-configured Launchers:
- **Feeld** (`co.feeld`) - Social/dating app
- **Govee Home** (`com.govee.home`) - Smart home lighting control

### Adding New Apps:
```fish
# In android.fish, add:
function app_name
    launch_android_app "App Name" "package.name"
end
```

## 🛠️ System Requirements

- **OS**: Ubuntu 18.04+ (Linux variants supported)
- **RAM**: Minimum 4GB (8GB recommended)
- **Storage**: 5GB free space for SDK and AVD
- **CPU**: Virtualization support (KVM recommended)

## 📋 Installation Details

### What Gets Installed:
- Android SDK with command-line tools
- Android Platform Tools (ADB, fastboot)
- Android Emulator with system images
- Pixel 9 Pro Virtual Device (Android 14, Google APIs)
- Optimized emulator configuration

### Environment Variables:
```bash
export ANDROID_SDK_ROOT="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator"
```

## 🎯 Usage Examples

### Basic Commands:
```bash
# Start emulator (auto-detects best device)
./android-emulator start

# Start with debug output
DEBUG=1 ./android-emulator start

# Non-interactive mode
NON_INTERACTIVE=1 ./android-emulator start
```

### Fish Shell Integration:
```fish
# Quick app launching
feeld          # Launch Feeld app
govee          # Launch Govee Home app
android        # Start emulator with options
android -l     # List available devices
android -f     # Start with optimizations
android -n     # Start headless (no GUI)

# Package management
android_packages           # List all installed apps
android_packages feeld     # Search for Feeld packages
```

### App Management:
```bash
# Check what's running
./android-emulator status

# View device logs
./android-emulator logcat

# Take screenshot
./android-emulator screenshot

# List all installed packages
./android-emulator packages
```

## 🔧 Troubleshooting

### Common Issues:

#### Emulator won't start:
```bash
# Check KVM support
egrep -c '(vmx|svm)' /proc/cpuinfo

# Install KVM if needed
sudo apt install qemu-kvm
sudo usermod -a -G kvm $USER
# Log out and back in
```

#### ADB not found:
```bash
# Check environment variables
echo $ANDROID_SDK_ROOT
echo $PATH

# Source the Fish functions
fish -c "source android-tools/android.fish"
```

#### Performance issues:
```bash
# Increase memory in Android Studio Device Manager
# Or edit AVD config: ~/.android/avd/Pixel_9_Pro.avd/config.ini
hw.ramSize=4096
hw.cpu.ncore=4
```

#### Port conflicts:
```bash
# Kill existing emulator processes
adb emu kill
pkill -f emulator
```

### Reset Everything:
```bash
# Remove entire Android setup
rm -rf ~/Android
rm -rf ~/.android

# Re-run setup
./setup-android-emulator.sh
```

## 🎨 Customization

### Add New Preferred Devices:
Edit `android-emulator` script:
```bash
preferred_devices=(
    "Your_Device_Name"
    "Pixel_9_Pro_Fold"
    "Pixel_9_Pro"
    # ... add more devices
)
```

### Custom App Launchers:
Add to `android.fish`:
```fish
function my_app
    launch_android_app "My App" "com.myapp.package"
end
```

### Performance Tuning:
Edit emulator startup flags in `android-emulator`:
```bash
$emulator_path -avd "$selected_device" \
    -no-snapshot-load \
    -no-boot-anim \
    -no-audio \
    -gpu host \
    -accel on \
    -memory 6144 \  # Increase to 6GB
    -cores 8 \      # Use 8 CPU cores
    -no-window &
```

## 📚 Commands Reference

### android-emulator Commands:
| Command | Description |
|---------|-------------|
| `start` | Start emulator with smart device detection |
| `stop` | Stop running emulator |
| `restart` | Stop and restart emulator |
| `status` | Check emulator and device status |
| `list` | List available AVDs |
| `devices` | List connected devices |
| `packages [filter]` | List/search installed packages |
| `logcat` | Show live device logs |
| `screenshot` | Take device screenshot |
| `feeld` | Launch Feeld app |
| `govee` | Launch Govee Home app |
| `whatsapp` | Launch WhatsApp (Desktop) |
| `spotify` | Launch Spotify (Desktop) |

### Fish Functions:
| Function | Description |
|----------|-------------|
| `feeld` | Launch Feeld app with toggle behavior |
| `govee` | Launch Govee Home app with toggle behavior |
| `android` | Start emulator with options (-l, -f, -n) |
| `android_packages [name]` | List/search installed packages |

## 🔒 Privacy & Security

- **Local Data**: All app data contained within Android emulator
- **Network**: Apps use system network connection
- **Google**: Required only for Play Store access during app installation
- **Isolation**: Apps run in sandboxed environment

## 📄 License

Personal use. Please respect app terms of service and Google Play Store policies.

---

**Enjoy your Android apps on Linux! 🚀**