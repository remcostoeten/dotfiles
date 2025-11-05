# Scripts - Interactive Script Selector

An interactive CLI tool that lets you browse and execute any script from your dotfiles `bin/` directory using fzf or arrow key navigation.

## Usage

### Direct Commands
```bash
scripts              # Launch interactive selector
scripts --help       # Show help
scripts --list       # List all available scripts
```

### Via Dotfiles Command
```bash
dotfiles --scripts  # Same as scripts
dotfiles --s        # Same as scripts (short form)
```

## Features

- 🔍 **Interactive Selection** - Browse scripts with fzf or fallback arrow navigation
- 📋 **Script Preview** - See script content and information before executing
- 🏷️ **Type Detection** - Automatically detects wrapper scripts, symlinks, executables
- 🎨 **Colorized Output** - Beautiful, readable interface
- ⚡ **Smart Descriptions** - Extracts descriptions from script comments
- 🔄 **Fallback Navigation** - Works without fzf using arrow keys

## Script Types

| Type | Badge | Description |
|------|-------|-------------|
| **Executable** | `[exec]` | Direct executable script in bin/ |
| **Wrapper** | `[wrap]` | Wrapper that calls scripts/ directory |
| **Symlink** | `[link]` | Symbolic link to another script |
| **Script** | `[scrpt]` | Script file |

## Navigation

### With fzf (Preferred)
- **Arrow Keys** - Navigate up/down
- **Enter** - Select and execute script
- **Ctrl+C** - Cancel/quit
- **Preview** - Shows script content in right panel

### Fallback Mode (No fzf)
- **Arrow Keys** or **j/k** - Navigate up/down
- **Enter** - Select and execute script
- **q** or **Ctrl+C** - Quit

## Example Output

```
╔════════════════════════════════════════════════════════════════╗
║                    ★ Script Selector ★                      ║
╚════════════════════════════════════════════════════════════════╝

● Loading script selector...

[FZF Interface with script list and preview panel]

NAME                 TYPE     DESCRIPTION
──────────────────────────────────────────────────────────────────
click                [wrap]   Auto-clicker with interactive mode
postgres             [wrap]   PostgreSQL database management
emoji                [link]   Emoji picker and search
copy                 [link]   File and clipboard utility
...
```

## Script Description Detection

The tool automatically extracts descriptions by looking for:

1. **Comment patterns** in first 20 lines:
   - `# Description: ...`
   - `# Purpose: ...`
   - `# What: ...`
   - `# [Capitalized text]`

2. **Script purpose patterns**:
   - `# utility`, `# tool`, `# script`, `# manager`

3. **Fallback patterns** based on script names:
   - `*-manager` → "Management utility"
   - `postgres` → "PostgreSQL database management"
   - `click` → "Auto-clicker with interactive mode"
   - `env*` → "Environment management"

## Integration with Dotfiles Command

The `scripts` functionality is integrated into your existing dotfiles command:

```bash
# All these are equivalent:
scripts
dotfiles --scripts
dotfiles --s
```

This allows you to access the script selector through your main dotfiles interface.

## Dependencies

- **fzf** (preferred) - For rich interactive selection with preview
- **bash** - For script execution
- **Standard Unix tools** (find, head, cut, etc.)

If fzf is not available, the tool automatically falls back to arrow key navigation.

## File Structure

```
~/.config/dotfiles/
├── scripts/
│   └── scripts                # Main script logic
├── bin/
│   ├── scripts                # Wrapper executable
│   ├── click                  # Example script
│   ├── postgres               # Example script
│   └── ... (other scripts)
└── scripts/
    └── dotfiles               # Modified to support --scripts/--s flags
```

## Examples

### Quick Selection
```bash
$ scripts
# Opens fzf interface, select 'click', executes it
```

### List All Scripts
```bash
$ scripts --list
# Shows table of all available scripts with types and descriptions
```

### Via Dotfiles Command
```bash
$ dotfiles --s
# Same as running scripts directly
```

## Tips

1. **Add descriptions** to your scripts using comment headers for better discovery
2. **Use consistent naming** (e.g., `*-manager` for management tools)
3. **Test with --list** to see how your scripts appear
4. **Use fzf** for the best experience with preview panels

## Troubleshooting

### "No executable scripts found"
- Check that scripts in `bin/` are executable: `chmod +x bin/*`
- Verify `bin/` directory exists and contains scripts

### Scripts not showing descriptions
- Add comment headers to your scripts:
  ```bash
  #!/usr/bin/env bash
  # Description: What this script does
  # Purpose: Why it exists
  ```

### fzf not working
- Install fzf: `sudo apt install fzf`
- Tool will fallback to arrow navigation if fzf is missing

---

**Version:** 1.0.0
**Last Updated:** 2025-10-10