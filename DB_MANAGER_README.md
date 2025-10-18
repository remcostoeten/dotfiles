# Database Manager Tool

Unified database management toolkit for PostgreSQL, Turso, and Docker containers.

## Features

- 🐘 **PostgreSQL Manager** - Interactive PostgreSQL database management
- 🔍 **Database Analyzer** - AI-powered performance analysis
- 🚀 **Turso Generator** - Turso database environment configuration
- 🐳 **Docker Manager** - Container orchestration

## Installation

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

Or install individually:

```bash
pip install psycopg2-binary rich keyring cryptography pyperclip
```

### 2. Install CLI Tools

#### Turso CLI (required for Turso generator)

```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login
```

#### PostgreSQL Client (optional, for PostgreSQL manager)

```bash
sudo apt-get install postgresql-client  # Ubuntu/Debian
brew install postgresql                  # macOS
```

### 3. Configuration

Copy the environment template:

```bash
cp .env.example .env
```

Edit `.env` and configure your database connections.

#### Custom Dotfiles Location

If your dotfiles are not at `~/.config/dotfiles`, set the environment variable:

```bash
export DOTFILES_PATH=/path/to/your/dotfiles
```

Add to your Fish config (`~/.config/fish/config.fish`):

```fish
set -x DOTFILES_PATH /path/to/your/dotfiles
```

## Usage

### Interactive Mode

```bash
db
```

### Direct Commands

```bash
db postgres    # Launch PostgreSQL manager
db analyze     # Run database analyzer
db turso       # Generate Turso environment
db docker      # Open Docker manager
db --help      # Show help
```

## Recent Fixes

### ✅ Issue #1: Missing Dependency Checking
- Added automatic detection of missing Python packages
- Shows warnings with installation instructions
- Graceful fallback when optional dependencies are missing

### ✅ Issue #2: Hardcoded Path Assumptions
- Now supports `$DOTFILES_PATH` environment variable
- Falls back to `~/.config/dotfiles`
- Auto-detects from script location
- Clear error messages if not found

### ✅ Issue #3: Connection Testing
- Tests PostgreSQL adapter before launching postgres manager
- Checks Turso CLI authentication status
- Interactive prompt to continue if requirements missing
- Prevents waiting for timeouts on dead connections

### ✅ Issue #4: Turso CLI Detection
- Built-in check for Turso CLI availability
- Validates authentication status
- Provides installation instructions if missing

## Troubleshooting

### "Could not locate dotfiles directory"

Set the `DOTFILES_PATH` environment variable:

```bash
export DOTFILES_PATH=/your/actual/path
```

### "psycopg2 not installed"

Install the PostgreSQL adapter:

```bash
pip install psycopg2-binary
```

### "Turso CLI not authenticated"

Log in to Turso:

```bash
turso auth login
```

### Import errors in postgres script

The postgres script now automatically adds the scripts directory to Python path.
If issues persist, ensure `db_analyzer.py` exists in the same directory.

## Dependencies Status

The tool will show missing dependencies on startup:

```
⚠️  Optional Dependencies Missing:
  • Enhanced terminal UI
    Install: pip install rich
  • Turso CLI
    Install: curl -sSfL https://get.tur.so/install.sh | bash
```

Install missing dependencies as needed for the features you want to use.

## File Structure

```
~/.config/dotfiles/
├── bin/
│   ├── db                      # Main entry point
│   └── docker                  # Docker manager
├── scripts/
│   ├── postgres                # PostgreSQL manager
│   ├── db_analyzer.py          # Database analyzer
│   └── generate-turso-db.py    # Turso generator
├── requirements.txt            # Python dependencies
└── .env.example               # Configuration template
```
