# Dotfiles Manager - Tauri 2.0 Application

## 🎯 MVP Features

### ✅ Package Array Management
- View all package arrays from `setup.sh`
- Add new packages with semantic name and install command
- Remove packages from arrays
- Real-time updates to `setup.sh` file

### ✅ Aliases Viewer
- List all aliases from `configs/fish/aliases/`
- Click to view alias content
- Display file path for each alias

### ✅ File Viewer
- Browse dotfiles directory structure
- View file contents
- Open files in GitHub (web browser)
- Open files in system file manager

### ✅ Setup Manager
- Run `setup.sh` with full output
- Dry run mode (preview without executing)
- Run specific sections only
- Real-time output display with color coding
- Error checkpoint detection

## 🚀 Getting Started

```bash
cd dotfiles-manager
npm install
npm run tauri dev
```

## 📝 Notes

- The app automatically detects your dotfiles at `~/.config/dotfiles`
- Package arrays are parsed from `setup.sh` using regex
- File operations use Rust for safe file system access
- Setup output streaming is implemented (basic version - can be enhanced)

## 🔧 Future Enhancements

- [ ] Real-time output streaming with proper async handling
- [ ] Better error detection and highlighting
- [ ] Progress bars for setup operations
- [ ] Package search/filter functionality
- [ ] Syntax highlighting for file viewer
- [ ] Configurable dotfiles path

