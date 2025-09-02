# Remco Stoeten's dotfiles



<i>Over-engineered? Maybe. Beauiful OS-experience</i>
A sophisticated dotfiles management system designed in a way to allow full customization. For most tools there are custom designed (cli) tools to help manage that particular module.

### Current features:
- 
- A sophisticated dotfiles management system with modern CLI tools, and cross-shell compatibility.




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
- ⚙️ Install shell configurations

## 🎯 What You Get

### 🛠️ **Modern CLI Tools**
- **fzf** - Fuzzy finder for everything
- **bat** - Syntax-highlighted cat
- **eza** - Enhanced ls with icons
- **ripgrep** - Ultra-fast search
- **zoxide** - Smart directory jumping


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

## 📚 Commands Reference

### Core Commands
```bash
dotfiles help              # Show all commands
dotfiles version           # System information
dotfiles doctor            # Health check
dotfiles reload            # Restart shell
```

### Utilities
```bash
dotfiles link add <source> <target>    # Create managed symlink
dotfiles env set KEY "value"           # Persistent environment variables
dotfiles modules enable <module>       # Enable module
```

## 🔧 Configuration

### Custom Repository
Set `DOTFILES_REPO` environment variable before running init.sh:
```bash
export DOTFILES_REPO="https://github.com/yourusername/dotfiles"
./init.sh
```

## 🎨 Aesthetic Setup

The system includes a full aesthetic terminal setup:

- **ZSH with fish-like features** 
- **Syntax highlighting** for commands
- **Icons and colors** in file listings
- **Modern alternatives** to standard tools

## 🚨 Troubleshooting

### Setup Issues
```bash
# Check health
dotfiles doctor

# View logs
tail -f /tmp/dotfiles-init.log
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
