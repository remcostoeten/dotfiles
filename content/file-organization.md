# File Organization: Internal vs User-Facing

This document explains the clear separation between internal infrastructure files and user-facing functionality in the dotfiles system.

## Directory Structure Overview

```
dotfiles/
├── bin/              # USER-FACING: Executable scripts and commands
├── configs/          # USER-FACING: Configuration files (Fish, etc.)
├── env/             # USER-FACING: Environment variables and platform configs
├── internal/        # INTERNAL: Infrastructure and build system
│   ├── bootstrap/   # INTERNAL: Setup and installation scripts
│   ├── helpers/     # INTERNAL: Helper factory and registration system
│   └── loaders/     # INTERNAL: Module loading and initialization
├── modules/         # USER-FACING: Feature modules (may be empty after organization)
├── templates/       # USER-FACING: Templates for creating new scripts
└── tools/          # USER-FACING: Development utilities
```

## File Categories

### 🟢 USER-FACING FILES
These files provide direct functionality to the user:

#### `bin/` - Executable Commands
- **Purpose**: Scripts that users can run directly
- **Examples**: `copy.fish`, `kill-ports.fish`, `node-clean.fish`
- **Characteristics**: 
  - Provide actual functionality
  - Can be called from command line
  - Contain the main logic for features

#### `configs/` - Configuration Files
- **Purpose**: Source of truth for shell and tool configurations
- **Examples**: `fish/config.fish`
- **Characteristics**:
  - Symlinked to actual config locations
  - Version controlled
  - User-modifiable

#### `env/` - Environment Management
- **Purpose**: Platform-specific environment variables and settings
- **Examples**: `linux/env.sh`, `macos/env.sh`
- **Characteristics**:
  - Loaded automatically based on platform
  - Define PATH, variables, etc.
  - User-facing environment setup

#### `templates/` - Code Generation
- **Purpose**: Templates for creating new scripts and modules
- **Examples**: `script.fish.tpl`, `module.tpl`
- **Characteristics**:
  - Used by development tools
  - Help maintain consistency
  - User-accessible for creating content

#### `tools/` - Development Utilities
- **Purpose**: Scripts that help with dotfiles development
- **Examples**: `new-script`, `validate-config`
- **Characteristics**:
  - Meta-tools for working with dotfiles
  - Development workflow helpers
  - User-accessible utilities

### 🔴 INTERNAL FILES
These files provide infrastructure and should not be directly modified:

#### `internal/bootstrap/` - System Setup
- **Purpose**: Installation and initial setup scripts
- **Examples**: (currently empty after cleanup)
- **Characteristics**:
  - Run during installation
  - Handle system integration
  - Not for regular use

#### `internal/helpers/` - Helper System
- **Purpose**: Helper registration and factory system
- **Examples**: `*-helper.fish`, `helper-factory.fish`
- **Characteristics**:
  - Infrastructure for help system
  - Auto-generated content
  - Internal plumbing

#### `internal/loaders/` - Module Loading
- **Purpose**: System for loading and initializing modules
- **Examples**: `source-all.fish`, `load-aliases.fish`
- **Characteristics**:
  - Bootstrap the dotfiles system
  - Handle dependency ordering
  - Internal initialization logic

## Usage Patterns

### For Users:
- **Direct execution**: Use scripts in `bin/`
- **Configuration**: Modify files in `configs/`
- **Environment**: Adjust platform settings in `env/`
- **Development**: Use tools in `tools/` and `templates/`

### For System:
- **Initialization**: `internal/loaders/` handle startup
- **Setup**: `internal/bootstrap/` handle installation
- **Help system**: `internal/helpers/` provide documentation

## File Naming Conventions

### User-Facing Files:
- **Commands**: Descriptive names (e.g., `kill-ports.fish`)
- **Configs**: Standard names (e.g., `config.fish`)
- **Templates**: `name.template.ext`

### Internal Files:
- **Loaders**: `load-*.fish`, `source-*.fish`
- **Helpers**: `*-helper.fish`
- **Bootstrap**: `setup-*.fish`, `install-*.fish`

## Benefits of This Organization

1. **Clear Separation**: Users know what they can modify
2. **Maintainability**: Internal files can be updated without user impact
3. **Documentation**: Purpose of each file is clear from location
4. **Automation**: Tools can distinguish between categories
5. **Security**: Internal files are protected from accidental modification

## Migration Notes

Files have been reorganized as follows:

- **Old `modules/*/` structure** → **New `bin/` for executables**
- **Old `core/` mixed structure** → **New `internal/` separation**
- **Helper files** → **Moved to `internal/helpers/`**
- **Bootstrap scripts** → **Moved to `internal/bootstrap/`**

This provides a much cleaner separation between what users interact with and what the system needs to function.
