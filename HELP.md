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

### Environment Manager: `env`

```bash
env                     # View all environment variables
env view                # View all environment variables
env add KEY VALUE       # Add or update a variable
env remove KEY          # Remove a variable
env edit                # Open env file in editor
```

**Features:**
- Private git submodule for secure syncing across machines
- Beautiful colored output
- Auto-loads on shell startup
- Supports both absolute and $HOME paths

**Your Environment Variables:**
- `FLYCTL_INSTALL` - Fly.io CLI path
- `TURSO_INSTALL` - Turso CLI path
- `DEV_DIR` - Development directory
- `PROJECTS_DIR` - Projects directory
- `NODE_ENV` - Default Node environment

### Secret Manager: `secret`

```bash
secret                 # Interactive menu
secret --add           # Add a new secret
secret -a              # Add a new secret (short)
secret --view          # View and copy secrets
secret -v              # View and copy secrets (short)
secret --edit          # Edit an existing secret
secret -e              # Edit an existing secret (short)
secret --delete        # Delete secret(s)
secret -d              # Delete secret(s) (short)
secret --help          # Show help
secret -h              # Show help (short)
```

**Features:**
- Store API keys, tokens, and other development secrets
- Interactive menu with arrow key navigation
- Copy secrets to clipboard in multiple formats
- Multi-select deletion with spacebar
- Auto-backup before changes (*.bak files)
- Plain JSON storage (no encryption needed for dev secrets)
- Private git repo for syncing across machines

**Secret Structure:**
- **Name**: Identifier for the secret (required)
- **Prefix**: Environment variable name like `API_KEY` (optional)
- **Value**: The actual secret value (required)

**Copy Formats:**
- **Environment variable**: `API_KEY=secret_value` (ready for .env files)
- **Value only**: Just the secret value

**Storage:**
- Location: `~/.config/dotfiles/secrets/secrets.json`
- Format: `{"secrets": [{"name": "...", "prefix": "...", "value": "..."}]}`
- Backups: Automatically created as `secrets.json.bak` before changes

**Usage Examples:**
```bash
# Interactive mode
secret

# Add a new API key
secret --add
# Name: github-token
# Prefix: GITHUB_TOKEN
# Value: ghp_xxxxxxxxxxxx

# View secrets and copy
secret --view
# Navigate with arrows, press Enter to select
# Choose: (1) Environment variable or (2) Value only

# Edit a secret
secret --edit
# Select secret, update any field

# Delete secrets
secret --delete
# Use spacebar to select multiple, Enter to confirm
```

**Syncing Secrets:**
```bash
# Initialize as git repo (first time)
cd ~/.config/dotfiles/secrets
git init
git add secrets.json
git commit -m "Initial secrets"
git remote add origin <your-private-repo>
git push -u origin main

# On another machine
cd ~/.config/dotfiles
git clone <your-private-repo> secrets
```

### Port Manager: `ports`

```bash
ports                   # Scan development ports (filters out browsers/editors)
ports --show-all        # Show ALL ports including system apps
ports 3000              # Kill process on specific port
ports 3000 8080         # Kill processes on multiple ports
ports 3000-3005         # Kill processes on port range
ports --all             # Kill all default dev ports without prompts
ports --dry-run         # Preview what would be killed
ports --force 3000      # Kill without confirmation
ports --watch           # Monitor ports continuously
ports --verbose         # Show detailed logging
ports history           # Show kill history
ports profiles          # List available port profiles
ports profile fullstack # Kill ports from a saved profile
ports --help            # Show full help
```

**Smart Filtering:**
- **Default**: Only shows development ports (Node, Vite, databases, etc.)
- **Filters out**: Brave, Chrome, Cursor, VSCode, Slack, Discord, etc.
- **Use `--show-all`** to see all ports including system apps

### NPM Package Wrapper Creator: `create-npm-wrapper`

```bash
create-npm-wrapper      # Interactive tool to create global npm wrappers
```

**What it does:**
- Creates a wrapper command for any npm package
- Auto-installs the package globally if missing
- Supports scoped packages (e.g., `@user/package`)
- Works with pnpm, bun, yarn, and npm
- Creates shortcuts for frequently used tools

**Example usage:**
```bash
create-npm-wrapper
# Package name: prettier
# Command name: format  (or leave empty to use 'prettier')

# Now you can run:
format --write .
```

**Existing wrappers:**
- `prettier` → runs `prettier`
- `hygienic` → runs `@remcostoeten/hygienic`

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

## Environment Variables Management

The environment manager keeps your personal configuration secure while syncing across machines using a private git submodule.

### Setup on New Machine

```bash
# Clone dotfiles with submodules
git clone --recurse-submodules https://github.com/YOUR_USERNAME/dotfiles.git ~/.config/dotfiles

# Or if already cloned
cd ~/.config/dotfiles
git submodule init
git submodule update

# Or use the setup helper
setup-env
```

### Managing Variables

```bash
# View all variables
env view

# Add a new variable
env add API_KEY "your-secret-key"

# Remove a variable
env remove API_KEY

# Edit directly in your editor
env edit
```

### Syncing Changes

```bash
# After modifying variables
cd ~/.config/dotfiles/env-private
git add env
git commit -m "Update environment variables"
git push

# Update the main dotfiles reference
cd ~/.config/dotfiles
git add env-private
git commit -m "Update env-private reference"
git push
```

## Port Management

The `ports` tool helps you manage development server ports with smart filtering.

### Common Workflows

```bash
# Quick scan (dev ports only)
ports

# Kill Next.js dev server (common ports)
ports 3000

# Kill all Vite instances
ports 5173-5183

# Check before killing
ports --dry-run

# See everything (including browsers)
ports --show-all

# Kill without confirmation
ports --force 3000 5173 8080
```

### Port Profiles

Save frequently used port combinations:

```bash
# Kill frontend ports
ports profile frontend

# Kill fullstack ports
ports profile fullstack

# Create custom profile
ports save-profile myproject
```

### Watch Mode

Monitor ports in real-time:

```bash
ports --watch
# Updates every 5 seconds, Ctrl+C to exit
```

## NPM Package Wrappers

Create command wrappers for npm packages that auto-install when missing.

### Creating Wrappers

```bash
create-npm-wrapper
# Package name (npm): eslint
# Command name (shortcut): lint

# Now use it:
lint --fix .
```

### Use Cases

- **Formatter shortcuts**: `prettier` → `format`
- **Linting**: `eslint` → `lint`
- **Build tools**: `vite` → `v`
- **Your packages**: `@username/tool` → `tool`

### How It Works

1. Creates a wrapper script in `scripts/`
2. Creates a bin command in `bin/`
3. Checks if package is installed globally
4. Auto-installs if missing using best available package manager
5. Runs the actual command with your arguments

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
