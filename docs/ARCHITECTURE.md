# Dotfiles Architecture & Structure

A clean, minimal dotfiles structure with essential directories and standardized conventions for maintainability and consistency.

## 📁 Current Directory Structure

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

## 🟢 User-Facing Directories

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

## 🔴 System Infrastructure

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

## 🔄 How It Works

1. **Fish config** loads environment variables
2. **All scripts** in `bin/` get sourced automatically
3. **Aliases** get loaded
4. **Platform-specific** settings apply

Simple, clean, and it just works.

## 📊 Simplified Structure Benefits

**Before**: 25+ directories, nested structures, unclear purposes
**After**: 4 main directories, clear separation, everything has a purpose

**Removed complexity**:
- ❌ `modules/` with nested subdirectories
- ❌ `core/` with mixed purposes  
- ❌ `templates/` that weren't used
- ❌ `tools/` that were redundant
- ❌ `docs/` (moved to root level)
- ❌ Empty directories and README files

**Result**: Much easier to understand and maintain!

## 🏗️ Naming Conventions

### Directory Names
- **Format**: `lower-kebab-case`
- **Examples**: 
  - `user-management`
  - `config-parser`
  - `shell-utilities`
  - `test-helpers`

### Executable Scripts
- **Format**: `snake_case` with appropriate file extension
- **Examples**:
  - `setup_environment.sh`
  - `backup_dotfiles.fish`
  - `deploy_application.py`
  - `run_tests.bash`

### Documentation Files
- **Format**: `UpperCamelCase.md`
- **Examples**:
  - `Architecture.md`
  - `InstallationGuide.md`
  - `ApiReference.md`
  - `TroubleshootingGuide.md`

### Test Files
- **Format**: `*.spec.fish` (using Fish shell testing framework)
- **Examples**:
  - `user_management.spec.fish`
  - `config_parser.spec.fish`
  - `deployment_script.spec.fish`
  - `utility_functions.spec.fish`

### Configuration Files
- **Format**: Depends on the configuration type, but generally:
  - YAML/JSON: `lower-kebab-case.yaml` or `lower-kebab-case.json`
  - Shell configs: `snake_case.conf` or `.snake_case_rc`
  - Environment files: `.env.environment_name`
- **Examples**:
  - `database-config.yaml`
  - `app-settings.json`
  - `shell_preferences.conf`
  - `.env.development`

### Template Files
- **Format**: `lower-kebab-case.template.extension`
- **Examples**:
  - `docker-compose.template.yml`
  - `config-file.template.json`
  - `readme.template.md`
  - `script-skeleton.template.sh`

### Source Code Files
- **Format**: `snake_case` with appropriate extension
- **Examples**:
  - `user_manager.py`
  - `config_parser.js`
  - `shell_utilities.sh`
  - `test_helpers.fish`

## 🔧 Shell-Specific Organization

When organizing shell-specific content, use the following structure within relevant directories:

```
shell/
├── bash/           # Bash-specific implementations
├── fish/           # Fish shell-specific implementations
├── zsh/            # Zsh-specific implementations
└── common/         # Shell-agnostic or shared functionality
```

### Examples of Shell Organization

```
scripts/
├── shell/
│   ├── bash/
│   │   ├── setup_environment.sh
│   │   └── backup_dotfiles.sh
│   ├── fish/
│   │   ├── setup_environment.fish
│   │   └── backup_dotfiles.fish
│   └── zsh/
│       ├── setup_environment.zsh
│       └── backup_dotfiles.zsh
└── common/
    └── validate_config.py
```

## 📋 File Naming Rules Summary

| File Type | Convention | Example |
|-----------|------------|---------|
| Directories | `lower-kebab-case` | `user-management/` |
| Executable Scripts | `snake_case.ext` | `setup_environment.sh` |
| Documentation | `UpperCamelCase.md` | `InstallationGuide.md` |
| Tests | `*.spec.fish` | `user_manager.spec.fish` |
| Config Files | `lower-kebab-case.ext` | `app-config.yaml` |
| Templates | `lower-kebab-case.template.ext` | `docker.template.yml` |
| Source Code | `snake_case.ext` | `config_parser.py` |

## 🛡️ Enforcement and Tooling

To maintain consistency:

1. **Linting**: Implement file naming linters in CI/CD pipeline
2. **Templates**: Use project templates that follow these conventions
3. **Documentation**: Keep this specification updated and accessible
4. **Code Reviews**: Include naming convention checks in review process
5. **Automation**: Create scripts to validate and fix naming inconsistencies

## 🎯 Exceptions

Exceptions to these rules should be:
1. Documented in this file with justification
2. Approved through team review process
3. Limited in scope and clearly marked

Common acceptable exceptions:
- Third-party tool requirements (e.g., `Dockerfile`, `README.md`)
- Language-specific conventions (e.g., `package.json` for Node.js)
- System file requirements (e.g., `.gitignore`, `.bashrc`)

---

*This specification reflects the current simplified structure and provides guidelines for future development. All team members are expected to follow these conventions to maintain code quality and project organization.*
