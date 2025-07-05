#!/usr/bin/env fish

# Cross-platform installer helper
# Usage: ./installer.fish <package1> [package2] [package3] ...

# Color definitions
set -l GREEN (set_color green)
set -l RED (set_color red)
set -l YELLOW (set_color yellow)
set -l BLUE (set_color blue)
set -l NORMAL (set_color normal)

function print_usage
    echo "Usage: installer.fish <package1> [package2] [package3] ..."
    echo "Example: installer.fish git curl nodejs python"
end

function show_manual_install_message
    set -l packages $argv
    
    echo "$RED╔═══════════════════════════════════════════════════════════════╗$NORMAL"
    echo "$RED║                   UNSUPPORTED PLATFORM                       ║$NORMAL"
    echo "$RED╚═══════════════════════════════════════════════════════════════╝$NORMAL"
    echo ""
    echo "$YELLOW⚠ This system is not currently supported by the automated installer.$NORMAL"
    echo ""
    echo "$BLUE📋 Manual installation required for the following packages:$NORMAL"
    for pkg in $packages
        echo "  $YELLOW•$NORMAL $pkg"
    end
    echo ""
    echo "$BLUE💡 Platform-specific installation suggestions:$NORMAL"
    echo ""
    
    set -l platform (uname -s)
    switch $platform
        case FreeBSD
            echo "  $BLUE• FreeBSD:$NORMAL Use pkg install <package-name>"
            echo "  $BLUE• Example:$NORMAL pkg install git curl node"
        case OpenBSD
            echo "  $BLUE• OpenBSD:$NORMAL Use pkg_add <package-name>"
            echo "  $BLUE• Example:$NORMAL pkg_add git curl node"
        case NetBSD
            echo "  $BLUE• NetBSD:$NORMAL Use pkgin install <package-name>"
            echo "  $BLUE• Example:$NORMAL pkgin install git curl nodejs"
        case SunOS
            echo "  $BLUE• Solaris:$NORMAL Use pkg install <package-name>"
            echo "  $BLUE• Example:$NORMAL pkg install git curl nodejs"
        case AIX
            echo "  $BLUE• AIX:$NORMAL Use yum or rpm for package management"
            echo "  $BLUE• Example:$NORMAL yum install git curl nodejs"
        case 'CYGWIN*'
            echo "  $BLUE• Cygwin:$NORMAL Use Cygwin package manager"
            echo "  $BLUE• Example:$NORMAL apt-cyg install git curl nodejs"
        case 'MINGW*'
            echo "  $BLUE• MinGW:$NORMAL Use pacman (MSYS2) or manual installation"
            echo "  $BLUE• Example:$NORMAL pacman -S git curl nodejs"
        case '*'
            echo "  $BLUE• Your platform ($platform):$NORMAL Please consult your system's documentation"
            echo "  $BLUE• Common options:$NORMAL Package manager, source compilation, or binary downloads"
    end
    
    echo ""
    echo "$BLUE🔗 Alternative installation methods:$NORMAL"
    echo "  $YELLOW•$NORMAL Install from official websites or repositories"
    echo "  $YELLOW•$NORMAL Use language-specific package managers (npm, pip, etc.)"
    echo "  $YELLOW•$NORMAL Compile from source code"
    echo "  $YELLOW•$NORMAL Use universal package managers (snap, flatpak, appimage)"
    echo ""
    echo "$BLUE📚 For more help, visit:$NORMAL"
    echo "  $YELLOW•$NORMAL Official documentation for each package"
    echo "  $YELLOW•$NORMAL Your operating system's package management documentation"
    echo ""
end

function detect_platform
    set -l platform (uname -s)
    switch $platform
        case Darwin
            echo "macos"
        case Linux
            echo "linux"
        case '*'
            echo "unknown"
    end
end

function detect_package_manager
    # Check for package managers in order of preference
    if command -v brew >/dev/null 2>&1
        echo "brew"
    else if command -v apt >/dev/null 2>&1
        echo "apt"
    else if command -v dnf >/dev/null 2>&1
        echo "dnf"
    else if command -v pacman >/dev/null 2>&1
        echo "pacman"
    else
        echo "none"
    end
end

function map_package_name
    set -l generic_name $argv[1]
    set -l manager $argv[2]
    
    # Package name mappings - add more as needed
    switch $generic_name
        case nodejs
            switch $manager
                case apt
                    echo "nodejs npm"
                case dnf
                    echo "nodejs npm"
                case pacman
                    echo "nodejs npm"
                case brew
                    echo "node"
                case '*'
                    echo $generic_name
            end
        case python
            switch $manager
                case apt
                    echo "python3 python3-pip"
                case dnf
                    echo "python3 python3-pip"
                case pacman
                    echo "python python-pip"
                case brew
                    echo "python"
                case '*'
                    echo $generic_name
            end
        case git curl wget
            # These are usually the same across managers
            echo $generic_name
        case '*'
            # Default: use the generic name as-is
            echo $generic_name
    end
end

function get_install_command
    set -l manager $argv[1]
    set -l packages $argv[2..-1]
    
    switch $manager
        case apt
            echo "sudo apt update && sudo apt install -y" $packages
        case dnf
            echo "sudo dnf install -y" $packages
        case pacman
            echo "sudo pacman -S --noconfirm" $packages
        case brew
            echo "brew install" $packages
        case '*'
            echo ""
    end
end

function ask_confirmation
    set -l command $argv[1]
    echo
    echo "Planned command:"
    echo "  $command"
    echo
    read -l -P "Execute this command? [y/N]: " response
    
    switch $response
        case y Y yes YES
            return 0
        case '*'
            return 1
    end
end

function main
    # Check if packages were provided
    if test (count $argv) -eq 0
        print_usage
        exit 1
    end
    
    set -l packages $argv
    
    # Detect platform and package manager
    set -l platform (detect_platform)
    set -l manager (detect_package_manager)
    
    echo "$BLUE→ Detected platform:$NORMAL $platform"
    echo "$BLUE→ Detected package manager:$NORMAL $manager"
    echo
    
    # Check for unsupported platform
    if test "$platform" = "unknown"
        show_manual_install_message $packages
        exit 2
    end
    
    # Check if package manager is available
    if test "$manager" = "none"
        echo "$RED✗ No supported package manager found (apt, dnf, pacman, brew)$NORMAL"
        echo "$YELLOW⚠ Falling back to manual installation instructions...$NORMAL"
        echo
        show_manual_install_message $packages
        exit 2
    end
    
    # Map generic package names to manager-specific ones
    set -l mapped_packages
    for pkg in $packages
        set -l mapped (map_package_name $pkg $manager)
        set mapped_packages $mapped_packages $mapped
    end
    
    echo "$BLUE→ Packages to install:$NORMAL $mapped_packages"
    
    # Get the install command
    set -l install_cmd (get_install_command $manager $mapped_packages)
    
    if test -z "$install_cmd"
        echo "$RED✗ Error: Could not generate install command for manager: $manager$NORMAL"
        show_manual_install_message $packages
        exit 2
    end
    
    # Ask for confirmation
    if ask_confirmation "$install_cmd"
        echo
        echo "$BLUE→ Executing installation...$NORMAL"
        
        # Execute the command
        eval $install_cmd
        set -l exit_code $status
        
        if test $exit_code -eq 0
            echo
            echo "$GREEN✓ Installation completed successfully!$NORMAL"
        else
            echo
            echo "$RED✗ Installation failed with exit code: $exit_code$NORMAL"
            exit $exit_code
        end
    else
        echo
        echo "$YELLOW⚠ Installation cancelled by user.$NORMAL"
        exit 0
    end
end

# Run main function with all arguments
main $argv
