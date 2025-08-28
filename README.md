# Remco Stoeten's dotfiles

**Version:** [0;36m0.1.8[0m <!-- AUTO-UPDATED by pre-commit hook -->

<i>Over-engineered? Maybe. Beauiful OS-experience</i>
A sophisticated dotfiles management system designed in a way to allow full customization. For most tools there are custom designed (cli) tools to help manage that particular module.

### Current features:
- 
- Secrerts managementInteractive CLI for handling encrypted secrets synced to a private GitHub Gist vault. Supports listing, prefix-based copying (e.g. DATABASE_URL=), open related link, and environment export for global shell access.
<details>
  <summary>View gif example </summary>
   todo
  ```
</details>

 There's a encrypted   with encrypted secrets sync, modern CLI tools, and cross-shell compatibility.




____________________________________________________________ OLD 
A sophisticated dotfiles management system with encrypted secrets sync, modern CLI tools, and cross-shell compatibility.

## ⚡ Quick Start (One Command Setup)

On a **new machine**, run this single command:

```bash
bash <(curl -s https://raw.githubusercontent.com/remcostoeten/dotfiles/main/init.sh)
```

Or clone first and run locally:

```bash
git clone https://github.com/remcostoeten/dotfiles.git ~/.config/dotfiles
cd ~/.config/dotfiles
./init.sh
```

This will automatically:
- 🔧 Install all dependencies (git, jq, curl, fzf, bat, eza, etc.)
- 🔐 Setup GitHub CLI and authenticate
- 📦 Install modern CLI tools
- 🔄 Configure secrets sync with GitHub gists
- ⚙️ Install shell configurations
- 🔑 Pull your encrypted secrets automatically

## 🎯 What You Get

### 🔑 **Secrets Management**
- **Encrypted storage** with AES-256-CBC
- **GitHub gist sync** - seamlessly sync secrets across machines  
- **Interactive selection** with fzf
- **Clipboard integration** - secrets copied automatically
- **Prefix support** - export as `MYAPI_KEY=value`

```bash
# Store secrets
dotfiles secrets set GITHUB_TOKEN "ghp_..." api --desc "GitHub API token"

# Get secrets (copies to clipboard)
dotfiles secrets get GITHUB_TOKEN

# Export all secrets to environment
eval "$(dotfiles secrets export)"

# Sync across machines
dotfiles sync push    # Upload encrypted secrets
dotfiles sync pull    # Download on new machine
```

### 🛠️ **Modern CLI Tools**
- **fzf** - Fuzzy finder for everything
- **bat** - Syntax-highlighted cat
- **eza** - Enhanced ls with icons
- **ripgrep** - Ultra-fast search
- **zoxide** - Smart directory jumping
- **starship** - Beautiful prompt

### 🔗 **Smart Symlink Management**
```bash
dotfiles link add ~/.vimrc ~/configs/vim/vimrc
dotfiles link list
dotfiles link fix    # Fix broken symlinks
```

### 📦 **Module System**
```bash
dotfiles modules list
dotfiles modules enable git-enhanced
dotfiles modules disable old-module
```

## 🔐 Secrets Sync Workflow

### Initial Setup (Main Machine)
```bash
# 1. Store your secrets
dotfiles secrets set OPENAI_API_KEY "sk-..." api
dotfiles secrets set DATABASE_URL "postgres://..." db

# 2. Setup sync (creates private GitHub gist)
dotfiles sync init

# 3. Push to sync
dotfiles sync push
```

### New Machine Setup
```bash
# 1. Run the init script (does everything automatically)
./init.sh

# 2. Secrets are automatically pulled and ready to use
eval "$(dotfiles secrets export)"
echo $OPENAI_API_KEY  # Works immediately!
```

## 🛡️ Security Features

- ✅ **AES-256-CBC encryption** - Military-grade security
- ✅ **100,000 PBKDF2 iterations** - Brute-force resistant  
- ✅ **Master password protected** - Only you can decrypt
- ✅ **Private GitHub gists** - Not publicly accessible
- ✅ **Git ignored** - Secrets never committed accidentally
- ✅ **Auto-backup** - Previous secrets backed up before sync

## 📚 Commands Reference

### Core Commands
```bash
dotfiles help              # Show all commands
dotfiles version           # System information
dotfiles doctor            # Health check
dotfiles reload            # Restart shell
```

### Secrets Management
```bash
dotfiles secrets list                                    # List all secrets
dotfiles secrets set KEY "value" type --desc "info"     # Store secret
dotfiles secrets get KEY                                 # Get (copies to clipboard)
dotfiles secrets get --prefix=MY KEY                    # Get as MY=value
dotfiles secrets remove KEY                             # Delete secret
dotfiles secrets search query                          # Search secrets
dotfiles secrets export                                # Export all as env vars
```

### Secrets Sync
```bash
dotfiles sync init         # Initialize sync system
dotfiles sync push         # Upload encrypted secrets  
dotfiles sync pull         # Download and decrypt
dotfiles sync status       # Show sync configuration
```

### Utilities
```bash
dotfiles link add <source> <target>    # Create managed symlink
dotfiles env set KEY "value"           # Persistent environment variables
dotfiles modules enable <module>       # Enable module
```

## 🔧 Configuration

### Auto-sync Secrets
Set `DOTFILES_AUTO_SYNC=1` in your environment to automatically sync secrets when modified.

### Custom Repository
Set `DOTFILES_REPO` environment variable before running init.sh:
```bash
export DOTFILES_REPO="https://github.com/yourusername/dotfiles"
./init.sh
```

## 🎨 Aesthetic Setup

The system includes a full aesthetic terminal setup:
- **Starship prompt** with git integration
- **ZSH with fish-like features** 
- **Syntax highlighting** for commands
- **Icons and colors** in file listings
- **Modern alternatives** to standard tools

## 🔄 Synchronization

Your dotfiles are stored in git (public), but secrets are stored in private encrypted gists:

- **Public repo**: Shell configs, aliases, scripts, themes
- **Private gists**: Encrypted secrets only (API keys, tokens, etc.)
- **Perfect security**: Public dotfiles, private secrets

## 🚨 Troubleshooting

### Setup Issues
```bash
# Check health
dotfiles doctor

# View logs
tail -f /tmp/dotfiles-init.log

# Retry secrets sync
dotfiles sync pull
```

### Missing Dependencies
The init script handles most dependencies automatically. For manual installation:

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y git jq curl fzf bat ripgrep fd-find

# macOS
brew install git jq curl fzf bat ripgrep fd eza zoxide
```

## 📁 Structure

```
~/.config/dotfiles/
├── init.sh              # Complete setup script
├── cfg                  # Main entry point (symlinked to shell rc)
├── bin/                 # All dotfiles commands
├── core/                # Core system (env, colors, safety)
├── modules/             # Modular functionality
├── utils/               # Configuration databases (JSON)
└── configs/             # Application configurations
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Test with `dotfiles doctor`
5. Submit pull request

## 📄 License

MIT License - Feel free to use and modify!

---

**Enjoy your personalized development environment! 🎉**
