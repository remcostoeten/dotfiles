# Dependency Management

The dotfiles repository includes a comprehensive dependency management system that automatically detects, validates, and installs required dependencies for all tools and scripts.

## 🚀 Quick Start

### Check Dependencies
```bash
detect-deps                    # Check all tools
detect-deps git-commit        # Check specific tool
```

### Install Missing Dependencies
```bash
dotfiles-install-deps         # Interactive installation
dotfiles-install-deps --yes   # Auto-install all missing
dotfiles-install-deps --dry-run  # Preview installation
```

## 📋 System Overview

### Components

| Component | Purpose | Location |
|-----------|---------|----------|
| `deps.yaml` | Dependency definitions | `internal/deps/deps.yaml` |
| `detect-deps.fish` | Dependency detection | `internal/deps/detect-deps.fish` |
| `installer.fish` | Cross-platform installer | `internal/deps/installer.fish` |
| `dotfiles-install-deps` | Main installation script | `bin/dotfiles-install-deps` |

### Workflow

1. **Detection**: `detect-deps.fish` reads `deps.yaml` and checks system for missing commands
2. **Analysis**: Reports missing, present, and unknown tools
3. **Installation**: `dotfiles-install-deps` uses `installer.fish` to install missing dependencies
4. **Verification**: Re-checks dependencies after installation

## 📝 Dependencies Configuration (`deps.yaml`)

### Structure

```yaml
tools:
  - tool: script-name.fish           # Tool filename
    requires: [cmd1, cmd2]           # Required dependencies
    optional: [opt1, opt2]           # Optional dependencies
    notes: "Description of tool"     # Human-readable description
```

### Example Entry

```yaml
tools:
  - tool: git-commit.fish
    requires: [git]
    optional: []
    notes: "Interactive Git commit helper with conventional commit support"
    
  - tool: webcam-mic.fish
    requires: [ffmpeg]
    optional: [v4l2-utils, pulseaudio-utils, pactl, brave-browser]
    notes: "Cross-platform webcam and microphone testing utility"
```

### Guidelines

**Required Dependencies:**
- Commands that are essential for the tool to function
- Will be checked and can be auto-installed
- Use generic command names (e.g., `node`, `python3`, `git`)

**Optional Dependencies:**
- Commands that enhance functionality but aren't essential
- Noted but not enforced during installation
- Platform-specific alternatives (e.g., `xclip`, `xsel`, `pbcopy`)

**Notes:**
- Brief description of what the tool does
- Include any platform-specific behavior
- Mention alternative commands or fallbacks

## 🔍 Dependency Detection

### Usage

```bash
# Check all dependencies
detect-deps

# Check specific tool
detect-deps git-commit

# Get help
detect-deps help
```

### Output Categories

**Missing Dependencies:**
```
Missing Dependencies:
  • git-commit requires: git
  • webcam-mic requires: ffmpeg
```

**Present Dependencies:**
```
Present Dependencies:
  • copy has: xclip
  • node-clean has: rm
```

**Unknown Tools:**
```
Unknown Tools (not in deps.yaml):
  • my-custom-script
  • legacy-tool
```

### Return Codes

- `0`: All dependencies satisfied
- `1`: Missing dependencies found
- `2`: Script or configuration errors

## 🛠 Installation System

### Main Installer (`dotfiles-install-deps`)

**Features:**
- Interactive and non-interactive modes
- Dry-run capability
- Automatic dependency detection
- Post-installation verification
- Cross-platform package manager detection

**Options:**
```bash
--yes, -y        # Non-interactive mode (auto-confirm)
--dry-run, -d    # Show what would be installed
--help, -h       # Show help message
```

### Platform Installer (`installer.fish`)

**Supported Platforms:**
- **Linux**: apt (Ubuntu/Debian), dnf (RHEL/Fedora), pacman (Arch)
- **macOS**: Homebrew
- **Fallback**: Manual installation instructions for unsupported platforms

**Package Mapping:**
Generic names are automatically mapped to platform-specific packages:

| Generic | apt | dnf | pacman | brew |
|---------|-----|-----|--------|------|
| `nodejs` | `nodejs npm` | `nodejs npm` | `nodejs npm` | `node` |
| `python` | `python3 python3-pip` | `python3 python3-pip` | `python python-pip` | `python` |
| `git` | `git` | `git` | `git` | `git` |

### Installation Process

1. **Platform Detection**: Identifies OS and available package managers
2. **Package Mapping**: Converts generic names to platform-specific packages
3. **Command Generation**: Creates appropriate install command
4. **User Confirmation**: Shows command and asks for confirmation (unless `--yes`)
5. **Execution**: Runs the installation command
6. **Verification**: Re-checks dependencies to confirm installation

## 🔧 Extending the System

### Adding New Tools

1. **Create the tool script:**
   ```bash
   echo '#!/usr/bin/env fish
   echo "Hello from my-tool"' > ~/.config/dotfiles/bin/my-tool.fish
   chmod +x ~/.config/dotfiles/bin/my-tool.fish
   ```

2. **Add dependencies to `deps.yaml`:**
   ```yaml
   tools:
     - tool: my-tool.fish
       requires: [curl, jq]
       optional: [fzf]
       notes: "My custom tool that fetches and processes JSON data"
   ```

3. **Test dependency detection:**
   ```bash
   detect-deps my-tool
   ```

4. **Install dependencies if needed:**
   ```bash
   dotfiles-install-deps
   ```

### Adding New Package Mappings

Edit `internal/deps/installer.fish` in the `map_package_name` function:

```fish
function map_package_name
    set -l generic_name $argv[1]
    set -l manager $argv[2]
    
    switch $generic_name
        case your-tool
            switch $manager
                case apt
                    echo "your-tool-package"
                case dnf
                    echo "your-tool-rpm"
                case pacman
                    echo "your-tool-arch"
                case brew
                    echo "your-tool"
            end
        # ... existing mappings
    end
end
```

### Adding New Platform Support

1. **Extend platform detection** in `detect_platform()`:
   ```fish
   case YourOS
       echo "youros"
   ```

2. **Add package manager detection** in `detect_package_manager()`:
   ```fish
   else if command -v your-pkg-manager > /dev/null 2>&1
       echo "your-pkg-manager"
   ```

3. **Add install command mapping** in `get_install_command()`:
   ```fish
   case your-pkg-manager
       echo "your-pkg-manager install -y" $packages
   ```

## 🐛 Troubleshooting

### Common Issues

**Dependencies not detected:**
```bash
# Check if deps.yaml exists and is readable
cat ~/.config/dotfiles/internal/deps/deps.yaml

# Verify script permissions
ls -la ~/.config/dotfiles/internal/deps/detect-deps.fish
```

**Installation fails:**
```bash
# Check package manager availability
which apt dnf pacman brew

# Try manual installation
installer.fish git curl nodejs
```

**Tools still not working after installation:**
```bash
# Verify installation
which git curl node

# Check PATH
echo $PATH

# Restart shell
exec fish
```

### Getting Help

```bash
detect-deps help              # Dependency detection help
dotfiles-install-deps --help  # Installation help
installer.fish                # Package installer usage
```

### Manual Installation

If automatic installation fails, the system provides platform-specific manual installation instructions for unsupported platforms or package managers.

## 📊 Current Tool Coverage

The system currently tracks dependencies for:

- **11 total tools** in the dotfiles repository
- **Core dependencies**: git, node, bun, ffmpeg, python3
- **Platform-specific tools**: xclip/xsel (Linux), pbcopy (macOS)
- **Development tools**: lsof, pulseaudio-utils, v4l2-utils
- **Optional enhancements**: fzf, brave-browser

### Summary Statistics

- **Required dependencies**: Automatically detected and installable
- **Optional dependencies**: Documented but not enforced
- **Platform coverage**: Linux (apt/dnf/pacman), macOS (brew)
- **Unknown tools**: Flagged for potential addition to `deps.yaml`

## 🎯 Best Practices

### For Tool Authors

1. **Use generic dependency names** when possible (`node` vs `nodejs`)
2. **Separate required from optional** dependencies clearly
3. **Document platform-specific behavior** in notes
4. **Test on multiple platforms** if possible
5. **Provide graceful degradation** for missing optional dependencies

### For Users

1. **Run dependency checks** after cloning repository
2. **Install dependencies** before using tools extensively
3. **Report missing mappings** for your platform/package manager
4. **Keep `deps.yaml` updated** when adding new tools

### For Maintainers

1. **Keep package mappings current** with platform changes
2. **Test installation flows** on supported platforms
3. **Document new platforms/package managers** as they're added
4. **Review dependency additions** for accuracy and necessity
