# Setup Refactoring TODO

## ✅ Completed

- [x] Remove TypeScript setup directory
- [x] Create modular directory structure (core/, packages/, installers/, modules/)
- [x] Extract core utilities (colors, config, helpers, progress)
- [x] Split package definitions into separate files (19 files)
- [x] Extract common installer functions
- [x] Create module loader
- [x] Create documentation (README.md)
- [x] Backup original setup.sh

## 🚧 In Progress

- [ ] Extract remaining installer functions from setup.sh.backup
  - [ ] GitHub CLI installer
  - [ ] Lazy tools installer (lazygit, lazydocker)
  - [ ] Snap installer
  - [ ] OpenRGB installer
  - [ ] NVIDIA tools installer

- [ ] Extract feature modules
  - [ ] Fish shell setup module
  - [ ] Nerd Fonts installation module
  - [ ] GNOME aesthetics module
  - [ ] Config apps setup module

- [ ] Extract menu system
  - [ ] Main menu (show_main_menu)
  - [ ] Package selection menus
  - [ ] List packages function
  - [ ] Argument parsing

## 📝 Next Steps

1. **Complete installer extraction**: Move all specialized installers to `setup/installers/`
2. **Create feature modules**: Extract fish, fonts, gnome setup to `setup/modules/`
3. **Create menu module**: Extract TUI menu system to `setup/modules/menu.sh`
4. **Refactor main setup.sh**: Create new streamlined version that:
   - Sources `setup/loader.sh`
   - Parses arguments
   - Runs main installation flow
   - Keeps only orchestration logic
5. **Test thoroughly**: Ensure refactored version works identically to original
6. **Update documentation**: Add usage examples and migration guide

## 📊 Progress

- **Package definitions**: 100% (19/19 files)
- **Core utilities**: 100% (4/4 files)
- **Installer functions**: 20% (1/5 files)
- **Feature modules**: 0% (0/4 files)
- **Menu system**: 0% (0/1 file)
- **Main script refactor**: 0%

**Overall**: ~35% complete

## 🎯 Goal

Transform the 2,777-line monolithic `setup.sh` into a modular, maintainable system where:
- Each file has <200 lines
- Single responsibility per file
- Easy to understand, debug, and extend
- Fully backward compatible with original functionality
