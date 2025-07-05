# Documentation Index

Comprehensive documentation for the dotfiles repository.

## 📖 Main Documentation

| Document | Description |
|----------|-------------|
| **[README.md](../README.md)** | Main overview, installation, and getting started guide |
| **[SYMLINKS.md](SYMLINKS.md)** | Symlink management system documentation |
| **[DEPENDENCIES.md](DEPENDENCIES.md)** | Dependency management system guide |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | System architecture and design principles |

## 🚀 Quick Start

1. **New User**: Start with [README.md](../README.md) for installation
2. **Understanding Symlinks**: See [SYMLINKS.md](SYMLINKS.md)
3. **Managing Dependencies**: Check [DEPENDENCIES.md](DEPENDENCIES.md)
4. **System Design**: Read [ARCHITECTURE.md](ARCHITECTURE.md)

## 📋 Feature-Specific Documentation

### Core Systems

- **Installation & Bootstrap**: [README.md#quick-start](../README.md#quick-start)
- **Symlink Management**: [SYMLINKS.md](SYMLINKS.md)
- **Dependency Management**: [DEPENDENCIES.md](DEPENDENCIES.md)
- **Help System**: [README.md#help--documentation](../README.md#help--documentation)

### Tools & Scripts

- **Available Tools**: [README.md#available-tools](../README.md#available-tools)
- **Adding New Tools**: [README.md#adding-new-tools](../README.md#adding-new-tools)
- **Tool Dependencies**: [DEPENDENCIES.md#dependencies-configuration-depsyaml](DEPENDENCIES.md#dependencies-configuration-depsyaml)

### Configuration & Extension

- **Extending deps.yaml**: [README.md#extending-depsyaml](../README.md#extending-depsyaml)
- **Adding Symlinks**: [SYMLINKS.md#adding-new-symlinks](SYMLINKS.md#adding-new-symlinks)
- **Platform Support**: [DEPENDENCIES.md#adding-new-platform-support](DEPENDENCIES.md#adding-new-platform-support)

### Content & Structure

- **File Organization**: [content/STRUCTURE.md](content/STRUCTURE.md)
- **Platform-Specific Settings**: [env/README.md](env/README.md)

## 🛠 System Components

### Core Files

| File | Purpose | Documentation |
|------|---------|---------------|
| `bootstrap.fish` | Main setup script | [README.md#installation](../README.md#installation) |
| `deps.yaml` | Dependency definitions | [DEPENDENCIES.md#dependencies-configuration-depsyaml](DEPENDENCIES.md#dependencies-configuration-depsyaml) |
| `config.fish` | Fish shell configuration | [STRUCTURE.md](content/STRUCTURE.md) |

### Key Scripts

| Script | Purpose | Documentation |
|--------|---------|---------------|
| `dotfiles-install-deps` | Dependency installer | [DEPENDENCIES.md#main-installer-dotfiles-install-deps](DEPENDENCIES.md#main-installer-dotfiles-install-deps) |
| `detect-deps.fish` | Dependency detection | [DEPENDENCIES.md#dependency-detection](DEPENDENCIES.md#dependency-detection) |
| `symlink-manager.fish` | Symlink management | [SYMLINKS.md#how-it-works](SYMLINKS.md#how-it-works) |
| `installer.fish` | Cross-platform installer | [DEPENDENCIES.md#platform-installer-installerfish](DEPENDENCIES.md#platform-installer-installerfish) |

## 🔍 Finding Information

### By Task

| I want to... | See |
|--------------|-----|
| Install dotfiles | [README.md#quick-start](../README.md#quick-start) |
| Check dependencies | [DEPENDENCIES.md#dependency-detection](DEPENDENCIES.md#dependency-detection) |
| Manage symlinks | [SYMLINKS.md](SYMLINKS.md) |
| Add a new tool | [README.md#adding-new-tools](../README.md#adding-new-tools) |
| Extend for my platform | [DEPENDENCIES.md#adding-new-platform-support](DEPENDENCIES.md#adding-new-platform-support) |
| Understand the design | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Troubleshoot issues | [DEPENDENCIES.md#troubleshooting](DEPENDENCIES.md#troubleshooting), [SYMLINKS.md#troubleshooting](SYMLINKS.md#troubleshooting) |

### By Component

| Component | Documentation |
|-----------|---------------|
| Dependency System | [DEPENDENCIES.md](DEPENDENCIES.md) |
| Symlink System | [SYMLINKS.md](SYMLINKS.md) |
| Bootstrap Process | [README.md#installation](../README.md#installation) |
| Tool Scripts | [README.md#available-tools](../README.md#available-tools) |
| Configuration | [content/STRUCTURE.md](content/STRUCTURE.md) |

## 🆘 Getting Help

### Built-in Help

```bash
dotfiles help                 # Main help system
dotfiles-install-deps --help  # Dependency installer help
detect-deps help              # Dependency detection help
symlink-manager help          # Symlink manager help
```

### Documentation Commands

```bash
# Quick reference
dotfiles help

# View specific documentation (if editor is configured)
dotfiles docs deps           # Open DEPENDENCIES.md
dotfiles docs symlinks       # Open SYMLINKS.md
dotfiles docs readme         # Open README.md
```

### Troubleshooting Steps

1. **Installation Issues**: [README.md#quick-start](../README.md#quick-start)
2. **Dependency Problems**: [DEPENDENCIES.md#troubleshooting](DEPENDENCIES.md#troubleshooting)
3. **Symlink Issues**: [SYMLINKS.md#troubleshooting](SYMLINKS.md#troubleshooting)
4. **Tool Not Working**: [DEPENDENCIES.md#common-issues](DEPENDENCIES.md#common-issues)

## 📊 Documentation Coverage

### System Features

- ✅ **Installation Process**: Fully documented
- ✅ **Dependency Management**: Comprehensive guide
- ✅ **Symlink Management**: Complete documentation
- ✅ **Tool Usage**: Examples and help available
- ✅ **Extension Guide**: Adding tools and platforms
- ✅ **Troubleshooting**: Common issues covered

### Missing Documentation

- ⚠️ **Individual tool documentation**: Could be expanded
- ⚠️ **Advanced configuration**: Could be more detailed
- ⚠️ **Development guide**: For contributors

## 🔄 Keeping Documentation Updated

When adding new features:

1. **Update deps.yaml** for new tools
2. **Update DEPENDENCIES.md** for new mappings
3. **Update README.md** for new tools in the table
4. **Update SYMLINKS.md** for new symlinks
5. **Update this index** for new documentation files

---

**Note**: This documentation system is designed to be self-contained and comprehensive. Each document serves a specific purpose and cross-references related information.
