# Dotfiles Help Documentation

## Quick Start

The most common commands you'll use:

```bash
help          # Show quick help overview
help --all    # Show all available aliases and functions
alias --help  # Show alias management help
dotfiles -h   # Show dotfiles management help
```

## Help System Commands

### Main Help Command: `help`

```bash
help                    # Quick overview of most used commands
help --all              # Show all aliases by category
help --system           # Show system aliases only
help --dev              # Show development aliases only
help --git              # Show git aliases only
help --fzf              # Show fuzzy finder aliases
help --drizzle          # Show database ORM aliases
help --help             # Show help usage
```

### Alias Management: `alias`

```bash
alias                   # Quick alias overview
alias --help            # Full alias help system
alias --list            # List all aliases by category
alias --search TERM     # Search for aliases containing TERM
alias --category dev    # Show specific category aliases
alias myalias='cmd'     # Create new alias (standard functionality)
```

### Dotfiles Management: `dotfiles`

```bash
dotfiles                # Navigate to dotfiles directory
dotfiles --help         # Show dotfiles help
```

### Emoji Picker: `emoji`

```bash
emoji                   # Browse all emojis with smart search
emoji --help            # Show emoji picker help
emoji --party           # Show party emojis
emoji --smile           # Show smile/happy emojis
emoji --sad             # Show sad emojis
emoji --flowers         # Show flower emojis
emoji --flags           # Show country flags
emoji --hearts          # Show heart emojis
emoji --food            # Show food & drink emojis
emoji --animals         # Show animal emojis
emoji --travel          # Show travel & places emojis
emoji --nature          # Show nature & weather emojis
emoji --objects         # Show objects emojis
emoji --symbols         # Show symbols emojis
emoji --sports          # Show sports emojis
emoji --hands           # Show hand gesture emojis
emoji --people          # Show people emojis
emoji --weather         # Show weather emojis
emoji --tech            # Show technology emojis
emoji --list-categories # List all available categories
```

### Configuration Reload: `reload`

```bash
reload                  # Reload fish configuration
reload --help           # Show reload help
```

## Alias Categories

### 🖥️ System & Navigation (`system.fish`)

| Alias      | Command               | Description                              |
|------------|-----------------------|------------------------------------------|
| `c`        | `clear`               | Clear terminal screen                    |
| `x`        | `exit`                | Exit terminal/shell                      |
| `.`        | `xdg-open .`          | Open current directory in file manager  |
| `reboot`   | `sudo reboot now`     | Reboot system                            |
| `poweroff` | `sudo poweroff`       | Power off system                         |
| `bios`     | `sudo systemctl...`   | Boot into BIOS/UEFI                      |
| `python`   | `python3`             | Use python3 as python                    |
| `py`       | `python3`             | Use python3 as py                        |
| `pip`      | `pip3`                | Use pip3 as pip                          |
| `reload`   | `exec fish`           | Reload fish configuration                |
| `dotfiles` | `cd ~/.config/...`    | Go to dotfiles directory                 |

### ⚡ Development (`dev.fish`)

| Alias      | Command           | Description                              |
|------------|-------------------|------------------------------------------|
| `v`        | `nvim`            | Open files with Neovim                  |
| `vi`       | `nvim`            | Open files with Neovim (vi alias)       |
| `vim`      | `nvim`            | Open files with Neovim (vim alias)      |
| `p`        | `pnpm`            | Run pnpm                                 |
| `pi`       | `pnpm install`    | Install dependencies with pnpm          |
| `rr`       | `pnpm run dev`    | Run development server with pnpm        |
| `bb`       | `pnpm run build`  | Build with pnpm                          |
| `r`        | `bun run dev`     | Run development server with Bun         |
| `i`        | `bun install`     | Install dependencies with Bun           |
| `b`        | `bun run build`   | Build the app with Bun                   |
| `unused`   | `unused-analyzer` | Advanced unused code analyzer             |
| `cleanimports` | `unused-analyzer --type typescript --path .` | Clean unused imports in current dir |
| `checkimports` | `unused-analyzer --type typescript --path . --dry-run` | Check unused imports (dry run) |

### 📝 Git Aliases (`git.fish`)

*(Add your git aliases here as you create them)*

### 🔍 FZF Aliases (`fzf.fish`)

*(Add your fzf aliases here as you create them)*

### 💧 Drizzle Aliases (`drizzle.fish`)

*(Add your drizzle aliases here as you create them)*

### 🧹 Code Cleanup (`unused-analyzer`)

| Alias         | Command                                     | Description                              |
|---------------|---------------------------------------------|------------------------------------------|
| `unused`      | `unused-analyzer`                           | Launch interactive unused code analyzer  |
| `cleanimports`| `unused-analyzer --type typescript --path .` | Clean unused imports in TypeScript files |
| `checkimports`| `unused-analyzer --type typescript --path . --dry-run` | Dry run check for unused imports |

## Advanced Usage

## Unused Code Analyzer

The `unused-analyzer` is a powerful tool for cleaning up your codebase by finding and removing:

- **Unused imports**: Detects imports that are declared but never used
- **Unused exports**: Finds exports that are never imported anywhere
- **Unused files**: Identifies files that are never imported or referenced

### Quick Start

```bash
# Interactive mode with menu
unused

# Clean unused imports in current directory
cleanimports

# Check for unused imports (dry run)
checkimports

# Advanced options
unused-analyzer --type javascript --path ./src --dry-run
```

### Features

- **Interactive Menu**: Choose what to analyze and how to handle results
- **Multiple File Types**: Supports TypeScript, JavaScript, and Python
- **Dry Run Mode**: Preview changes before making them
- **Backup System**: Automatic backups before making changes
- **Edge Case Detection**: Handles complex import patterns and edge cases
- **Individual Review**: Option to review each file individually
- **JSON Output**: Generate reports in JSON format for automation

### Safety Features

- **Backup Creation**: All modifications are backed up automatically
- **Dry Run Mode**: See what would be changed without making changes
- **Confirmation Prompts**: Always asks before making destructive changes
- **Revert Capability**: Can undo changes using backup system
- **Pattern Exclusion**: Skip files/directories using regex patterns

### Command Line Options

```bash
unused-analyzer [options]

--path DIR              Base directory to scan (default: current)
--type TYPE             File type: typescript, javascript, python, all
--exclude-file NAME     Exclude specific files (can repeat)
--exclude-dir DIR       Exclude directories (can repeat) 
--exclude-pattern REGEX Exclude using regex patterns (can repeat)
--dry-run              Report only, no changes
--non-interactive      Disable interactive mode
--json                 Output JSON report
--report FILE          Save report to JSON file
--version              Show version
--help                 Show help
```

### Examples

```bash
# Interactive analysis of TypeScript files
unused --type typescript

# Dry run on specific directory
unused-analyzer --path ./src --type javascript --dry-run

# Exclude test files and node_modules
unused-analyzer --exclude-dir tests --exclude-pattern ".*\.test\.*"

# Generate JSON report
unused-analyzer --json > unused-report.json

# Clean only imports, skip files in components dir
unused-analyzer --exclude-dir components --type typescript
```

---

### Creating New Aliases

1. **Choose the right category file**: Add aliases to the appropriate file in `~/.config/dotfiles/fish/aliases/`
2. **Use the DOCSTRING format**: Always add a comment with `# DOCSTRING: Description` before your alias
3. **Use consistent naming**: Follow existing patterns for alias names
4. **Reload configuration**: Run `reload` to apply changes

Example:
```bash
# In ~/.config/dotfiles/fish/aliases/dev.fish
# DOCSTRING: Run tests with coverage
alias test "npm test -- --coverage"
```

### Extending the Help System

The help system automatically parses DOCSTRING comments from alias files. To add new categories:

1. Create a new `.fish` file in `~/.config/dotfiles/fish/aliases/`
2. Add the category to the help system by updating the `categories` array in help functions
3. Use the DOCSTRING format for all aliases and functions

### File Structure

```
~/.config/dotfiles/fish/
├── aliases/
│   ├── init.fish         # Loads all alias files
│   ├── system.fish       # System and navigation aliases
│   ├── dev.fish          # Development aliases
│   ├── git.fish          # Git workflow aliases
│   ├── fzf.fish          # Fuzzy finder aliases
│   └── drizzle.fish      # Database ORM aliases
├── functions/
│   ├── help.fish         # Main help system
│   ├── alias.fish        # Alias management command
│   └── *.fish            # Other custom functions
├── core/
│   ├── init.fish         # Core initialization
│   ├── colors.fish       # Color definitions
│   └── env.fish          # Environment variables
└── config.fish           # Main configuration file
```

## Tips and Best Practices

1. **Use short, memorable aliases** for frequently used commands
2. **Group related aliases** in appropriate category files
3. **Always add DOCSTRING comments** for help system integration
4. **Test aliases before committing** by running `reload` and testing
5. **Use the help system** to discover existing aliases before creating new ones
6. **Search functionality** helps find existing aliases: `alias --search term`

## Troubleshooting

- **Alias not working?** Run `reload` to apply configuration changes
- **Help not showing?** Check that DOCSTRING comments are properly formatted
- **Function vs Alias?** Use functions for complex logic, aliases for simple command substitutions
- **Conflicts?** Use `type command_name` to see what's currently defined

## Examples

```bash
# Quick help
help

# Find all npm-related aliases
alias --search npm

# Show only development aliases
help --dev

# Create and test a new alias
echo "alias ll 'ls -la'" >> ~/.config/dotfiles/fish/aliases/system.fish
reload
ll

# Get help for any command
dotfiles --help
alias --help
reload --help

# Use the emoji picker
emoji                  # Browse all emojis
emoji --party          # Get party emojis
emoji --food           # Get food emojis
```
