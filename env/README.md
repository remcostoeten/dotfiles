# Environment Configuration System

This directory contains platform-specific environment configurations that are automatically loaded based on the detected operating system.

## Directory Structure

```
env/
├── common/          # Shared configuration for all platforms
│   ├── env.sh      # Common environment variables and settings
│   └── modules.list # Common modules to load
├── linux/          # Linux-specific configuration
│   ├── env.sh      # Linux environment variables and aliases
│   └── modules.list # Linux-specific modules
├── macos/          # macOS-specific configuration
│   ├── env.sh      # macOS environment variables and aliases
│   └── modules.list # macOS-specific modules
├── loader.sh       # Environment loader script
├── init.sh         # Simple initialization script
└── README.md       # This file
```

## How It Works

1. **Platform Detection**: The system automatically detects the current platform:
   - `linux` - Linux distributions
   - `macos` - macOS
   - `unknown` - Fallback for unrecognized platforms

2. **Configuration Loading**: 
   - Common configuration is always loaded first
   - Platform-specific configuration is loaded second (overrides common settings)
   - Both configurations are merged seamlessly

3. **Module Loading**:
   - Modules from `common/modules.list` are loaded first
   - Platform-specific modules from `<platform>/modules.list` are loaded second
   - The system automatically handles missing modules gracefully

## Configuration Files

### Environment Files (`env.sh`)

These files contain:
- Environment variables
- PATH modifications
- Aliases and functions
- Platform-specific settings

Example:
```bash
# Export environment variables
export EDITOR="nvim"
export BROWSER="firefox"

# Add to PATH
export PATH="/usr/local/bin:$PATH"

# Define aliases
alias ll='ls -la'
alias grep='grep --color=auto'
```

### Module Lists (`modules.list`)

These files contain module names to load, one per line:
```
# Core modules
git
filesystem
clipboard

# Development modules
development/core
development/tools
```

Lines starting with `#` are treated as comments and ignored.

## Usage

### Automatic Loading

The environment system is automatically loaded by the bootstrap scripts. No manual intervention is required.

### Manual Loading

You can manually load the environment configuration:

```bash
# Load environment and modules
source /path/to/dotfiles/env/init.sh

# Or use the loader directly
source /path/to/dotfiles/env/loader.sh
main load
```

### Checking Configuration

Use the loader script to inspect the current configuration:

```bash
# Show detected platform
./env/loader.sh platform

# Show merged modules list
./env/loader.sh modules

# Show environment information
./env/loader.sh info
```

## Platform-Specific Features

### Linux
- Package manager detection (apt, yum, dnf, pacman, zypper)
- Desktop environment detection
- Systemd integration
- Wayland/X11 support

### macOS
- Homebrew integration (Intel vs Apple Silicon)
- Xcode Command Line Tools support
- macOS-specific utilities and aliases
- Finder integration


## Customization

### Adding New Platforms

1. Create a new directory: `env/newplatform/`
2. Add `env.sh` and `modules.list` files
3. Update the platform detection in `loader.sh`

### Adding Configuration

1. **Common settings**: Edit `env/common/env.sh`
2. **Platform-specific settings**: Edit `env/<platform>/env.sh`
3. **Modules**: Add module names to the appropriate `modules.list` file

### Module Structure

Modules should follow this structure:
```
modules/example/
├── init.sh         # Main initialization
├── env.sh          # Environment variables
├── aliases.sh      # Aliases
├── functions.sh    # Functions
├── linux.sh        # Linux-specific code
└── macos.sh        # macOS-specific code
```

The loader will automatically source available files in this order:
1. Common files (`init.sh`, `env.sh`, `aliases.sh`, `functions.sh`)
2. Platform-specific files (`<platform>.sh`, `env.<platform>.sh`, `aliases.<platform>.sh`)

## Environment Variables

The following variables are automatically set:

- `DOTFILES_PLATFORM`: Detected platform name
- `DOTFILES_ENV_ROOT`: Path to the env directory
- `DOTFILES_ROOT`: Path to the dotfiles root directory

## Troubleshooting

### Check Platform Detection
```bash
echo $DOTFILES_PLATFORM
# or
./env/loader.sh platform
```

### Debug Module Loading
```bash
./env/loader.sh info
```

### Check Environment Variables
```bash
env | grep DOTFILES
```

### Common Issues

1. **Modules not loading**: Check that module paths exist in `modules/` directory
2. **Wrong platform detected**: Platform detection is based on `$OSTYPE` and system files
3. **Environment not applied**: Ensure the environment is sourced, not executed
4. **Permission errors**: Check file permissions on configuration files

## Integration with Bootstrap

To integrate with existing bootstrap scripts, add this line:

```bash
# Load environment configuration
source "${DOTFILES_ROOT}/env/init.sh"
```

This will automatically detect the platform and load the appropriate configuration.

## Dependency Management Integration

The environment system works closely with the dependency management system:

- **Platform Detection**: Used by the dependency installer to select appropriate package managers
- **Environment Variables**: Platform-specific settings help tools function correctly
- **Package Manager Integration**: Environment configuration includes paths for platform-specific package managers

### Related Tools

- **[Dependency Management](../docs/DEPENDENCIES.md)**: Comprehensive dependency detection and installation
- **[Platform Installer](../internal/deps/installer.fish)**: Cross-platform package installation
- **[Bootstrap Process](../bootstrap.fish)**: Automated setup including environment and dependencies

### Platform-Specific Package Managers

The environment system helps configure:

- **Linux**: apt, dnf, pacman paths and configuration
- **macOS**: Homebrew paths and Apple Silicon support
- **Development**: Node.js, Python, and other language-specific tools

This ensures that dependency installation and tool execution work seamlessly across platforms.
