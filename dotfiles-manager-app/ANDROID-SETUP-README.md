# Android Emulator Setup with Feeld & Govee (Ubuntu)

This setup provides a complete Android emulation environment with easy launchers for Feeld and Govee Home apps on Ubuntu.

## 🚀 Quick Start

### One-Command Setup (Fresh Ubuntu)
```bash
# Download and run the setup script
wget https://raw.githubusercontent.com/your-repo/dotfiles-manager-app/main/setup-android-emulator.sh
chmod +x setup-android-emulator.sh
./setup-android-emulator.sh
```

### Manual Installation
If you prefer manual setup, see the detailed instructions below.

## 📋 What This Installs

- **Android SDK** with command-line tools
- **Android Virtual Device** (Pixel 9 Pro, Android 14)
- **Feeld app** (social/dating app)
- **Govee Home app** (smart home lighting)
- **`android-programs.sh`** with easy launcher functions
- **Desktop shortcuts** for both apps

## 🛠️ System Requirements

- **OS**: Ubuntu 18.04+ (any recent version)
- **RAM**: Minimum 4GB (8GB recommended)
- **Storage**: 5GB free space
- **Internet**: Required for downloads and Play Store access

## 📁 Files Created

- `~/Android/Sdk/` - Android SDK installation
- `~/android-programs.sh` - Launcher functions script
- `~/Desktop/Feeld.desktop` - Feeld desktop shortcut
- `~/Desktop/Govee Home.desktop` - Govee desktop shortcut

## 🎮 Usage

### After Setup
```bash
# Restart your terminal or reload shell
source ~/.bashrc

# Launch Feeld app
feeld

# Launch Govee Home app
govee

# Check status
android_status

# Show help
android_help
```

### Available Commands

#### App Launchers
- `feeld` - Launch Feeld app (auto-starts emulator if needed)
- `govee` - Launch Govee Home app (auto-starts emulator if needed)

#### Emulator Control
- `android_start` - Start emulator in background
- `android_stop` - Stop emulator
- `android_restart` - Restart emulator
- `android_gui` - Start emulator with GUI window

#### Information
- `android_status` - Check emulator and app status
- `android_packages [filter]` - List installed packages
- `android_help` - Show help menu

## 🔧 Manual Setup (Advanced)

If you prefer to set up everything manually on Ubuntu:

### 1. Install Dependencies
```bash
sudo apt update
sudo apt install -y wget unzip curl openjdk-11-jdk build-essential \
    libc6:i386 libncurses5:i386 libstdc++6:i386 lib32z1 libbz2-1.0:i386
```

### 2. Install Android SDK
```bash
# Create directories
mkdir -p ~/Android/Sdk

# Download command line tools
wget -O /tmp/cmdtools.zip https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip
cd /tmp
unzip cmdtools.zip
mkdir -p ~/Android/Sdk/cmdline-tools/latest
mv cmdline-tools/* ~/Android/Sdk/cmdline-tools/latest/ 2>/dev/null || true

# Set environment variables
export ANDROID_SDK_ROOT="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator"

# Add to shell profile
echo 'export ANDROID_SDK_ROOT="$HOME/Android/Sdk"' >> ~/.bashrc
echo 'export PATH="$PATH:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator"' >> ~/.bashrc
```

### 3. Install Android Components
```bash
# Accept licenses
yes | sdkmanager --licenses

# Install required components
sdkmanager "platform-tools" "platforms;android-34" "system-images;android-34;google_apis;x86_64" "emulator"
```

### 4. Create Virtual Device
```bash
# Create AVD
echo "no" | avdmanager create avd -n Pixel_9_Pro -k "system-images;android-34;google_apis;x86_64"

# Configure for performance
cat > ~/.android/avd/Pixel_9_Pro.avd/config.ini << EOF
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
```

### 5. Install Apps
```bash
# Start emulator with GUI
emulator -avd Pixel_9_Pro

# In the emulator:
# 1. Open Google Play Store
# 2. Sign in with Google account
# 3. Install "Feeld" (co.feeld)
# 4. Install "Govee Home" (com.govee.home)
# 5. Close emulator
```

### 6. Setup Launcher Script
```bash
# Download or copy the android-programs.sh script
wget https://raw.githubusercontent.com/your-repo/dotfiles-manager-app/main/android-programs.sh -O ~/android-programs.sh
chmod +x ~/android-programs.sh

# Add to shell profile
echo 'if [ -f ~/android-programs.sh ]; then source ~/android-programs.sh; fi' >> ~/.bashrc
```

## 🐛 Troubleshooting

### Common Issues

#### Emulator Won't Start
```bash
# Check KVM support
egrep -c '(vmx|svm)' /proc/cpuinfo  # Should be > 0
lsmod | grep kvm                    # Should show kvm_intel or kvm_amd

# Install KVM if needed
sudo apt install qemu-kvm
sudo usermod -a -G kvm $USER
# Log out and back in
```

#### "adb: command not found"
```bash
# Check environment variables
echo $ANDROID_SDK_ROOT
echo $PATH

# Source the script
source ~/android-programs.sh
```

#### "Failed to launch app"
```bash
# Check if app is installed
android_packages feeld
android_packages govee

# Reinstall apps if needed
android_gui  # Start with GUI
# Open Play Store and reinstall
```

#### Performance Issues
```bash
# Ensure hardware acceleration is enabled
android_status  # Check if GPU mode is "host"

# Reduce emulator resources if needed
# Edit: ~/.android/avd/Pixel_9_Pro.avd/config.ini
# hw.ramSize=1024
# hw.cpu.ncore=2
```

#### Port Conflicts
```bash
# Kill existing emulator processes
adb emu kill
pkill -f emulator

# Check for running processes
ps aux | grep emulator
```

### Reset Everything
```bash
# Remove entire Android setup
rm -rf ~/Android
rm -rf ~/.android
rm ~/android-programs.sh
rm ~/Desktop/Feeld.desktop ~/Desktop/Govee\ Home.desktop

# Remove from shell profile
sed -i '/android-programs.sh/d' ~/.bashrc ~/.profile
sed -i '/Android SDK Environment Variables/d' ~/.bashrc ~/.profile

# Run setup again
./setup-android-emulator.sh
```

## 📱 App Information

### Feeld
- **Package**: `co.feeld`
- **Category**: Social/Dating
- **Play Store**: Available worldwide
- **Requirements**: Google account

### Govee Home
- **Package**: `com.govee.home`
- **Category**: Smart Home/Lighting
- **Play Store**: Available worldwide
- **Requirements**: Google account, Govee devices optional

## 🔒 Privacy & Security

- **Data**: All app data is contained within the Android emulator
- **Network**: Apps use your system network connection
- **Google**: Required for Play Store access only
- **Local**: No data is sent to external servers by this setup

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Ensure all dependencies are installed
3. Verify Android SDK paths are correct
4. Check system resources (RAM, disk space)
5. Try resetting the setup

## 📄 License

This setup script is provided as-is for personal use. Please respect the terms of service of the Android apps and Google Play Store.

---

**Enjoy your Android apps on Ubuntu! 🚀**