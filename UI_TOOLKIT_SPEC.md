# UI Toolkit - Feature Specification

**Version:** 3.0.0  
**Location:** `~/.config/dotfiles/bin/ui` & `~/.config/dotfiles/scripts/ui-toolkit.py`

---

## Overview

The UI Toolkit is an interactive developer utility for managing React/Next.js codebases. It provides two primary capabilities:

1. **UI Component Migration Tool** - Automates moving components and updating imports
2. **Code Analysis & Cleanup** - Detects unused code, duplicates, and dead imports

---

## Installation & Usage

### Basic Commands

```bash
# Interactive mode (recommended)
ui

# Direct access to sub-tools
ui transform <file|dir>     # Import transformer
ui toolkit [args...]        # Python toolkit
ui help                     # Show help
```

### Command Line Options

```bash
# Migration
ui --migrate                # Launch migration tool
ui --migrate --dry-run      # Preview changes
ui --migrate --kebab --barrel --cleanup  # Full migration

# Analysis
ui --analyze                # Launch code analyzer
ui --analyze --type typescript
ui --analyze --json > report.json
```

---

## Feature 1: UI Component Migration

### Problem Solved
When reorganizing React/Next.js component structures, developers must manually:
- Move component files to new directories
- Update all import paths across the codebase
- Convert filename conventions (e.g., PascalCase → kebab-case)
- Create barrel exports (`index.ts`)

### Solution
Automated component migration with intelligent import path updates throughout the entire project.

### Migration Options

| Option | Flag | Description |
|--------|------|-------------|
| **Source Path** | `--source-path` | Source directory (default: `src/components/ui`) |
| **Target Path** | `--target-path` | Target directory (default: `src/shared/components/ui`) |
| **Kebab Case** | `--kebab`, `-k` | Convert filenames to kebab-case |
| **Barrel File** | `--barrel`, `-b` | Create `index.ts` barrel file |
| **Shared Barrel** | `--barrel-shared`, `-bs` | Create barrel file for shared directory |
| **Cleanup** | `--cleanup` | Remove source directory after migration |
| **Dry Run** | `--dry-run`, `-d` | Preview changes without modifying files |

### Interactive Migration Modes

1. **Quick Migration** - Uses recommended settings (kebab-case, barrel, no cleanup)
2. **Custom Migration** - Step-by-step configuration
3. **Preview Mode** - Shows all changes without applying them

### Example Workflow

```bash
# Step 1: Preview migration
ui --migrate --dry-run

# Step 2: Apply migration with kebab-case and barrel file
ui --migrate --kebab --barrel

# Step 3: Custom paths
ui --migrate \
  --source-path "old/components" \
  --target-path "new/shared/ui" \
  --kebab --barrel --cleanup
```

### What Gets Updated

- ✅ Component file locations
- ✅ All import statements using `@/components/ui/*`
- ✅ Relative imports like `../../components/ui/*`
- ✅ Nested component imports
- ✅ Filename casing (if `--kebab` enabled)

---

## Feature 2: Import Transformer

**Location:** `bin/ui-import-transformer`

### Purpose
Converts individual UI component imports into consolidated barrel imports.

### Transformation Example

**Before:**
```tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
```

**After:**
```tsx
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
    Button,
    Card,
    CardContent,
} from "@/components/ui";
```

### Options

```bash
ui transform <file|directory> [options]

--dry-run       Show changes without modifying files
--recursive     Process all files in directory recursively
--backup        Create backup files before modification
```

### Features

- ✅ Preserves `"use client"` directives
- ✅ Alphabetically sorts imported components
- ✅ Handles TypeScript and JavaScript files (`.ts`, `.tsx`, `.js`, `.jsx`)
- ✅ Creates timestamped backups if requested

---

## Feature 3: Unused Code Analyzer

### Capabilities

#### 1. **Find Unused Files**
Detects files with exports that are never imported elsewhere in the codebase.

**Detection Logic:**
- Scans for files with exports
- Cross-references all import statements
- Marks files as unused if no imports found
- Excludes index files (`index.ts`, `index.tsx`, etc.)

#### 2. **Find Unused Imports**
Identifies imported symbols that are never used in the file.

**Detection Methods:**
- Named imports (`import { Foo } from "bar"`)
- Default imports (`import Foo from "bar"`)
- Namespace imports (`import * as Foo from "bar"`)
- Require statements (`const Foo = require("bar")`)

**Smart Detection:**
- ✅ Recognizes JSX usage (`<Component />`)
- ✅ Recognizes TypeScript type usage (`: Type`, `as Type`, `extends Type`)
- ✅ Ignores side-effect imports (`import "styles.css"`)
- ✅ Skips comments and multiline comments

#### 3. **Find Unused Exports**
Detects exported functions, classes, types that are never imported elsewhere.

**Tracked Export Types:**
- Default exports
- Named exports (`export { Foo }`)
- Function exports (`export function foo()`)
- Class exports (`export class Foo`)
- Type/Interface exports (`export type Foo`, `export interface IFoo`)

#### 4. **Find Duplicate Files**
Identifies files with identical content (ignoring whitespace and comments).

**Features:**
- Content-based hashing (MD5)
- Normalized comparison (ignores formatting)
- Import count tracking
- File metadata comparison (size, modification time, path depth)
- Interactive selection of which duplicate to keep
- Automatic import path updates after deletion

#### 5. **Find Unused Packages**
Scans `package.json` and detects packages never used in the codebase.

**Scans:**
- `dependencies`
- `devDependencies`

**Exclusions:**
Automatically excludes common infrastructure packages:
- Build tools: `vite`, `webpack`, `rollup`, `esbuild`, `turbo`
- Testing: `jest`, `vitest`, `mocha`, `testing-library`
- TypeScript: `typescript`, `@types/*`, `@typescript-eslint/*`
- Linters/Formatters: `eslint`, `prettier`
- Next.js core: `react`, `react-dom`, `next`
- Styling: `tailwindcss`, `postcss`, `autoprefixer`
- Drizzle ORM: `drizzle-orm`, `drizzle-kit`

**Removal:**
- Uses `bun remove` to uninstall packages
- Creates backup of `package.json` before modifications
- Interactive or batch removal options

#### 6. **Complete Analysis**
Runs all detection modes simultaneously and provides a combined report.

---

## Interactive Menus

### Main Menu
```
1. 🎨 UI Component Migration Tool
2. 🔍 Unused Code Analyzer
3. ❓ Help & Documentation
0. ❌ Exit
```

### Analyzer Menu
```
1. 📁 Find unused files
2. 📦 Find unused imports
3. 📤 Find unused exports
4. 🔍 Complete analysis (all of the above)
5. ⏪ Revert previous changes
6. ⚙️  Show configuration
7. 🔍 Find duplicate files
8. 🧙 Find unused imports (comprehensive)
9. 📦 Find and remove unused packages
0. ← Back to Main Menu
```

### Migration Menu
```
1. 🚀 Quick Migration (Recommended)
2. 🎯 Custom Migration (Choose Options)
3. 👀 Preview Changes (Dry Run)
4. 📚 Show Examples
5. ❓ Help & Documentation
0. ← Back to Main Menu
```

---

## Configuration

### Supported File Types

| Type | Extensions |
|------|------------|
| TypeScript | `.ts`, `.tsx` |
| JavaScript | `.js`, `.jsx`, `.mjs`, `.cjs` |
| Python | `.py` |

### Default Exclusions

**Directories:**
- `node_modules`
- `.git`
- `dist`, `build`, `.next`
- `.unused`, `.unused_backups`
- `coverage`, `__pycache__`
- `.pytest_cache`, `.venv`, `venv`

**Pattern-based exclusions:**
- Reads `.gitignore` and applies patterns automatically

### CLI Filters

```bash
ui --analyze \
  --path ./src \
  --type typescript \
  --exclude-dir tests \
  --exclude-file setup.ts
```

---

## Safety Features

### Automatic Backups

All destructive operations create timestamped backups:

| Operation | Backup Location |
|-----------|-----------------|
| Duplicate removal | `~/.config/dotfiles/ui/backup-duplicates/{timestamp}` |
| Import cleanup | `~/.config/dotfiles/unused-imports/{timestamp}` |
| Package removal | `~/.config/dotfiles/unused-packages/{timestamp}` |

### Dry Run Mode
Preview changes before applying them:
```bash
ui --migrate --dry-run
ui transform src/components --dry-run
```

### Interactive Confirmation
All batch operations require explicit user confirmation before executing.

---

## Output Formats

### Terminal (default)
Colorized, formatted output with progress indicators.

### JSON Export
```bash
ui --analyze --json > analysis-report.json
```

**JSON Structure:**
```json
{
  "unused_imports": [
    {
      "file": "src/components/UserCard.tsx",
      "import_name": "useState",
      "import_path": "react",
      "line_number": 3
    }
  ]
}
```

---

## Advanced Usage

### Comprehensive Import Analysis
Scans entire codebase for all unused imports with smart detection:

```bash
ui  # Select option 2 → option 8
```

**Features:**
- Respects `.gitignore` patterns
- Tracks progress with file counters
- Batch or selective removal
- Creates backups before modifications

### Duplicate File Management
Interactively review and merge duplicate files:

```bash
ui  # Select option 2 → option 7
```

**Selection Criteria Displayed:**
- File size
- Last modified date
- Directory depth
- Import count (usage frequency)

### Package Cleanup
Remove unused npm/yarn packages safely:

```bash
ui  # Select option 2 → option 9
```

**Process:**
1. Scans all code files for package usage
2. Cross-references with `package.json`
3. Presents unused packages with version info
4. Interactive or batch removal
5. Uses `bun remove` for uninstallation

---

## Use Cases

### Scenario 1: Reorganizing UI Components
```bash
# Preview the migration
ui --migrate --dry-run

# Apply with kebab-case filenames and barrel export
ui --migrate --kebab --barrel

# Transform all component imports to use the barrel
ui transform src --recursive
```

### Scenario 2: Codebase Cleanup
```bash
# Launch interactive analyzer
ui

# Select: 2 (Unused Code Analyzer)
# Select: 4 (Complete analysis)

# Review results, then selectively remove unused code
```

### Scenario 3: Pre-deployment Check
```bash
# Export analysis report
ui --analyze --json > pre-deploy-report.json

# Review in CI/CD pipeline or locally
cat pre-deploy-report.json | jq '.unused_imports | length'
```

---

## Technical Details

### File Analysis Algorithm
1. **Discovery Phase:** Recursively scan directory for eligible files
2. **Parsing Phase:** Extract imports, exports, and usage patterns using regex
3. **Cross-Reference Phase:** Build dependency graph
4. **Detection Phase:** Identify unused elements
5. **Report Phase:** Present findings with file/line metadata

### Import Update Strategy
When moving files:
1. Build list of all TypeScript/JavaScript files in project
2. For each file, parse import statements matching UI component patterns
3. Replace old paths with new paths, preserving relative/absolute format
4. If kebab-case enabled, transform component names in import paths
5. Write updated content back to files

### Duplicate Detection Algorithm
1. Read file content
2. Normalize (strip comments, collapse whitespace)
3. Compute MD5 hash of normalized content
4. Group files by hash
5. For each group, count incoming imports
6. Display metadata to help user choose canonical file

---

## Limitations

- **Language Support:** Currently supports TypeScript/JavaScript/Python only
- **Import Patterns:** Primarily designed for Next.js/React with path aliases (`@/`)
- **Export Detection:** May not catch dynamic exports (`export { ... } from computed`)
- **Package Detection:** Cannot detect packages used in non-standard ways (e.g., scripts, config files without imports)

---

## Error Handling

- **Missing files:** Graceful warnings, continues processing
- **Parse errors:** Skips problematic files, logs error
- **Permission errors:** Reports inaccessible files
- **Backup failures:** Aborts operation if backup cannot be created

---

## Future Enhancements (Not Yet Implemented)

- [ ] Revert mechanism for analyzer operations (option 5)
- [ ] Support for Vue/Svelte component imports
- [ ] Configurable import sorting strategies
- [ ] ESLint/Prettier integration
- [ ] Git integration (auto-commit with descriptive messages)
- [ ] Workspace/monorepo support

---

## Contributing

The UI Toolkit is composed of:
- **Bash wrapper:** `bin/ui`
- **Python core:** `scripts/ui-toolkit.py`
- **Import transformer:** `bin/ui-import-transformer` (Node.js)

When extending functionality:
1. Add new menu options in `show_analyzer_menu()` or `show_migration_menu()`
2. Implement feature logic as a new function
3. Wire up the function in the main menu handler
4. Update help text and documentation

---

## License & Credits

Part of the `dotfiles` configuration system. Free to use and modify.
