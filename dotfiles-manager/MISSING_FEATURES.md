# Missing Features & Improvements Needed

## 🔴 Critical Issues

### 1. **Package Manager Logic Error**
- ❌ Currently asks for "installCommand" but setup.sh arrays don't store install commands
- ❌ Arrays store format: `"package-name:Display Name"` not install commands
- ❌ Install logic is handled by `install_package()` function, not stored in arrays
- ✅ **Fix needed**: Remove installCommand field, use correct format

### 2. **Cannot Edit Existing Packages**
- ❌ Can only add/remove, cannot edit existing entries
- ✅ **Add**: Edit button for each package entry

### 3. **No Package Format Validation**
- ❌ No validation that format is correct (package:Display Name)
- ✅ **Add**: Format validation before adding

## 🟡 Important Missing Features

### 4. **Fish Functions Management**
- ❌ Only aliases viewer, no functions management
- ✅ **Add**: Functions viewer/editor (similar to aliases)

### 5. **Scripts/Bin Management**
- ❌ No way to manage scripts in `scripts/` or `bin/`
- ✅ **Add**: View, edit, create scripts

### 6. **Git Integration**
- ❌ No git status, commit, push functionality
- ✅ **Add**: Git operations panel

### 7. **Environment Variables Management**
- ❌ No way to manage `env-private` submodule
- ✅ **Add**: Environment variable viewer/editor

### 8. **Config File Management**
- ❌ No way to edit `.dotfiles-cli.json`
- ✅ **Add**: Config editor

### 9. **Package Installation Status**
- ❌ Can't see which packages are already installed
- ✅ **Add**: Check installation status indicator

### 10. **Setup.sh Syntax Validation**
- ❌ No validation before running setup.sh
- ✅ **Add**: Syntax check button

## 🟢 Nice-to-Have Features

### 11. **Search/Filter**
- Search packages across all arrays
- Filter output by type
- Search aliases/functions

### 12. **Duplicate Detection**
- Warn when adding duplicate packages

### 13. **Export/Import**
- Export package arrays to JSON
- Import configurations

### 14. **Statistics Dashboard**
- Show setup statistics
- Package installation success rates
- Most used packages

### 15. **Theme/Appearance**
- Dark/light theme toggle
- Syntax highlighting in file viewer

## 🎯 Priority Fixes

1. **Fix Package Manager** - Remove installCommand, use correct format
2. **Add Edit Functionality** - Edit existing packages
3. **Add Fish Functions Viewer** - Complete the config management
4. **Add Git Integration** - Commit/push from app
5. **Add Setup Validation** - Check syntax before running

