# Starship Visual Generator

A sophisticated visual editor for creating and customizing [Starship](https://starship.rs/) terminal prompts. Build beautiful terminal prompts with a drag-and-drop interface, real-time preview, and seamless integration with your dotfiles.

## ✨ Features

- **🎨 Visual Module Builder**: Drag-and-drop interface for arranging prompt modules
- **🔴 Live Preview**: Real-time terminal output preview with ANSI color rendering 
- **📝 Monaco Editor**: Full-featured TOML editor with syntax highlighting and auto-completion
- **🎨 Color Palettes**: Pre-built themes (Gruvbox Dark, Fire, Ice) with custom palette support
- **📁 Template System**: Load and save prompt configurations from dotfiles variants
- **🔄 Dotfiles Integration**: Seamless export/import with managed dotfiles system
- **⚡ Modern Stack**: React 19, TypeScript, Vite 7, Zustand state management

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- [Starship](https://starship.rs/#getting-started) binary in PATH
- ZSH shell (recommended for full compatibility)

### Installation

```bash
# Clone and install
git clone <repository-url>
cd starship-visual-generator
npm install

# Start development server
npm run dev
```

Open http://localhost:5173 in your browser.

### Quick Tour

1. **Module Library**: Browse available Starship modules on the left sidebar
2. **Canvas**: Drag modules to the center area and reorder them
3. **Live Preview**: See your prompt rendered in real-time on the right
4. **Edit TOML**: Click "Edit TOML" for direct TOML configuration editing
5. **Export/Apply**: Save your configuration or apply it to your system

## 🏗️ Architecture

### Core Components

```
src/
├── features/starship/
│   ├── components/
│   │   ├── ModuleLibrary.tsx      # Draggable module catalog
│   │   ├── ModuleCanvas.tsx       # Drop zone and module arrangement  
│   │   ├── TerminalPreview.tsx    # Live ANSI preview with server API
│   │   ├── TomlEditor.tsx         # Monaco editor with TOML highlighting
│   │   └── TemplatesModal.tsx     # Template loading/saving
│   ├── store/
│   │   └── index.ts               # Zustand state management
│   ├── lib/
│   │   └── toml-generator.ts      # TOML ↔ State conversion
│   └── types/
│       └── starship.ts            # TypeScript type definitions
└── shared/
    └── components/                # Reusable UI components
```

### State Management

Uses **Zustand** for clean, functional state management:

- **Prompt State**: Module configurations, palette, format string
- **UI State**: Selected modules, sidebar visibility, preview mode
- **Persistence**: Auto-saves to localStorage with versioning

### API Endpoints

Development server provides these APIs:

- `POST /api/preview` - Generate live terminal preview via Starship binary
- `GET /api/templates` - List available dotfiles variants 
- `GET /api/current-variant` - Get active Starship variant
- `POST /api/apply` - Write configuration to filesystem

## 🛠️ Development

### Project Structure

- **React 19**: Modern React with concurrent features
- **TypeScript**: Full type safety with strict mode
- **Vite 7**: Fast build tool with HMR
- **Tailwind CSS**: Utility-first styling 
- **Monaco Editor**: VS Code editor for TOML editing
- **@dnd-kit**: Accessible drag-and-drop

### Code Standards

- **No classes**: Functional components only
- **Named functions**: `function Component() {}` instead of arrow functions
- **Type prefixes**: All types prefixed with `T` (e.g., `TProps`)
- **No default exports**: Named exports only (except pages/views)

### Development Commands

```bash
# Development
npm run dev          # Start dev server with HMR
npm run build        # Production build 
npm run preview      # Preview production build
npm run lint         # ESLint check
```

### Testing

```bash
# Unit tests (when implemented)
npm run test

# API testing
curl -X POST -H "Content-Type: application/json" \
  -d '{"toml":"format = \"$directory$character\""}' \
  http://localhost:5173/api/preview
```

## 🔧 Configuration

### Environment Variables

```bash
# Optional: Custom starship binary path
STARSHIP_BIN=/usr/local/bin/starship
```

### Dotfiles Integration

The generator integrates with a dotfiles management system:

- **Config Location**: `~/.config/dotfiles/configs/starship.toml`
- **Variants**: `~/.config/dotfiles/starship-variants/`
- **Symlink Management**: Via `dotfiles-link` command

### Customizing Palettes

Add new color palettes in `src/features/starship/store/index.ts`:

```typescript
const customPalette: TColorPalette = {
  name: 'custom_theme',
  colors: {
    color_fg0: '#ffffff',
    color_bg1: '#000000',
    // ... other colors
  }
};
```

## 📚 API Reference

### Preview API

**POST** `/api/preview`

```json
{
  "toml": "format = \"$directory$character\"",
  "cwd": "/optional/working/directory"
}
```

**Response:**
```json
{
  "ok": true,
  "output": "\u001b[34m~/project\u001b[0m ❯ "
}
```

### Apply API

**POST** `/api/apply`

```json
{
  "toml": "format = \"$directory$character\"",
  "targetPath": "/home/user/.config/starship.toml",
  "backup": true
}
```

## 🐛 Troubleshooting

### Common Issues

**Preview not working:**
- Ensure Starship is installed: `which starship`
- Check development server is running on correct port
- Verify TOML syntax is valid

**Module drag-and-drop issues:**
- Clear browser cache and localStorage
- Check browser console for JavaScript errors

**Monaco editor not loading:**
- Ensure adequate memory (Monaco is large)
- Check network tab for failed module loads

**Server timeouts:**
- Starship may be slow on first run (downloading dependencies)
- Check system resources and starship configuration

### Debug Mode

Enable detailed logging:

```bash
# Browser console
localStorage.setItem('debug', 'starship:*')

# Check server logs
tail -f server.log
```

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Follow code standards (no classes, named functions, TypeScript)
4. Add tests for new functionality
5. Submit a pull request

### Adding New Modules

1. Add module definition to `defaultModules` in `store/index.ts`
2. Update type definitions in `types/starship.ts`
3. Add corresponding TOML generation logic in `lib/toml-generator.ts`

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Related Projects

- [Starship](https://starship.rs/) - The fast, customizable prompt for any shell
- [Dotfiles Management System](../../../) - Integrated dotfiles configuration
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - VS Code editor for web
