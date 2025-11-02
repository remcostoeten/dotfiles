# Dotfiles Setup TUI

Interactive Terminal User Interface for installing and configuring dotfiles using OpenTUI and React.

## Features

- 🎨 Beautiful terminal UI with OpenTUI
- ⌨️  Keyboard navigation (arrow keys, vim keys)
- 📦 Package selection with categories
- 📊 Real-time installation progress
- ✅ Success/error tracking

## Prerequisites

- [Bun](https://bun.sh) - Fast JavaScript runtime
- [Zig](https://ziglang.org) - Required for building OpenTUI packages

## Installation

```bash
bun install
```

## Usage

```bash
# Run the setup TUI
bun run dev

# Or run directly
bun run src/index.tsx
```

## Keyboard Shortcuts

- **Arrow Keys / j/k**: Navigate menu options
- **Space**: Toggle package selection
- **Enter**: Confirm selection
- **ESC**: Go back
- **Ctrl+C**: Exit

## Project Structure

```
src/
├── index.tsx              # Entry point
├── App.tsx                # Main application component
├── components/
│   ├── MainMenu.tsx       # Main menu screen
│   ├── PackageSelection.tsx  # Package selection UI
│   └── InstallProgress.tsx   # Installation progress display
└── data/
    └── packages.ts        # Package definitions
```

## Components

### MainMenu
Interactive menu with options:
- Install Packages
- Quick Install (All)
- Dry Run
- Exit

### PackageSelection
Browse and select packages by category:
- Essential tools
- Programming languages
- Editors
- CLI utilities
- Development tools

### InstallProgress
Real-time installation progress with:
- Progress bar
- Package status indicators
- Success/error tracking

## Built With

- [OpenTUI](https://github.com/sst/opentui) - Terminal UI framework
- [React](https://react.dev) - UI library
- [Bun](https://bun.sh) - JavaScript runtime
- [TypeScript](https://www.typescriptlang.org) - Type safety

## Related

- [Bash Setup Script](../setup.sh) - Original bash version
- [Setup Modules](../setup/) - Modular bash components 
