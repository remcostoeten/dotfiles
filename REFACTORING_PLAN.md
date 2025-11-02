# Setup Script Refactoring Plan

## Current Situation

- ✅ **Original `setup.sh`**: 2,777 lines, fully functional, battle-tested
- ✅ **Backup**: `setup.sh.backup` (identical copy)
- ✅ **Modular files created**: 27 files in `setup/` directory
- ❌ **Problem**: Original script NOT using the modular files yet

## What We Have

### Created Modular Structure (35% complete)
```
setup/
├── core/              # 4 files - utilities extracted
├── packages/          # 19 files - package definitions extracted
├── installers/        # 1 file - basic installer logic
├── modules/           # Empty - needs menu, fish, fonts, gnome
├── loader.sh          # Module loader
├── README.md          # Documentation
└── TODO.md            # Remaining work
```

## Two Paths Forward

### Option A: Complete Bash Refactoring (Recommended First)
**Effort**: 2-3 hours  
**Benefit**: Clean, maintainable bash codebase

**Steps**:
1. Extract menu system from setup.sh → `setup/modules/menu.sh`
2. Extract argument parsing → `setup/core/args.sh`
3. Extract specialized installers → `setup/installers/specialized.sh`
4. Extract feature modules → `setup/modules/{fish,fonts,gnome}.sh`
5. Create NEW minimal `setup.sh` that sources everything
6. Test thoroughly
7. Delete `setup.sh.backup` once confirmed working

**Result**: Clean 100-200 line main script + modular components

### Option B: Build OpenTUI Version (After Option A)
**Effort**: 4-6 hours  
**Benefit**: Modern TypeScript TUI with better UX

**Steps**:
1. Create new directory: `setup-tui/`
2. Initialize with OpenTUI: `npm create opentui@latest`
3. Port logic from modular bash files to TypeScript
4. Keep bash version as fallback for minimal systems
5. Add to main setup.sh: "Run TypeScript version? (requires Node.js)"

**Result**: Two versions - bash (universal) + TypeScript (better UX)

## Recommendation

### Phase 1: Finish Bash (Now)
Complete the bash refactoring because:
- Already 35% done
- Original works, just needs organization
- No new dependencies
- 2-3 hours to finish

### Phase 2: OpenTUI Version (Next)
Build TypeScript version because:
- Better user experience
- Type safety
- Modern tooling
- Can reuse bash as fallback

## Decision Point

**What do you want to do?**

A. **Finish bash refactoring first** (2-3 hours, clean maintainable code)
B. **Start OpenTUI now** (abandon bash refactoring, 4-6 hours from scratch)
C. **Keep original as-is** (it works, use modular files for future additions only)

My recommendation: **Option A** - finish what we started, then do OpenTUI properly.
