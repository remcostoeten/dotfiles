# Dotfiles Structure - Simplified

A clean, minimal dotfiles structure with only essential directories.

## 📁 Directory Overview

```
dotfiles/
├── bin/              # 🟢 Your scripts and commands
├── configs/          # 🟢 Configuration files (Fish, etc.)
├── env/             # 🟢 Environment variables (Linux/macOS/Windows)
└── internal/        # 🔴 System files (don't modify)
    ├── bootstrap/   # Setup scripts
    ├── helpers/     # Help system
    └── loaders/     # Module loading
```

## 🟢 What You Use

### `bin/` - Your Commands
All your executable scripts:
- `copy.fish` - Clipboard utilities
- `kill-ports.fish` - Port management
- `node-clean.fish` - Node.js cleanup
- `git-commit.fish` - Git helpers
- `file-utils.fish` - File operations
- `webcam-mic.fish` - Media testing

### `configs/` - Configuration
- `config.fish` - Fish shell configuration (symlinked to `~/.config/fish/config.fish`)
- Source of truth for all shell settings

### `env/` - Environment Setup
- `linux/`, `macos/`, `windows/`, `wsl/` - Platform-specific settings
- Automatically loads based on your system

## 🔴 System Files (Internal)

### `internal/` - Infrastructure
- `bootstrap/` - Installation scripts
- `helpers/` - Help system files  
- `loaders/` - Module loading logic

**Don't modify these** - they make everything work.

## 🚀 Usage

### Run Commands
```fish
# All these are available after dotfiles load
copy "some text"
kill-ports 3000
node-clean
git-commit
```

### Edit Configuration
```fish
# Edit your Fish config
nvim ~/.config/dotfiles/configs/config.fish
# Changes apply immediately (it's symlinked)
```

### Add New Scripts
```fish
# Just drop new .fish files in bin/
echo 'echo "Hello World"' > ~/.config/dotfiles/bin/hello.fish
# Restart shell and it's available
```

## ✨ What's Gone

Removed all the complex, unused directories:
- ❌ `modules/` with nested subdirectories
- ❌ `core/` with mixed purposes  
- ❌ `templates/` that weren't used
- ❌ `tools/` that were redundant
- ❌ `docs/` (moved to root level)
- ❌ Empty directories and README files

## 🔄 How It Works

1. **Fish config** loads environment variables
2. **All scripts** in `bin/` get sourced automatically
3. **Aliases** get loaded
4. **Platform-specific** settings apply

Simple, clean, and it just works.

## 📊 Before vs After

**Before**: 25+ directories, nested structures, unclear purposes
**After**: 4 main directories, clear separation, everything has a purpose

**Result**: Much easier to understand and maintain!
