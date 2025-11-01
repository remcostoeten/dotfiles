# Dotfiles Manager

A Tauri 2.0 application to manage your dotfiles setup.

## Features

- **Package Array Management**: Add/remove packages from setup.sh arrays
- **Aliases Viewer**: View all aliases and their file paths
- **File Viewer**: Browse dotfiles with GitHub and system file manager integration
- **Setup Manager**: Run setup.sh with dry-run mode and section-specific execution

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Requirements

- Node.js 18+
- Rust 1.70+
- System dependencies for Tauri (see https://tauri.app/v1/guides/getting-started/prerequisites)

