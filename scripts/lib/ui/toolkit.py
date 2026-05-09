#!/usr/bin/env python3

import os
import re
import shutil
import argparse
import json
import sys
import time
import ast
import hashlib
from pathlib import Path
from typing import List, Dict, Set, Tuple, Optional, NamedTuple
from dataclasses import dataclass
from collections import defaultdict
from datetime import datetime

VERSION = "3.0.0"

DEFAULT_EXCLUDE_DIRS = {
    "dist", "build", "tmp", ".next", "node_modules", ".git", 
    ".unused", ".unused_backups", "coverage", "__pycache__",
    ".pytest_cache", ".venv", "env", "venv"
}

EXCLUDED_PACKAGE_PATTERNS = [
    r'^@types/',
    r'^@typescript-eslint/',
    r'^eslint',
    r'^prettier',
]

EXCLUDED_PACKAGES = {
    'react', 'react-dom', 'next', 'nextjs',
    'typescript', 'tsconfig',
    'vite', 'vitest', 'webpack', 'rollup', 'esbuild', 'turbo', 'turborepo',
    'jest', 'mocha', 'chai', 'testing-library',
    'tailwindcss', 'postcss', 'autoprefixer',
    'babel', '@babel/core', '@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript',
    'dotenv', 'cross-env',
    'nodemon', 'concurrently', 'npm-run-all',
    'husky', 'lint-staged', 'commitlint',
    'drizzle-orm', 'drizzle-kit',
}

BACKUP_DIR = ".unused_backups"
QUARANTINE_DIR = ".unused"

SUPPORTED_EXTENSIONS = {
    'typescript': ['ts', 'tsx'],
    'javascript': ['js', 'jsx', 'mjs', 'cjs'],
    'python': ['py'],
    'all': ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py']
}

@dataclass
class ImportInfo:
    source_file: Path
    imported_name: str
    import_path: str
    import_type: str
    line_number: int

@dataclass
class ExportInfo:
    source_file: Path
    exported_name: str
    export_type: str
    line_number: int

@dataclass
class UnusedImport:
    file_path: Path
    import_name: str
    import_path: str
    line_number: int
    import_type: str

@dataclass
class DuplicateFileInfo:
    file_path: Path
    content_hash: str
    size: int
    mtime: float
    import_count: int = 0

@dataclass
class UnusedPackage:
    name: str
    version: str
    is_dev: bool
    found_in_files: List[str] = None
    
    def __post_init__(self):
        if self.found_in_files is None:
            self.found_in_files = []

class Colors:
    RESET = '\033[0m'
    BRIGHT = '\033[1m'
    DIM = '\033[2m'
    RED = '\033[31m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    BLUE = '\033[34m'
    MAGENTA = '\033[35m'
    CYAN = '\033[36m'
    WHITE = '\033[37m'
    BG_RED = '\033[41m'
    BG_GREEN = '\033[42m'
    BG_YELLOW = '\033[43m'
    BG_BLUE = '\033[44m'
    BG_MAGENTA = '\033[45m'
    BG_CYAN = '\033[46m'
    
    HEADER = MAGENTA
    OKBLUE = BLUE
    OKCYAN = CYAN
    OKGREEN = GREEN
    WARNING = YELLOW
    FAIL = RED
    ENDC = RESET
    BOLD = BRIGHT
    UNDERLINE = '\033[4m'

def normalize_content(content: str) -> str:
    lines = []
    for line in content.split('\n'):
        stripped = line.strip()
        if stripped and not stripped.startswith('//'):
            lines.append(stripped)
    return '\n'.join(lines)

def parse_gitignore(base_path: Path) -> Set[str]:
    gitignore_path = base_path / '.gitignore'
    exclude_patterns = set()
    
    if not gitignore_path.exists():
        return exclude_patterns
    
    try:
        with open(gitignore_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    pattern = line.rstrip('/')
                    if pattern.startswith('**'):
                        pattern = pattern[2:].lstrip('/')
                    if pattern.startswith('*'):
                        pattern = pattern[1:]
                    if pattern:
                        exclude_patterns.add(pattern)
    except Exception:
        pass
    
    return exclude_patterns

def compute_content_hash(file_path: Path) -> Optional[str]:
    try:
        content = file_path.read_text(encoding='utf-8')
        normalized = normalize_content(content)
        return hashlib.md5(normalized.encode('utf-8')).hexdigest()
    except Exception:
        return None

def clear_screen():
    os.system('clear' if os.name != 'nt' else 'cls')

def print_main_banner():
    print(f"{Colors.CYAN}{Colors.BRIGHT}")
    print('╔════════════════════════════════════════════════════════════════════════════════╗')
    print('║                                                                                ║')
    print('║       ██████╗ ███████╗██╗   ██╗    ████████╗ ██████╗  ██████╗ ██╗     ██╗  ██╗ ║')
    print('║       ██╔══██╗██╔════╝██║   ██║    ╚══██╔══╝██╔═══██╗██╔═══██╗██║     ██║ ██╔╝ ║')
    print('║       ██║  ██║█████╗  ██║   ██║       ██║   ██║   ██║██║   ██║██║     █████╔╝  ║')
    print('║       ██║  ██║██╔══╝  ╚██╗ ██╔╝       ██║   ██║   ██║██║   ██║██║     ██╔═██╗  ║')
    print('║       ██████╔╝███████╗ ╚████╔╝        ██║   ╚██████╔╝╚██████╔╝███████╗██║  ██╗ ║')
    print('║       ╚═════╝ ╚══════╝  ╚═══╝         ╚═╝    ╚═════╝  ╚═════╝ ╚══════╝╚═╝  ╚═╝ ║')
    print('║                                                                                ║')
    print('║               Interactive Developer Toolkit v3.0                              ║')
    print('║          🎨 Component Migration  •  🔍 Code Analysis & Cleanup                ║')
    print('║                                                                                ║')
    print('╚════════════════════════════════════════════════════════════════════════════════╝')
    print(f"{Colors.RESET}\n")

def show_main_menu():
    clear_screen()
    print_main_banner()
    print(f"{Colors.CYAN}{Colors.BOLD}MAIN MENU{Colors.RESET}")
    print("=" * 70)
    print()
    print("Select a tool:")
    print(f"  {Colors.GREEN}1.{Colors.RESET} 🎨 UI Component Migration Tool")
    print(f"  {Colors.GREEN}2.{Colors.RESET} 🔍 Unused Code Analyzer")
    print(f"  {Colors.GREEN}3.{Colors.RESET} ❓ Help & Documentation")
    print(f"  {Colors.RED}0.{Colors.RESET} ❌ Exit")
    print()

def show_migration_menu():
    clear_screen()
    print_main_banner()
    print(f"{Colors.CYAN}{Colors.BOLD}UI COMPONENT MIGRATION{Colors.RESET}")
    print("=" * 70)
    print()
    print(f"{Colors.YELLOW}{Colors.BRIGHT}THE PROBLEM:{Colors.RESET}")
    print(f"{Colors.DIM}Moving UI components requires manually updating import statements across your codebase.{Colors.RESET}\n")
    
    print(f"{Colors.GREEN}{Colors.BRIGHT}THE SOLUTION:{Colors.RESET}")
    print(f"{Colors.DIM}Automates component migration AND import updates throughout your project.{Colors.RESET}\n")
    
    print("Select an option:")
    print(f"  {Colors.GREEN}1.{Colors.RESET} 🚀 Quick Migration (Recommended)")
    print(f"  {Colors.GREEN}2.{Colors.RESET} 🎯 Custom Migration (Choose Options)")
    print(f"  {Colors.GREEN}3.{Colors.RESET} 👀 Preview Changes (Dry Run)")
    print(f"  {Colors.GREEN}4.{Colors.RESET} 📚 Show Examples")
    print(f"  {Colors.GREEN}5.{Colors.RESET} ❓ Help & Documentation")
    print(f"  {Colors.RED}0.{Colors.RESET} ← Back to Main Menu")
    print()

def show_analyzer_menu():
    clear_screen()
    print_main_banner()
    print(f"{Colors.CYAN}{Colors.BOLD}UNUSED CODE ANALYZER{Colors.RESET}")
    print("=" * 70)
    print()
    print("Select analysis type:")
    print(f"  {Colors.GREEN}1.{Colors.RESET} 📁 Find unused files")
    print(f"  {Colors.GREEN}2.{Colors.RESET} 📦 Find unused imports")
    print(f"  {Colors.GREEN}3.{Colors.RESET} 📤 Find unused exports")
    print(f"  {Colors.GREEN}4.{Colors.RESET} 🔍 Complete analysis (all of the above)")
    print(f"  {Colors.GREEN}5.{Colors.RESET} ⏪ Revert previous changes")
    print(f"  {Colors.GREEN}6.{Colors.RESET} ⚙️  Show configuration")
    print(f"  {Colors.GREEN}7.{Colors.RESET} 🔍 Find duplicate files")
    print(f"  {Colors.GREEN}8.{Colors.RESET} 🧙 Find unused imports (comprehensive)")
    print(f"  {Colors.GREEN}9.{Colors.RESET} 📦 Find and remove unused packages")
    print(f"  {Colors.RED}0.{Colors.RESET} ← Back to Main Menu")
    print()

def print_migration_help():
    clear_screen()
    print_main_banner()
    print(f"{Colors.BRIGHT}{Colors.WHITE}UI MIGRATION - DETAILED HELP{Colors.RESET}\n")
    
    print(f"{Colors.CYAN}{Colors.BRIGHT}WHAT IS THIS TOOL?{Colors.RESET}")
    print("─" * 70)
    print(f"{Colors.DIM}Solves the pain of reorganizing React/Next.js component structures.{Colors.RESET}")
    print(f"{Colors.DIM}Automatically moves files and updates all import statements.{Colors.RESET}\n")
    
    print(f"{Colors.CYAN}{Colors.BRIGHT}CORE OPTIONS{Colors.RESET}")
    print("─" * 70)
    print(f"{Colors.GREEN}  --migrate, -m{Colors.RESET}       Launch UI migration tool")
    print(f"{Colors.GREEN}  --dry-run, -d{Colors.RESET}       Preview changes without modifications")
    print(f"{Colors.GREEN}  --source-path{Colors.RESET}       Source directory (default: src/components/ui)")
    print(f"{Colors.GREEN}  --target-path{Colors.RESET}       Target directory (default: src/shared/components/ui)")
    print(f"{Colors.GREEN}  --kebab, -k{Colors.RESET}         Convert filenames to kebab-case")
    print(f"{Colors.GREEN}  --barrel, -b{Colors.RESET}        Create index.ts barrel file")
    print(f"{Colors.GREEN}  --cleanup{Colors.RESET}           Remove source directory after migration\n")
    
    print(f"{Colors.YELLOW}{Colors.BRIGHT}EXAMPLES{Colors.RESET}")
    print("─" * 70)
    print(f"{Colors.MAGENTA}1. Preview changes:{Colors.RESET}")
    print(f"   {Colors.DIM}ui --migrate --dry-run{Colors.RESET}\n")
    
    print(f"{Colors.MAGENTA}2. Full migration:{Colors.RESET}")
    print(f"   {Colors.DIM}ui --migrate --kebab --barrel --cleanup{Colors.RESET}\n")
    
    print(f"{Colors.MAGENTA}3. Custom paths:{Colors.RESET}")
    print(f"   {Colors.DIM}ui --migrate --source-path 'old/ui' --target-path 'new/components'{Colors.RESET}\n")
    
    input(f"\n{Colors.DIM}Press Enter to continue...{Colors.RESET}")

def print_analyzer_help():
    clear_screen()
    print_main_banner()
    print(f"{Colors.BRIGHT}{Colors.WHITE}CODE ANALYZER - DETAILED HELP{Colors.RESET}\n")
    
    print(f"{Colors.CYAN}{Colors.BRIGHT}WHAT IS THIS TOOL?{Colors.RESET}")
    print("─" * 70)
    print(f"{Colors.DIM}Analyzes your codebase to find unused files, imports, and exports.{Colors.RESET}")
    print(f"{Colors.DIM}Helps clean up dead code and improve project maintainability.{Colors.RESET}\n")
    
    print(f"{Colors.CYAN}{Colors.BRIGHT}CORE OPTIONS{Colors.RESET}")
    print("─" * 70)
    print(f"{Colors.GREEN}  --analyze, -a{Colors.RESET}       Launch code analyzer")
    print(f"{Colors.GREEN}  --path{Colors.RESET}              Base directory to scan (default: current)")
    print(f"{Colors.GREEN}  --type{Colors.RESET}              File type: typescript, javascript, python, all")
    print(f"{Colors.GREEN}  --exclude-dir{Colors.RESET}       Exclude directory names")
    print(f"{Colors.GREEN}  --exclude-file{Colors.RESET}      Exclude specific file names")
    print(f"{Colors.GREEN}  --json{Colors.RESET}              Output JSON report")
    print(f"{Colors.GREEN}  --non-interactive{Colors.RESET}   Disable interactive mode\n")
    
    print(f"{Colors.YELLOW}{Colors.BRIGHT}EXAMPLES{Colors.RESET}")
    print("─" * 70)
    print(f"{Colors.MAGENTA}1. Analyze current project:{Colors.RESET}")
    print(f"   {Colors.DIM}ui --analyze{Colors.RESET}\n")
    
    print(f"{Colors.MAGENTA}2. TypeScript files only:{Colors.RESET}")
    print(f"   {Colors.DIM}ui --analyze --type typescript{Colors.RESET}\n")
    
    print(f"{Colors.MAGENTA}3. Export JSON report:{Colors.RESET}")
    print(f"   {Colors.DIM}ui --analyze --json > report.json{Colors.RESET}\n")
    
    input(f"\n{Colors.DIM}Press Enter to continue...{Colors.RESET}")

def to_kebab_case(filename: str) -> str:
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1-\2', filename)
    return re.sub('([a-z0-9])([A-Z])', r'\1-\2', s1).lower()

def find_all_files(directory: str, extensions: Set[str]) -> List[Path]:
    files = []
    for root, _, filenames in os.walk(directory):
        for filename in filenames:
            if any(filename.endswith(ext) for ext in extensions):
                files.append(Path(root) / filename)
    return files

def extract_imports(file_path: Path) -> List[Tuple[str, int]]:
    imports = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        for line_num, line in enumerate(lines, 1):
            line = line.strip()
            if line.startswith('import ') and ('components/ui' in line or '/ui' in line):
                imports.append((line, line_num))
    except Exception as e:
        print(f"{Colors.FAIL}Error reading {file_path}: {e}{Colors.ENDC}")
    
    return imports

def update_import_line(import_line: str, old_path: str, new_path: str, kebab_case: bool = False) -> str:
    patterns = [
        r'from ["\']@/components/ui([^"\']*)["\']',
        r'from ["\']\.\.?/?\.\.?/?\.\.?/?\.\.?/?components/ui([^"\']*)["\']',
        r'from ["\']\.\.?/?\.\.?/?\.\.?/?ui([^"\']*)["\']',
        r'from ["\']\.\.?/?\.\.?/?ui([^"\']*)["\']',
        r'from ["\']\.\.?/?ui([^"\']*)["\']',
        r'from ["\']\./?ui([^"\']*)["\']',
    ]
    
    updated_line = import_line
    
    for pattern in patterns:
        match = re.search(pattern, import_line)
        if match:
            suffix = match.group(1)
            
            if kebab_case and suffix:
                parts = suffix.strip('/').split('/')
                if parts and parts[-1]:
                    parts[-1] = to_kebab_case(parts[-1])
                    suffix = '/' + '/'.join(parts) if parts[0] else ''
            
            new_import_path = f"@/{new_path.replace('src/', '')}{suffix}"
            updated_line = re.sub(pattern, f'from "{new_import_path}"', import_line)
            break
    
    return updated_line

def move_files(source_dir: str, target_dir: str, kebab_case: bool = False, dry_run: bool = False) -> Dict[str, str]:
    moved_files = {}
    
    if not os.path.exists(source_dir):
        print(f"{Colors.FAIL}Source directory {source_dir} not found{Colors.ENDC}")
        return moved_files
    
    if not dry_run:
        os.makedirs(target_dir, exist_ok=True)
    
    for item in os.listdir(source_dir):
        source_path = os.path.join(source_dir, item)
        
        target_name = to_kebab_case(item) if kebab_case else item
        target_path = os.path.join(target_dir, target_name)
        
        if dry_run:
            print(f"{Colors.OKCYAN}Would move: {source_path} -> {target_path}{Colors.ENDC}")
        else:
            try:
                shutil.move(source_path, target_path)
                print(f"{Colors.OKGREEN}Moved: {source_path} -> {target_path}{Colors.ENDC}")
            except Exception as e:
                print(f"{Colors.FAIL}Error moving {source_path}: {e}{Colors.ENDC}")
                continue
        
        moved_files[item] = target_name
    
    return moved_files

def cleanup_directory(directory: str, dry_run: bool = False):
    if not os.path.exists(directory):
        print(f"{Colors.WARNING}Directory not found, skipping cleanup: {directory}{Colors.ENDC}")
        return

    if dry_run:
        print(f"{Colors.OKCYAN}Would remove directory: {directory}{Colors.ENDC}")
    else:
        try:
            shutil.rmtree(directory)
            print(f"{Colors.OKGREEN}Removed directory: {directory}{Colors.ENDC}")
        except Exception as e:
            print(f"{Colors.FAIL}Error removing directory {directory}: {e}{Colors.ENDC}")

def create_barrel_file(target_dir: str, dry_run: bool = False, barrel_for_shared: bool = False):
    if barrel_for_shared:
        target_dir = 'src/shared/components/ui'

    if dry_run:
        print(f"{Colors.OKCYAN}Would create barrel file: {target_dir}/index.ts{Colors.ENDC}")
        return
    
    index_path = os.path.join(target_dir, 'index.ts')
    exports = []
    
    for item in sorted(os.listdir(target_dir)):
        if item.endswith(('.ts', '.tsx')) and item != 'index.ts':
            filename_without_ext = os.path.splitext(item)[0]
            exports.append(f"export * from './{filename_without_ext}'")
    
    try:
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(exports) + '\n')
        print(f"{Colors.OKGREEN}Created barrel file: {index_path}{Colors.ENDC}")
    except Exception as e:
        print(f"{Colors.FAIL}Error creating barrel file: {e}{Colors.ENDC}")

def update_imports_in_files(project_files: List[Path], old_path: str, new_path: str, kebab_case: bool = False, dry_run: bool = False):
    total_files = len(project_files)
    total_imports = 0
    updated_files = 0
    
    print(f"\n{Colors.OKBLUE}Scanning {total_files} files for import updates...{Colors.ENDC}")
    
    for i, file_path in enumerate(project_files):
        imports = extract_imports(file_path)
        if not imports:
            continue
        
        print(f"{Colors.OKCYAN}[{i+1}/{total_files}] {file_path}: {len(imports)} imports found{Colors.ENDC}")
        
        if dry_run:
            for import_line, line_num in imports:
                updated_line = update_import_line(import_line, old_path, new_path, kebab_case)
                if updated_line != import_line:
                    print(f"  {Colors.WARNING}Line {line_num}: {import_line.strip()}{Colors.ENDC}")
                    print(f"  {Colors.OKGREEN}Would become: {updated_line.strip()}{Colors.ENDC}")
            total_imports += len(imports)
            continue
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            updated_content = content
            file_changed = False
            
            for import_line, line_num in imports:
                updated_line = update_import_line(import_line, old_path, new_path, kebab_case)
                if updated_line != import_line:
                    updated_content = updated_content.replace(import_line, updated_line)
                    file_changed = True
                    print(f"  {Colors.WARNING}Line {line_num}: {import_line.strip()}{Colors.ENDC}")
                    print(f"  {Colors.OKGREEN}Updated to: {updated_line.strip()}{Colors.ENDC}")
            
            if file_changed:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(updated_content)
                updated_files += 1
            
            total_imports += len(imports)
            
        except Exception as e:
            print(f"{Colors.FAIL}Error updating {file_path}: {e}{Colors.ENDC}")
    
    print(f"\n{Colors.OKGREEN}Summary: {total_imports} imports found in {total_files} files{Colors.ENDC}")
    if not dry_run:
        print(f"{Colors.OKGREEN}{updated_files} files updated{Colors.ENDC}")

def run_migration(source_path: str, target_path: str, kebab: bool, barrel: bool, barrel_shared: bool, cleanup: bool, dry_run: bool):
    clear_screen()
    print_main_banner()
    
    migration_type = "PREVIEW MODE" if dry_run else "MIGRATION IN PROGRESS"
    print(f"{Colors.BRIGHT}{Colors.WHITE}{migration_type}{Colors.RESET}\n")
    
    if dry_run:
        print(f"{Colors.YELLOW}Running in dry-run mode - no files will be modified{Colors.RESET}\n")
    
    print(f"{Colors.CYAN}Step 1: Scanning project files...{Colors.RESET}")
    project_files = find_all_files('.', {'.ts', '.tsx', '.js', '.jsx'})
    excluded_files = [f for f in project_files if 'node_modules' not in str(f)]
    print(f"{Colors.GREEN}✓{Colors.RESET} Found {len(excluded_files)} files to scan\n")
    
    print(f"{Colors.CYAN}Step 2: Moving files...{Colors.RESET}")
    moved_files = move_files(source_path, target_path, kebab, dry_run)
    
    if moved_files:
        print(f"{Colors.GREEN}✓{Colors.RESET} {'Would move' if dry_run else 'Moved'} {len(moved_files)} files\n")
    else:
        print(f"{Colors.YELLOW}⚠{Colors.RESET} No files found to move\n")
        return
    
    print(f"{Colors.CYAN}Step 3: Updating import statements...{Colors.RESET}")
    update_imports_in_files(excluded_files, source_path, target_path, kebab, dry_run)
    
    if barrel and moved_files:
        print(f"\n{Colors.CYAN}Step 4: Creating barrel file...{Colors.RESET}")
        create_barrel_file(target_path, dry_run)
        print(f"{Colors.GREEN}✓{Colors.RESET} {'Would create' if dry_run else 'Created'} barrel file\n")

    if barrel_shared:
        print(f"{Colors.CYAN}Step 5: Creating shared barrel file...{Colors.RESET}")
        create_barrel_file(target_path, dry_run, barrel_for_shared=True)
        print(f"{Colors.GREEN}✓{Colors.RESET} {'Would create' if dry_run else 'Created'} shared barrel file\n")

    if cleanup and moved_files and not dry_run:
        print(f"{Colors.CYAN}Step 6: Cleaning up source directory...{Colors.RESET}")
        cleanup_directory(source_path, dry_run)
        print(f"{Colors.GREEN}✓{Colors.RESET} Removed source directory\n")
    elif cleanup and dry_run:
        print(f"{Colors.CYAN}Step 6: Would clean up source directory...{Colors.RESET}")
        print(f"{Colors.YELLOW}✓{Colors.RESET} Would remove source directory\n")
    
    status = "PREVIEW COMPLETE" if dry_run else "MIGRATION COMPLETE"
    print(f"{Colors.GREEN}{Colors.BOLD}{status}!{Colors.RESET}")
    
    if dry_run:
        print(f"\n{Colors.DIM}To apply these changes, run the same command without --dry-run{Colors.RESET}")
    else:
        print(f"\n{Colors.DIM}Migration completed successfully! Don't forget to test your application.{Colors.RESET}")

def run_migration_interactive():
    while True:
        show_migration_menu()
        choice = input(f"{Colors.CYAN}Select option [0-5]:{Colors.RESET} ").strip()
        
        if choice == '0':
            return
        elif choice == '1':
            clear_screen()
            print_main_banner()
            print(f"{Colors.BRIGHT}{Colors.WHITE}QUICK MIGRATION{Colors.RESET}\n")
            print(f"{Colors.CYAN}Using recommended settings:{Colors.RESET}")
            print(f"{Colors.DIM}• Source: src/components/ui{Colors.RESET}")
            print(f"{Colors.DIM}• Target: src/shared/components/ui{Colors.RESET}")
            print(f"{Colors.DIM}• Convert to kebab-case: Yes{Colors.RESET}")
            print(f"{Colors.DIM}• Create barrel file: Yes{Colors.RESET}")
            print(f"{Colors.DIM}• Cleanup source: No (safer){Colors.RESET}")
            
            confirm = input(f"\n{Colors.BOLD}Proceed? (y/N): {Colors.RESET}").lower()
            if confirm == 'y':
                run_migration('src/components/ui', 'src/shared/components/ui', True, True, False, False, False)
                input(f"\n{Colors.DIM}Press Enter to continue...{Colors.RESET}")
        elif choice == '2':
            run_custom_migration()
        elif choice == '3':
            run_migration('src/components/ui', 'src/shared/components/ui', False, False, False, False, True)
            input(f"\n{Colors.DIM}Press Enter to continue...{Colors.RESET}")
        elif choice == '4':
            print_migration_examples()
        elif choice == '5':
            print_migration_help()
        else:
            print(f"{Colors.RED}Invalid option{Colors.RESET}")
            time.sleep(1)

def run_custom_migration():
    clear_screen()
    print_main_banner()
    print(f"{Colors.BRIGHT}{Colors.WHITE}CUSTOM MIGRATION SETUP{Colors.RESET}\n")

    source_path = input(f"{Colors.CYAN}Source path{Colors.RESET} (default: src/components/ui): ").strip() or 'src/components/ui'
    target_path = input(f"{Colors.CYAN}Target path{Colors.RESET} (default: src/shared/components/ui): ").strip() or 'src/shared/components/ui'
    
    print(f"\n{Colors.CYAN}Options:{Colors.RESET}")
    kebab = input(f"{Colors.DIM}Convert filenames to kebab-case?{Colors.RESET} (y/N): ").lower() == 'y'
    barrel = input(f"{Colors.DIM}Create index.ts barrel file?{Colors.RESET} (y/N): ").lower() == 'y'
    barrel_shared = input(f"{Colors.DIM}Create barrel file for shared directory?{Colors.RESET} (y/N): ").lower() == 'y'
    cleanup = input(f"{Colors.DIM}Remove source directory after migration?{Colors.RESET} (y/N): ").lower() == 'y'
    dry_run = input(f"{Colors.DIM}Run in preview mode first?{Colors.RESET} (Y/n): ").lower() != 'n'

    clear_screen()
    print_main_banner()
    print(f"{Colors.BRIGHT}{Colors.WHITE}MIGRATION SUMMARY{Colors.RESET}\n")
    print(f"{Colors.CYAN}Source:{Colors.RESET} {source_path}")
    print(f"{Colors.CYAN}Target:{Colors.RESET} {target_path}")
    print(f"{Colors.CYAN}Kebab-case:{Colors.RESET} {'Yes' if kebab else 'No'}")
    print(f"{Colors.CYAN}Create barrel:{Colors.RESET} {'Yes' if barrel else 'No'}")
    print(f"{Colors.CYAN}Barrel for shared:{Colors.RESET} {'Yes' if barrel_shared else 'No'}")
    print(f"{Colors.CYAN}Cleanup source:{Colors.RESET} {'Yes' if cleanup else 'No'}")
    print(f"{Colors.CYAN}Preview mode:{Colors.RESET} {'Yes' if dry_run else 'No'}")

    confirm = input(f"\n{Colors.BOLD}Proceed? (y/N): {Colors.RESET}").lower()
    if confirm == 'y':
        run_migration(source_path, target_path, kebab, barrel, barrel_shared, cleanup, dry_run)
        input(f"\n{Colors.DIM}Press Enter to continue...{Colors.RESET}")

def print_migration_examples():
    clear_screen()
    print_main_banner()
    print(f"{Colors.BRIGHT}{Colors.WHITE}MIGRATION EXAMPLES{Colors.RESET}\n")
    
    examples = [
        {
            'title': 'Preview Changes',
            'command': 'ui --migrate --dry-run',
            'desc': 'See what would happen without making changes'
        },
        {
            'title': 'Full Migration',
            'command': 'ui --migrate --kebab --barrel --cleanup',
            'desc': 'Complete migration with kebab-case and cleanup'
        },
        {
            'title': 'Custom Directories',
            'command': 'ui --migrate --source-path "old/ui" --target-path "new/components"',
            'desc': 'Migrate between custom directories'
        }
    ]
    
    for i, example in enumerate(examples, 1):
        print(f"{Colors.CYAN}{i}. {example['title']}{Colors.RESET}")
        print(f"   {Colors.GREEN}{example['command']}{Colors.RESET}")
        print(f"   {Colors.DIM}{example['desc']}{Colors.RESET}\n")
    
    input(f"\n{Colors.DIM}Press Enter to continue...{Colors.RESET}")

class JavaScriptAnalyzer:
    @staticmethod
    def extract_imports_detailed(file_path: Path) -> List[ImportInfo]:
        try:
            content = file_path.read_text(encoding='utf-8')
        except Exception:
            return []
        
        imports = []
        lines = content.split('\n')
        
        patterns = [
            (r"import\s+\{\s*([^}]+)\s*\}\s+from\s+['\"]([^'\"]+)['\"]", 'named'),
            (r"import\s+(\w+)\s+from\s+['\"]([^'\"]+)['\"]", 'default'),
            (r"import\s+\*\s+as\s+(\w+)\s+from\s+['\"]([^'\"]+)['\"]", 'namespace'),
            (r"import\s+['\"]([^'\"]+)['\"]", 'side-effect'),
            (r"(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['\"]([^'\"]+)['\"]\s*\)", 'require'),
        ]
        
        for line_num, line in enumerate(lines, 1):
            for pattern, import_type in patterns:
                matches = re.finditer(pattern, line)
                for match in matches:
                    if import_type == 'named':
                        names = match.group(1)
                        module_path = match.group(2)
                        for name in names.split(','):
                            name = name.strip()
                            if ' as ' in name:
                                name = name.split(' as ')[1].strip()
                            imports.append(ImportInfo(
                                source_file=file_path,
                                imported_name=name,
                                import_path=module_path,
                                import_type=import_type,
                                line_number=line_num
                            ))
                    elif import_type == 'side-effect':
                        imports.append(ImportInfo(
                            source_file=file_path,
                            imported_name='',
                            import_path=match.group(1),
                            import_type=import_type,
                            line_number=line_num
                        ))
                    else:
                        imports.append(ImportInfo(
                            source_file=file_path,
                            imported_name=match.group(1),
                            import_path=match.group(2),
                            import_type=import_type,
                            line_number=line_num
                        ))
        
        return imports
    
    @staticmethod
    def extract_exports(file_path: Path) -> List[ExportInfo]:
        try:
            content = file_path.read_text(encoding='utf-8')
        except Exception:
            return []
        
        exports = []
        lines = content.split('\n')
        
        patterns = [
            (r"export\s+default\s+(\w+)", 'default'),
            (r"export\s+(?:const|let|var)\s+(\w+)", 'const'),
            (r"export\s+function\s+(\w+)", 'function'),
            (r"export\s+class\s+(\w+)", 'class'),
            (r"export\s+(?:type|interface)\s+(\w+)", 'type'),
            (r"export\s+\{\s*([^}]+)\s*\}", 'named'),
        ]
        
        for line_num, line in enumerate(lines, 1):
            for pattern, export_type in patterns:
                matches = re.finditer(pattern, line)
                for match in matches:
                    if export_type == 'named':
                        names = match.group(1)
                        for name in names.split(','):
                            name = name.strip()
                            if ' as ' in name:
                                name = name.split(' as ')[0].strip()
                            exports.append(ExportInfo(
                                source_file=file_path,
                                exported_name=name,
                                export_type=export_type,
                                line_number=line_num
                            ))
                    else:
                        exports.append(ExportInfo(
                            source_file=file_path,
                            exported_name=match.group(1),
                            export_type=export_type,
                            line_number=line_num
                        ))
        
        return exports
    
    @staticmethod
    def find_usage_in_file(file_path: Path, identifier: str) -> List[int]:
        try:
            content = file_path.read_text(encoding='utf-8')
        except Exception:
            return []
        
        pattern = rf'\b{re.escape(identifier)}\b'
        lines = content.split('\n')
        usage_lines = []
        
        for line_num, line in enumerate(lines, 1):
            if re.search(pattern, line):
                if not (line.strip().startswith('import') or line.strip().startswith('export')):
                    usage_lines.append(line_num)
        
        return usage_lines
    
    @staticmethod
    def is_identifier_used(file_path: Path, identifier: str) -> bool:
        try:
            content = file_path.read_text(encoding='utf-8')
        except Exception:
            return False
        
        lines = content.split('\n')
        in_import_block = False
        in_multiline_comment = False
        
        for line_num, line in enumerate(lines):
            stripped = line.strip()
            
            if '/*' in line:
                in_multiline_comment = True
            if '*/' in line:
                in_multiline_comment = False
                continue
            if in_multiline_comment or stripped.startswith('//'):
                continue
            
            if stripped.startswith('import '):
                in_import_block = True
                continue
            elif in_import_block and stripped == '':
                in_import_block = False
            elif in_import_block:
                continue
            
            jsx_pattern = rf'<\s*{re.escape(identifier)}[\s/>]'
            if re.search(jsx_pattern, line):
                return True
            
            type_patterns = [
                rf':\s*{re.escape(identifier)}\b',
                rf'<\s*{re.escape(identifier)}\s*>',
                rf'extends\s+{re.escape(identifier)}\b',
                rf'implements\s+{re.escape(identifier)}\b',
                rf'as\s+{re.escape(identifier)}\b',
            ]
            for pattern in type_patterns:
                if re.search(pattern, line):
                    return True
            
            word_pattern = rf'\b{re.escape(identifier)}\b'
            if re.search(word_pattern, line):
                if not (stripped.startswith('export') or stripped.startswith('type ') or stripped.startswith('interface ')):
                    return True
        
        return False

class DuplicateDetector:
    def __init__(self, base_path: Path, exclude_dirs: Set[str]):
        self.base_path = base_path
        self.exclude_dirs = exclude_dirs
        self.ts_files = self._find_typescript_files()
    
    def _find_typescript_files(self) -> List[Path]:
        files = []
        for root, dirs, filenames in os.walk(self.base_path):
            dirs[:] = [d for d in dirs if d not in self.exclude_dirs]
            for filename in filenames:
                if filename.endswith(('.ts', '.tsx')):
                    files.append(Path(root) / filename)
        return files
    
    def find_duplicates(self) -> Dict[str, List[DuplicateFileInfo]]:
        print(f"{Colors.BLUE}🔍 Scanning {len(self.ts_files)} TypeScript files...{Colors.RESET}")
        
        hash_map = defaultdict(list)
        
        for file_path in self.ts_files:
            content_hash = compute_content_hash(file_path)
            if content_hash:
                stat = file_path.stat()
                file_info = DuplicateFileInfo(
                    file_path=file_path,
                    content_hash=content_hash,
                    size=stat.st_size,
                    mtime=stat.st_mtime
                )
                hash_map[content_hash].append(file_info)
        
        duplicates = {h: files for h, files in hash_map.items() if len(files) > 1}
        
        for duplicate_group in duplicates.values():
            for file_info in duplicate_group:
                file_info.import_count = self._count_imports_to_file(file_info.file_path)
        
        return duplicates
    
    def _count_imports_to_file(self, target_file: Path) -> int:
        count = 0
        rel_target = target_file.relative_to(self.base_path)
        target_without_ext = str(rel_target.with_suffix(''))
        
        for file_path in self.ts_files:
            if file_path == target_file:
                continue
            
            try:
                content = file_path.read_text(encoding='utf-8')
                patterns = [
                    rf"from\s+['\"].*{re.escape(target_without_ext)}['\"]" ,
                    rf"from\s+['\"]@/.*{re.escape(target_file.stem)}['\"]" ,
                    rf"import\s+['\"].*{re.escape(target_without_ext)}['\"]" ,
                ]
                
                for pattern in patterns:
                    if re.search(pattern, content):
                        count += 1
                        break
            except Exception:
                continue
        
        return count
    
    def get_relative_import_path(self, from_file: Path, to_file: Path) -> str:
        from_dir = from_file.parent
        to_path_no_ext = to_file.with_suffix('')
        
        try:
            rel_path = os.path.relpath(to_path_no_ext, from_dir)
            if not rel_path.startswith('.'):
                rel_path = f'./{rel_path}'
            return rel_path.replace(os.sep, '/')
        except ValueError:
            return str(to_path_no_ext)
    
    def update_imports_after_deletion(self, deleted_files: List[Path], kept_file: Path, backup_dir: Path) -> int:
        updated_count = 0
        
        print(f"\n{Colors.CYAN}Updating imports in project files...{Colors.RESET}")
        
        for file_path in self.ts_files:
            if file_path in deleted_files or file_path == kept_file:
                continue
            
            try:
                content = file_path.read_text(encoding='utf-8')
                updated_content = content
                file_modified = False
                
                for deleted_file in deleted_files:
                    rel_deleted = deleted_file.relative_to(self.base_path)
                    deleted_no_ext = str(rel_deleted.with_suffix(''))
                    
                    old_import_patterns = [
                        (rf"(from\s+['\"])(.*/)?{re.escape(deleted_file.stem)}(['\"])", 'named'),
                        (rf"(from\s+['\"]){re.escape(deleted_no_ext)}(['\"])", 'exact'),
                    ]
                    
                    for pattern, pattern_type in old_import_patterns:
                        matches = list(re.finditer(pattern, updated_content))
                        if matches:
                            backup_file = backup_dir / file_path.relative_to(self.base_path)
                            backup_file.parent.mkdir(parents=True, exist_ok=True)
                            if not backup_file.exists():
                                shutil.copy2(file_path, backup_file)
                            
                            new_import_path = self.get_relative_import_path(file_path, kept_file)
                            
                            for match in matches:
                                if pattern_type == 'named':
                                    old_import = match.group(0)
                                    new_import = f"{match.group(1)}{new_import_path}{match.group(3)}"
                                    updated_content = updated_content.replace(old_import, new_import)
                                else:
                                    old_import = match.group(0)
                                    new_import = f"{match.group(1)}{new_import_path}{match.group(2)}"
                                    updated_content = updated_content.replace(old_import, new_import)
                                
                                file_modified = True
                                print(f"  {Colors.GREEN}✓{Colors.RESET} {file_path.name}: Updated import")
                
                if file_modified:
                    file_path.write_text(updated_content, encoding='utf-8')
                    updated_count += 1
                    
            except Exception as e:
                print(f"  {Colors.RED}✗{Colors.RESET} Error updating {file_path.name}: {e}")
        
        return updated_count

class ComprehensiveImportAnalyzer:
    def __init__(self, base_path: Path, exclude_dirs: Set[str]):
        self.base_path = base_path
        self.exclude_dirs = exclude_dirs
        self.ts_files = self._find_typescript_files()
    
    def _find_typescript_files(self) -> List[Path]:
        files = []
        for root, dirs, filenames in os.walk(self.base_path):
            dirs[:] = [d for d in dirs if d not in self.exclude_dirs]
            for filename in filenames:
                if filename.endswith(('.ts', '.tsx')):
                    files.append(Path(root) / filename)
        return files
    
    def find_unused_imports(self) -> Dict[Path, List[UnusedImport]]:
        unused_by_file = defaultdict(list)
        total_files = len(self.ts_files)
        
        print(f"{Colors.BLUE}🔍 Scanning {total_files} TypeScript/TSX files for unused imports...{Colors.RESET}")
        
        for idx, file_path in enumerate(self.ts_files, 1):
            if idx % 10 == 0 or idx == total_files:
                print(f"{Colors.CYAN}Progress: {idx}/{total_files} files scanned{Colors.RESET}", end='\r')
            
            imports = JavaScriptAnalyzer.extract_imports_detailed(file_path)
            
            for import_info in imports:
                if import_info.import_type == 'side-effect':
                    continue
                
                if not import_info.imported_name:
                    continue
                
                is_used = JavaScriptAnalyzer.is_identifier_used(file_path, import_info.imported_name)
                
                if not is_used:
                    unused_by_file[file_path].append(UnusedImport(
                        file_path=file_path,
                        import_name=import_info.imported_name,
                        import_path=import_info.import_path,
                        line_number=import_info.line_number,
                        import_type=import_info.import_type
                    ))
        
        print(f"{Colors.GREEN}✓ Scan complete!{Colors.RESET}" + "" * 30)
        return dict(unused_by_file)

class UnusedPackageAnalyzer:
    def __init__(self, base_path: Path, exclude_dirs: Set[str]):
        self.base_path = base_path
        self.exclude_dirs = exclude_dirs
        self.package_json_path = base_path / 'package.json'
        self.all_files = self._find_project_files()
    
    def _find_project_files(self) -> List[Path]:
        files = []
        extensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.config.js', '.config.ts']
        
        for root, dirs, filenames in os.walk(self.base_path):
            dirs[:] = [d for d in dirs if d not in self.exclude_dirs]
            
            for filename in filenames:
                if any(filename.endswith(ext) for ext in extensions):
                    files.append(Path(root) / filename)
        
        return files
    
    def _is_package_excluded(self, package_name: str) -> bool:
        if package_name in EXCLUDED_PACKAGES:
            return True
        
        for pattern in EXCLUDED_PACKAGE_PATTERNS:
            if re.match(pattern, package_name):
                return True
        
        return False
    
    def _check_package_usage(self, package_name: str) -> Tuple[bool, List[str]]:
        found_in_files = []
        
        import_patterns = [
            rf"from\s+['\"]({re.escape(package_name)})['\"]" ,
            rf"from\s+['\"]({re.escape(package_name)})/[^'\"]*['\"]" ,
            rf"import\s+['\"]({re.escape(package_name)})['\"]" ,
            rf"import\s+['\"]({re.escape(package_name)})/[^'\"]*['\"]" ,
            rf"require\s*\(\s*['\"]({re.escape(package_name)})['\"]\s*\)" ,
            rf"require\s*\(\s*['\"]({re.escape(package_name)})/[^'\"]*['\"]\s*\)" ,
            rf"['\"]({re.escape(package_name)})['\"]" ,
        ]
        
        for file_path in self.all_files:
            try:
                content = file_path.read_text(encoding='utf-8')
                
                for pattern in import_patterns:
                    if re.search(pattern, content):
                        found_in_files.append(str(file_path.relative_to(self.base_path)))
                        break
                        
            except Exception:
                continue
        
        return len(found_in_files) > 0, found_in_files
    
    def find_unused_packages(self) -> Dict[str, List[UnusedPackage]]:
        if not self.package_json_path.exists():
            return {'error': 'package.json not found'}
        
        try:
            with open(self.package_json_path, 'r', encoding='utf-8') as f:
                package_data = json.load(f)
        except Exception as e:
            return {'error': f'Failed to parse package.json: {e}'}
        
        dependencies = package_data.get('dependencies', {})
        dev_dependencies = package_data.get('devDependencies', {})
        
        unused_packages = {
            'dependencies': [],
            'devDependencies': []
        }
        
        print(f"{Colors.BLUE}🔍 Scanning {len(self.all_files)} files for package usage...{Colors.RESET}")
        print()
        
        total_packages = len(dependencies) + len(dev_dependencies)
        current = 0
        
        for package_name, version in dependencies.items():
            current += 1
            print(f"{Colors.CYAN}Progress: {current}/{total_packages} - Checking {package_name}...{Colors.RESET}", end='\r')
            
            if self._is_package_excluded(package_name):
                continue
            
            is_used, found_in = self._check_package_usage(package_name)
            
            if not is_used:
                unused_packages['dependencies'].append(UnusedPackage(
                    name=package_name,
                    version=version,
                    is_dev=False,
                    found_in_files=found_in
                ))
        
        for package_name, version in dev_dependencies.items():
            current += 1
            print(f"{Colors.CYAN}Progress: {current}/{total_packages} - Checking {package_name}...{Colors.RESET}", end='\r')
            
            if self._is_package_excluded(package_name):
                continue
            
            is_used, found_in = self._check_package_usage(package_name)
            
            if not is_used:
                unused_packages['devDependencies'].append(UnusedPackage(
                    name=package_name,
                    version=version,
                    is_dev=True,
                    found_in_files=found_in
                ))
        
        print(f"{Colors.GREEN}✓ Scan complete!{Colors.RESET}" + " " * 50)
        return unused_packages

class UnusedAnalyzer:
    def __init__(self, base_path: Path, file_types: List[str], exclude_dirs: Set[str], 
                 exclude_files: List[str], exclude_patterns: List[str]):
        self.base_path = base_path
        self.file_types = file_types
        self.exclude_dirs = exclude_dirs
        self.exclude_files = exclude_files
        self.exclude_patterns = [re.compile(p) for p in exclude_patterns]
        self.all_files = self._find_files()
    
    def _find_files(self) -> List[Path]:
        files = []
        
        for root, dirs, filenames in os.walk(self.base_path):
            dirs[:] = [d for d in dirs if d not in self.exclude_dirs]
            
            for filename in filenames:
                if filename in self.exclude_files:
                    continue
                
                file_path = Path(root) / filename
                rel_path = file_path.relative_to(self.base_path)
                
                if any(pattern.search(str(rel_path)) for pattern in self.exclude_patterns):
                    continue
                
                if any(filename.endswith(f'.{ext}') for ext in self.file_types):
                    files.append(file_path)
        
        return files
    
    def find_unused_imports(self) -> List[UnusedImport]:
        unused_imports = []
        
        print(f"{Colors.BLUE}🔍 Analyzing imports in {len(self.all_files)} files...{Colors.RESET}")
        
        for file_path in self.all_files:
            if file_path.suffix in ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']:
                imports = JavaScriptAnalyzer.extract_imports_detailed(file_path)
                
                for import_info in imports:
                    if import_info.import_type == 'side-effect':
                        continue
                    
                    usages = JavaScriptAnalyzer.find_usage_in_file(file_path, import_info.imported_name)
                    
                    if not usages:
                        unused_imports.append(UnusedImport(
                            file_path=file_path,
                            import_name=import_info.imported_name,
                            import_path=import_info.import_path,
                            line_number=import_info.line_number,
                            import_type=import_info.import_type
                        ))
        
        return unused_imports
    
    def find_unused_exports(self) -> List[Dict]:
        unused_exports = []
        
        print(f"{Colors.BLUE}🔍 Analyzing exports across {len(self.all_files)} files...{Colors.RESET}")
        
        all_imports = {}
        for file_path in self.all_files:
            if file_path.suffix in ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']:
                imports = JavaScriptAnalyzer.extract_imports_detailed(file_path)
                for import_info in imports:
                    key = (import_info.import_path, import_info.imported_name)
                    if key not in all_imports:
                        all_imports[key] = []
                    all_imports[key].append(import_info)
        
        for file_path in self.all_files:
            if file_path.suffix in ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']:
                exports = JavaScriptAnalyzer.extract_exports(file_path)
                
                for export_info in exports:
                    rel_path = file_path.relative_to(self.base_path)
                    possible_import_paths = [
                        str(rel_path.with_suffix('')),
                        f"./{rel_path.with_suffix('')}",
                        f"../{rel_path.with_suffix('')}",
                    ]
                    
                    found_import = False
                    for import_path in possible_import_paths:
                        key = (import_path, export_info.exported_name)
                        if key in all_imports:
                            found_import = True
                            break
                    
                    if not found_import:
                        unused_exports.append({
                            'file': str(rel_path),
                            'export_name': export_info.exported_name,
                            'export_type': export_info.export_type,
                            'line_number': export_info.line_number
                        })
        
        return unused_exports
    
    def find_unused_files(self) -> Tuple[List[Dict], List[Dict]]:
        unused = []
        uncertain = []
        
        print(f"{Colors.BLUE}🔍 Analyzing file dependencies...{Colors.RESET}")
        
        for file_path in self.all_files:
            if file_path.name in ['index.ts', 'index.tsx', 'index.js', 'index.jsx']:
                continue
            
            rel_path = file_path.relative_to(self.base_path)
            is_imported = self._is_file_imported(file_path)
            
            if file_path.suffix in ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']:
                exports = JavaScriptAnalyzer.extract_exports(file_path)
                has_exports = len(exports) > 0
            else:
                has_exports = False
            
            if not is_imported and has_exports:
                unused.append({
                    'file': str(rel_path),
                    'reason': 'No imports found',
                    'has_exports': has_exports
                })
        
        return unused, uncertain
    
    def _is_file_imported(self, target_file: Path) -> bool:
        rel_target = target_file.relative_to(self.base_path)
        target_without_ext = str(rel_target.with_suffix(''))
        
        possible_import_paths = {
            target_without_ext,
            f"./{target_without_ext}",
            f"../{target_without_ext}",
        }
        
        for file_path in self.all_files:
            if file_path == target_file:
                continue
            
            if file_path.suffix in ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']:
                imports = JavaScriptAnalyzer.extract_imports_detailed(file_path)
                for import_info in imports:
                    if import_info.import_path in possible_import_paths:
                        return True
        
        return False

def show_unused_imports_report(imports_by_file: Dict[Path, List[UnusedImport]]):
    print(f"\n{Colors.CYAN}{Colors.BOLD}📊 UNUSED IMPORTS REPORT{Colors.RESET}")
    print("=" * 70)
    
    for file_path, imports in imports_by_file.items():
        rel_path = file_path.relative_to(Path.cwd()) if file_path.is_absolute() else file_path
        print(f"\n{Colors.YELLOW}📄 {rel_path}{Colors.RESET}")
        
        for imp in imports:
            print(f"  {Colors.RED}✗{Colors.RESET} Line {imp.line_number}: "
                  f"{imp.import_name} from '{imp.import_path}' ({imp.import_type})")

def interactive_handle_duplicates(detector: DuplicateDetector, duplicates: Dict[str, List[DuplicateFileInfo]], dry_run: bool = False) -> bool:
    if not duplicates:
        print(f"{Colors.GREEN}✅ No duplicate files found!{Colors.RESET}")
        return True
    
    total_groups = len(duplicates)
    total_files = sum(len(group) for group in duplicates.values())
    
    print(f"\n{Colors.YELLOW}📄 Found {total_files} duplicate files in {total_groups} groups{Colors.RESET}\n")
    
    files_to_delete = []
    files_to_keep = []
    
    for group_num, (content_hash, file_group) in enumerate(duplicates.items(), 1):
        clear_screen()
        print_main_banner()
        print(f"{Colors.CYAN}{Colors.BOLD}DUPLICATE GROUP {group_num}/{total_groups}{Colors.RESET}")
        print("=" * 70)
        print(f"\n{Colors.DIM}These files have identical content (ignoring whitespace):{Colors.RESET}\n")
        
        for idx, file_info in enumerate(file_group):
            rel_path = file_info.file_path.relative_to(detector.base_path)
            mtime_str = datetime.fromtimestamp(file_info.mtime).strftime('%Y-%m-%d %H:%M')
            size_kb = file_info.size / 1024
            path_depth = len(rel_path.parts)
            
            print(f"{Colors.GREEN}{idx + 1}.{Colors.RESET} {Colors.BRIGHT}{rel_path}{Colors.RESET}")
            print(f"   Size: {size_kb:.1f}KB  |  Modified: {mtime_str}  |  Depth: {path_depth}  |  Imports: {file_info.import_count}")
            print()
        
        print(f"{Colors.YELLOW}Which file would you like to KEEP?{Colors.RESET}")
        print(f"{Colors.DIM}(All others will be deleted){Colors.RESET}")
        print(f"\n{Colors.CYAN}Enter number [1-{len(file_group)}], 's' to skip, or 'q' to quit:{Colors.RESET} ", end='')
        
        while True:
            choice = input().strip().lower()
            
            if choice == 'q':
                print(f"\n{Colors.YELLOW}Operation cancelled.{Colors.RESET}")
                return False
            elif choice == 's':
                print(f"{Colors.BLUE}Skipping this group...{Colors.RESET}")
                time.sleep(0.5)
                break
            elif choice.isdigit():
                choice_num = int(choice)
                if 1 <= choice_num <= len(file_group):
                    keep_file = file_group[choice_num - 1]
                    files_to_keep.append(keep_file.file_path)
                    
                    for idx, file_info in enumerate(file_group):
                        if idx != choice_num - 1:
                            files_to_delete.append(file_info.file_path)
                    
                    print(f"\n{Colors.GREEN}✓{Colors.RESET} Will keep: {keep_file.file_path.name}")
                    print(f"{Colors.RED}✗{Colors.RESET} Will delete {len(file_group) - 1} file(s)")
                    time.sleep(1)
                    break
                else:
                    print(f"{Colors.RED}Invalid choice. Enter 1-{len(file_group)}, 's', or 'q':{Colors.RESET} ", end='')
            else:
                print(f"{Colors.RED}Invalid input. Enter 1-{len(file_group)}, 's', or 'q':{Colors.RESET} ", end='')
    
    if not files_to_delete:
        print(f"\n{Colors.YELLOW}No files selected for deletion.{Colors.RESET}")
        return True
    
    clear_screen()
    print_main_banner()
    print(f"{Colors.CYAN}{Colors.BOLD}DELETION SUMMARY{Colors.RESET}")
    print("=" * 70)
    print(f"\n{Colors.GREEN}Files to keep:{Colors.RESET}")
    for keep_file in files_to_keep:
        rel_path = keep_file.relative_to(detector.base_path)
        print(f"  ✓ {rel_path}")
    
    print(f"\n{Colors.RED}Files to delete:{Colors.RESET}")
    for del_file in files_to_delete:
        rel_path = del_file.relative_to(detector.base_path)
        print(f"  ✗ {rel_path}")
    
    print(f"\n{Colors.YELLOW}Total: {len(files_to_delete)} file(s) will be deleted{Colors.RESET}")
    
    if dry_run:
        print(f"\n{Colors.BLUE}DRY RUN: No changes will be made{Colors.RESET}")
        return True
    
    print(f"\n{Colors.YELLOW}⚠️  This action cannot be undone (but backups will be created).{Colors.RESET}")
    confirm = input(f"{Colors.CYAN}Proceed with deletion? [y/N]:{Colors.RESET} ").strip().lower()
    
    if confirm not in ['y', 'yes']:
        print(f"\n{Colors.YELLOW}Operation cancelled.{Colors.RESET}")
        return False
    
    home_dir = Path.home()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = home_dir / '.config' / 'dotfiles' / 'ui' / 'backup-duplicates' / timestamp
    backup_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\n{Colors.CYAN}Creating backups...{Colors.RESET}")
    for file_path in files_to_delete:
        try:
            rel_path = file_path.relative_to(detector.base_path)
            backup_file = backup_dir / rel_path
            backup_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(file_path, backup_file)
            print(f"  {Colors.GREEN}✓{Colors.RESET} Backed up {rel_path}")
        except Exception as e:
            print(f"  {Colors.RED}✗{Colors.RESET} Failed to backup {file_path.name}: {e}")
            return False
    
    print(f"\n{Colors.CYAN}Updating imports in project files...{Colors.RESET}")
    files_updated = 0
    
    for keep_file in files_to_keep:
        group_deletes = [f for f in files_to_delete if any(f.parent == keep_file.parent for _ in [1])]
        relevant_deletes = [f for f in files_to_delete if f.stem == keep_file.stem]
        
        if relevant_deletes:
            updated = detector.update_imports_after_deletion(relevant_deletes, keep_file, backup_dir)
            files_updated += updated
    
    print(f"\n{Colors.CYAN}Deleting duplicate files...{Colors.RESET}")
    deleted_count = 0
    for file_path in files_to_delete:
        try:
            file_path.unlink()
            rel_path = file_path.relative_to(detector.base_path)
            print(f"  {Colors.GREEN}✓{Colors.RESET} Deleted {rel_path}")
            deleted_count += 1
        except Exception as e:
            print(f"  {Colors.RED}✗{Colors.RESET} Failed to delete {file_path.name}: {e}")
    
    print(f"\n{Colors.GREEN}{Colors.BOLD}COMPLETE!{Colors.RESET}")
    print("=" * 70)
    print(f"  Files deleted: {deleted_count}")
    print(f"  Imports updated in: {files_updated} files")
    print(f"  Backup location: {backup_dir}")
    
    return True

def interactive_select_unused_imports(unused_by_file: Dict[Path, List[UnusedImport]]) -> List[Tuple[Path, UnusedImport]]:
    selected_imports = []
    file_list = list(unused_by_file.items())
    
    for file_idx, (file_path, imports) in enumerate(file_list, 1):
        clear_screen()
        print_main_banner()
        print(f"{Colors.CYAN}{Colors.BOLD}SELECT UNUSED IMPORTS TO REMOVE{Colors.RESET}")
        print("=" * 70)
        print(f"\nFile {file_idx}/{len(file_list)}: {Colors.YELLOW}{file_path.name}{Colors.RESET}")
        print(f"{Colors.DIM}Path: {file_path}{Colors.RESET}\n")
        
        selections = [False] * len(imports)
        
        print(f"{Colors.DIM}Use 'a' to select all, 'n' for none, number to toggle, 'c' to confirm, 's' to skip file:{Colors.RESET}\n")
        
        while True:
            for idx, imp in enumerate(imports):
                marker = f"{Colors.GREEN}[✓]{Colors.RESET}" if selections[idx] else f"{Colors.RED}[ ]{Colors.RESET}"
                print(f"  {marker} {idx + 1}. Line {imp.line_number}: {imp.import_name} from '{imp.import_path}'")
            
            print(f"\n{Colors.CYAN}Selected: {sum(selections)}/{len(imports)}{Colors.RESET}")
            choice = input(f"{Colors.CYAN}Enter choice: {Colors.RESET}").strip().lower()
            
            if choice == 'c':
                for idx, imp in enumerate(imports):
                    if selections[idx]:
                        selected_imports.append((file_path, imp))
                break
            elif choice == 's':
                break
            elif choice == 'a':
                selections = [True] * len(imports)
            elif choice == 'n':
                selections = [False] * len(imports)
            elif choice.isdigit():
                num = int(choice) - 1
                if 0 <= num < len(imports):
                    selections[num] = not selections[num]
            
            clear_screen()
            print_main_banner()
            print(f"{Colors.CYAN}{Colors.BOLD}SELECT UNUSED IMPORTS TO REMOVE{Colors.RESET}")
            print("=" * 70)
            print(f"\nFile {file_idx}/{len(file_list)}: {Colors.YELLOW}{file_path.name}{Colors.RESET}")
            print(f"{Colors.DIM}Path: {file_path}{Colors.RESET}\n")
            print(f"{Colors.DIM}Use 'a' to select all, 'n' for none, number to toggle, 'c' to confirm, 's' to skip file:{Colors.RESET}\n")
    
    return selected_imports

def remove_selected_imports(imports_to_remove: List[Tuple[Path, UnusedImport]], backup_dir: Path) -> Tuple[int, int]:
    files_by_path = defaultdict(list)
    for file_path, import_info in imports_to_remove:
        files_by_path[file_path].append(import_info)
    
    files_modified = 0
    imports_removed = 0
    
    print(f"\n{Colors.CYAN}Creating backups and removing imports...{Colors.RESET}")
    
    for file_path, imports in files_by_path.items():
        try:
            rel_path = file_path.relative_to(Path.cwd()) if file_path.is_absolute() else file_path
            backup_file = backup_dir / rel_path
            backup_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(file_path, backup_file)
            
            content = file_path.read_text(encoding='utf-8')
            lines = content.split('\n')
            
            sorted_imports = sorted(imports, key=lambda x: x.line_number, reverse=True)
            
            for imp in sorted_imports:
                if imp.line_number <= len(lines):
                    line = lines[imp.line_number - 1]
                    if imp.import_name in line or imp.import_path in line:
                        lines.pop(imp.line_number - 1)
                        imports_removed += 1
            
            file_path.write_text('\n'.join(lines), encoding='utf-8')
            files_modified += 1
            
            print(f"  {Colors.GREEN}✓{Colors.RESET} Modified {rel_path}")
            
        except Exception as e:
            print(f"  {Colors.RED}✗{Colors.RESET} Error processing {file_path.name}: {e}")
    
    return files_modified, imports_removed

def interactive_cleanup_imports(unused_imports: List[UnusedImport], dry_run: bool) -> bool:
    if not unused_imports:
        print(f"{Colors.GREEN}✅ No unused imports found!{Colors.RESET}")
        return True
    
    print(f"{Colors.YELLOW}📋 Found {len(unused_imports)} unused imports{Colors.RESET}")
    print()
    
    imports_by_file = defaultdict(list)
    for imp in unused_imports:
        imports_by_file[imp.file_path].append(imp)
    
    print("What would you like to do?")
    print(f"  {Colors.GREEN}1.{Colors.RESET} Show detailed report")
    print(f"  {Colors.GREEN}2.{Colors.RESET} Remove all unused imports")
    print(f"  {Colors.RED}3.{Colors.RESET} Cancel")
    
    while True:
        choice = input(f"\n{Colors.CYAN}Choice [1-3]:{Colors.RESET} ").strip()
        if choice in ['1', '2', '3']:
            break
        print(f"{Colors.RED}Invalid choice.{Colors.RESET}")
    
    if choice == '3':
        return False
    
    if choice == '1':
        show_unused_imports_report(imports_by_file)
        return True
    
    if choice == '2':
        if dry_run:
            print(f"\n{Colors.BLUE}🔍 DRY RUN: Would remove imports{Colors.RESET}")
            show_unused_imports_report(imports_by_file)
            return True
        
        print(f"\n{Colors.YELLOW}⚠️  This will modify {len(imports_by_file)} files.{Colors.RESET}")
        confirm = input(f"{Colors.CYAN}Continue? [y/N]:{Colors.RESET} ").strip().lower()
        
        if confirm not in ['y', 'yes']:
            return False
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = Path(BACKUP_DIR) / f"imports_{timestamp}"
        backup_dir.mkdir(parents=True, exist_ok=True)
        
        files_modified = 0
        imports_removed = 0
        
        for file_path, imports in imports_by_file.items():
            try:
                rel_path = file_path.relative_to(Path.cwd()) if file_path.is_absolute() else file_path
                backup_file = backup_dir / rel_path
                backup_file.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(file_path, backup_file)
                
                content = file_path.read_text(encoding='utf-8')
                lines = content.split('\n')
                
                sorted_imports = sorted(imports, key=lambda x: x.line_number, reverse=True)
                
                for imp in sorted_imports:
                    if imp.line_number <= len(lines):
                        line = lines[imp.line_number - 1]
                        if imp.import_name in line or imp.import_path in line:
                            lines.pop(imp.line_number - 1)
                            imports_removed += 1
                
                file_path.write_text('\n'.join(lines), encoding='utf-8')
                files_modified += 1
                
                print(f"  {Colors.GREEN}✓{Colors.RESET} Modified {rel_path}")
                
            except Exception as e:
                print(f"  {Colors.RED}✗{Colors.RESET} Error: {e}")
        
        print(f"\n{Colors.GREEN}✅ Success!{Colors.RESET}")
        print(f"  Files modified: {files_modified}")
        print(f"  Imports removed: {imports_removed}")
        print(f"  Backup: {backup_dir}")
        
        return True
    
    return True

def run_package_cleanup(base_path: Path, exclude_dirs: Set[str]):
    clear_screen()
    print_main_banner()
    print(f"{Colors.CYAN}{Colors.BOLD}UNUSED PACKAGE DETECTOR{Colors.RESET}")
    print("=" * 70)
    print()
    
    print(f"{Colors.CYAN}Scanning directory: {Colors.RESET}{base_path}")
    print()
    
    analyzer = UnusedPackageAnalyzer(base_path, exclude_dirs)
    
    if not analyzer.package_json_path.exists():
        print(f"{Colors.RED}❌ No package.json found in {base_path}{Colors.RESET}")
        input(f"\n{Colors.DIM}Press Enter to continue...{Colors.RESET}")
        return
    
    unused_result = analyzer.find_unused_packages()
    
    if 'error' in unused_result:
        print(f"\n{Colors.RED}❌ Error: {unused_result['error']}{Colors.RESET}")
        input(f"\n{Colors.DIM}Press Enter to continue...{Colors.RESET}")
        return
    
    unused_deps = unused_result.get('dependencies', [])
    unused_dev_deps = unused_result.get('devDependencies', [])
    total_unused = len(unused_deps) + len(unused_dev_deps)
    
    if total_unused == 0:
        clear_screen()
        print_main_banner()
        print(f"{Colors.GREEN}{Colors.BOLD}✅ No unused packages found!{Colors.RESET}")
        print(f"{Colors.DIM}All packages are being used in your codebase.{Colors.RESET}")
        input(f"\n{Colors.DIM}Press Enter to continue...{Colors.RESET}")
        return
    
    clear_screen()
    print_main_banner()
    print(f"{Colors.CYAN}{Colors.BOLD}UNUSED PACKAGES FOUND{Colors.RESET}")
    print("=" * 70)
    print()
    print(f"{Colors.YELLOW}Found {total_unused} unused package(s){Colors.RESET}")
    print()
    
    if unused_deps:
        print(f"{Colors.RED}Dependencies ({len(unused_deps)}):{Colors.RESET}")
        for pkg in unused_deps:
            print(f"  • {pkg.name} ({pkg.version})")
        print()
    
    if unused_dev_deps:
        print(f"{Colors.YELLOW}Dev Dependencies ({len(unused_dev_deps)}):{Colors.RESET}")
        for pkg in unused_dev_deps:
            print(f"  • {pkg.name} ({pkg.version})")
        print()
    
    print("What would you like to do?")
    print(f"  {Colors.GREEN}1.{Colors.RESET} Remove ALL unused packages (with backup)")
    print(f"  {Colors.GREEN}2.{Colors.RESET} Select packages interactively")
    print(f"  {Colors.RED}0.{Colors.RESET} Cancel")
    
    while True:
        choice = input(f"\n{Colors.CYAN}Choice [0-2]:{Colors.RESET} ").strip()
        if choice in ['0', '1', '2']:
            break
        print(f"{Colors.RED}Invalid choice.{Colors.RESET}")
    
    if choice == '0':
        return
    
    home_dir = Path.home()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = home_dir / '.config' / 'dotfiles' / 'unused-packages' / timestamp
    backup_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\n{Colors.CYAN}Creating backup of package.json...{Colors.RESET}")
    backup_file = backup_dir / 'package.json'
    shutil.copy2(analyzer.package_json_path, backup_file)
    print(f"  {Colors.GREEN}✓{Colors.RESET} Backup saved to: {backup_file}")
    
    packages_to_remove = []
    
    if choice == '1':
        packages_to_remove = [pkg.name for pkg in unused_deps + unused_dev_deps]
    elif choice == '2':
        packages_to_remove = interactive_select_packages(unused_deps, unused_dev_deps)
    
    if not packages_to_remove:
        print(f"\n{Colors.YELLOW}No packages selected for removal.{Colors.RESET}")
        time.sleep(1)
        return
    
    clear_screen()
    print_main_banner()
    print(f"{Colors.CYAN}{Colors.BOLD}REMOVAL SUMMARY{Colors.RESET}")
    print("=" * 70)
    print(f"\n{Colors.YELLOW}The following {len(packages_to_remove)} package(s) will be removed:{Colors.RESET}")
    for pkg_name in packages_to_remove:
        print(f"  • {pkg_name}")
    print()
    print(f"{Colors.CYAN}Backup location:{Colors.RESET} {backup_dir}")
    
    confirm = input(f"\n{Colors.BOLD}Proceed with removal using bun? [y/N]:{Colors.RESET} ").strip().lower()
    
    if confirm not in ['y', 'yes']:
        print(f"{Colors.YELLOW}Operation cancelled.{Colors.RESET}")
        time.sleep(1)
        return
    
    print(f"\n{Colors.CYAN}Removing packages...{Colors.RESET}")
    print()
    
    removed_count = 0
    failed_packages = []
    
    for idx, pkg_name in enumerate(packages_to_remove, 1):
        print(f"{Colors.CYAN}[{idx}/{len(packages_to_remove)}]{Colors.RESET} Removing {pkg_name}...", end=' ')
        
        try:
            result = os.system(f'cd {base_path} && bun remove {pkg_name} > /dev/null 2>&1')
            if result == 0:
                print(f"{Colors.GREEN}✓{Colors.RESET}")
                removed_count += 1
            else:
                print(f"{Colors.RED}✗{Colors.RESET}")
                failed_packages.append(pkg_name)
        except Exception as e:
            print(f"{Colors.RED}✗ ({e}){Colors.RESET}")
            failed_packages.append(pkg_name)
    
    print()
    print(f"{Colors.GREEN}{Colors.BOLD}✅ COMPLETE!{Colors.RESET}")
    print("=" * 70)
    print(f"  Packages removed: {removed_count}/{len(packages_to_remove)}")
    if failed_packages:
        print(f"\n{Colors.RED}Failed to remove:{Colors.RESET}")
        for pkg in failed_packages:
            print(f"  • {pkg}")
    print(f"\n  Backup location: {backup_dir}")
    
    input(f"\n{Colors.DIM}Press Enter to continue...{Colors.RESET}")

def interactive_select_packages(deps: List[UnusedPackage], dev_deps: List[UnusedPackage]) -> List[str]:
    all_packages = deps + dev_deps
    selections = [False] * len(all_packages)
    
    while True:
        clear_screen()
        print_main_banner()
        print(f"{Colors.CYAN}{Colors.BOLD}SELECT PACKAGES TO REMOVE{Colors.RESET}")
        print("=" * 70)
        print()
        print(f"{Colors.DIM}Use 'a' to select all, 'n' for none, number to toggle, 'c' to confirm:{Colors.RESET}")
        print()
        
        for idx, pkg in enumerate(all_packages):
            marker = f"{Colors.GREEN}[✓]{Colors.RESET}" if selections[idx] else f"{Colors.RED}[ ]{Colors.RESET}"
            dep_type = f"{Colors.YELLOW}[dev]{Colors.RESET}" if pkg.is_dev else f"{Colors.RED}[dep]{Colors.RESET}"
            print(f"  {marker} {idx + 1}. {dep_type} {pkg.name} ({pkg.version})")
        
        print(f"\n{Colors.CYAN}Selected: {sum(selections)}/{len(all_packages)}{Colors.RESET}")
        choice = input(f"{Colors.CYAN}Enter choice: {Colors.RESET}").strip().lower()
        
        if choice == 'c':
            break
        elif choice == 'a':
            selections = [True] * len(all_packages)
        elif choice == 'n':
            selections = [False] * len(all_packages)
        elif choice.isdigit():
            num = int(choice) - 1
            if 0 <= num < len(all_packages):
                selections[num] = not selections[num]
    
    return [pkg.name for idx, pkg in enumerate(all_packages) if selections[idx]]

def run_comprehensive_import_check(base_path: Path, exclude_dirs: Set[str]):
    clear_screen()
    print_main_banner()
    print(f"{Colors.CYAN}{Colors.BOLD}COMPREHENSIVE UNUSED IMPORTS CHECK{Colors.RESET}")
    print("=" * 70)
    print()
    
    gitignore_patterns = parse_gitignore(base_path)
    all_exclude_dirs = exclude_dirs | gitignore_patterns
    
    print(f"{Colors.CYAN}Scanning directory: {Colors.RESET}{base_path}")
    print(f"{Colors.CYAN}Excluded patterns: {Colors.RESET}{len(all_exclude_dirs)} patterns from .gitignore + defaults")
    print()
    
    analyzer = ComprehensiveImportAnalyzer(base_path, all_exclude_dirs)
    
    if not analyzer.ts_files:
        print(f"{Colors.YELLOW}No TypeScript/TSX files found!{Colors.RESET}")
        input(f"\n{Colors.DIM}Press Enter to continue...{Colors.RESET}")
        return
    
    unused_by_file = analyzer.find_unused_imports()
    
    if not unused_by_file:
        print(f"\n{Colors.GREEN}{Colors.BOLD}✅ No unused imports found!{Colors.RESET}")
        print(f"{Colors.DIM}All imports are being used correctly.{Colors.RESET}")
        input(f"\n{Colors.DIM}Press Enter to continue...{Colors.RESET}")
        return
    
    total_unused = sum(len(imports) for imports in unused_by_file.values())
    
    clear_screen()
    print_main_banner()
    print(f"{Colors.CYAN}{Colors.BOLD}UNUSED IMPORTS FOUND{Colors.RESET}")
    print("=" * 70)
    print()
    print(f"{Colors.YELLOW}Found {total_unused} unused imports in {len(unused_by_file)} files{Colors.RESET}")
    print()
    
    print(f"{Colors.DIM}Preview (first 5 files):{Colors.RESET}")
    for idx, (file_path, imports) in enumerate(list(unused_by_file.items())[:5]):
        rel_path = file_path.relative_to(base_path)
        print(f"  {Colors.YELLOW}•{Colors.RESET} {rel_path}: {len(imports)} unused import(s)")
    
    if len(unused_by_file) > 5:
        print(f"  {Colors.DIM}... and {len(unused_by_file) - 5} more files{Colors.RESET}")
    
    print()
    print("What would you like to do?")
    print(f"  {Colors.GREEN}1.{Colors.RESET} Remove ALL unused imports (with backup)")
    print(f"  {Colors.GREEN}2.{Colors.RESET} Select imports interactively")
    print(f"  {Colors.GREEN}3.{Colors.RESET} View detailed report")
    print(f"  {Colors.RED}0.{Colors.RESET} Cancel")
    
    while True:
        choice = input(f"\n{Colors.CYAN}Choice [0-3]:{Colors.RESET} ").strip()
        if choice in ['0', '1', '2', '3']:
            break
        print(f"{Colors.RED}Invalid choice.{Colors.RESET}")
    
    if choice == '0':
        return
    
    if choice == '3':
        clear_screen()
        print_main_banner()
        show_unused_imports_report(unused_by_file)
        input(f"\n{Colors.DIM}Press Enter to continue...{Colors.RESET}")
        return
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    home_dir = Path.home()
    backup_dir = home_dir / '.config' / 'dotfiles' / 'unused-imports' / timestamp
    backup_dir.mkdir(parents=True, exist_ok=True)
    
    if choice == '1':
        print(f"\n{Colors.YELLOW}⚠️  This will remove {total_unused} imports from {len(unused_by_file)} files{Colors.RESET}")
        print(f"{Colors.CYAN}Backups will be saved to:{Colors.RESET} {backup_dir}")
        confirm = input(f"\n{Colors.BOLD}Proceed? [y/N]:{Colors.RESET} ").strip().lower()
        
        if confirm not in ['y', 'yes']:
            print(f"{Colors.YELLOW}Operation cancelled.{Colors.RESET}")
            time.sleep(1)
            return
        
        all_imports = [(fp, imp) for fp, imports in unused_by_file.items() for imp in imports]
        files_modified, imports_removed = remove_selected_imports(all_imports, backup_dir)
        
        print(f"\n{Colors.GREEN}{Colors.BOLD}✅ COMPLETE!{Colors.RESET}")
        print("=" * 70)
        print(f"  Files modified: {files_modified}")
        print(f"  Imports removed: {imports_removed}")
        print(f"  Backup location: {backup_dir}")
        
    elif choice == '2':
        selected_imports = interactive_select_unused_imports(unused_by_file)
        
        if not selected_imports:
            print(f"\n{Colors.YELLOW}No imports selected.{Colors.RESET}")
            time.sleep(1)
            return
        
        clear_screen()
        print_main_banner()
        print(f"{Colors.CYAN}{Colors.BOLD}REMOVAL SUMMARY{Colors.RESET}")
        print("=" * 70)
        print(f"\n{Colors.YELLOW}Selected {len(selected_imports)} import(s) for removal{Colors.RESET}")
        print(f"{Colors.CYAN}Backups will be saved to:{Colors.RESET} {backup_dir}")
        
        confirm = input(f"\n{Colors.BOLD}Proceed? [y/N]:{Colors.RESET} ").strip().lower()
        
        if confirm not in ['y', 'yes']:
            print(f"{Colors.YELLOW}Operation cancelled.{Colors.RESET}")
            time.sleep(1)
            return
        
        files_modified, imports_removed = remove_selected_imports(selected_imports, backup_dir)
        
        print(f"\n{Colors.GREEN}{Colors.BOLD}✅ COMPLETE!{Colors.RESET}")
        print("=" * 70)
        print(f"  Files modified: {files_modified}")
        print(f"  Imports removed: {imports_removed}")
        print(f"  Backup location: {backup_dir}")
    
    input(f"\n{Colors.DIM}Press Enter to continue...{Colors.RESET}")

def run_analyzer_interactive(base_path: Path, file_types: List[str], exclude_dirs: Set[str]):
    analyzer = UnusedAnalyzer(
        base_path=base_path,
        file_types=file_types,
        exclude_dirs=exclude_dirs,
        exclude_files=[],
        exclude_patterns=[]
    )
    
    print(f"{Colors.CYAN}🔍 Scanning: {base_path}{Colors.RESET}")
    print(f"📁 Extensions: {', '.join(file_types)}")
    print(f"📄 Found {len(analyzer.all_files)} files")
    print()
    
    while True:
        show_analyzer_menu()
        choice = input(f"{Colors.CYAN}Select option [0-9]:{Colors.RESET} ").strip()
        
        if choice == '0':
            return
        elif choice == '1':
            unused_files, uncertain = analyzer.find_unused_files()
            print(f"\n{Colors.YELLOW}Found {len(unused_files)} unused files{Colors.RESET}")
            for f in unused_files[:10]:
                print(f"  {Colors.RED}✗{Colors.RESET} {f['file']}")
            if len(unused_files) > 10:
                print(f"  {Colors.DIM}... and {len(unused_files) - 10} more{Colors.RESET}")
            input(f"\n{Colors.DIM}Press Enter to continue...{Colors.RESET}")
        elif choice == '2':
            unused_imports = analyzer.find_unused_imports()
            interactive_cleanup_imports(unused_imports, False)
            input(f"\n{Colors.DIM}Press Enter to continue...{Colors.RESET}")
        elif choice == '3':
            unused_exports = analyzer.find_unused_exports()
            print(f"\n{Colors.YELLOW}Found {len(unused_exports)} unused exports{Colors.RESET}")
            for exp in unused_exports[:10]:
                print(f"  {Colors.RED}✗{Colors.RESET} {exp['file']}: {exp['export_name']}")
            if len(unused_exports) > 10:
                print(f"  {Colors.DIM}... and {len(unused_exports) - 10} more{Colors.RESET}")
            input(f"\n{Colors.DIM}Press Enter to continue...{Colors.RESET}")
        elif choice == '4':
            print(f"{Colors.BLUE}Running complete analysis...{Colors.RESET}\n")
            unused_files, _ = analyzer.find_unused_files()
            unused_imports = analyzer.find_unused_imports()
            unused_exports = analyzer.find_unused_exports()
            
            print(f"\n{Colors.CYAN}{Colors.BOLD}COMPLETE ANALYSIS RESULTS{Colors.RESET}")
            print("=" * 70)
            print(f"  Unused files: {len(unused_files)}")
            print(f"  Unused imports: {len(unused_imports)}")
            print(f"  Unused exports: {len(unused_exports)}")
            input(f"\n{Colors.DIM}Press Enter to continue...{Colors.RESET}")
        elif choice == '5':
            print(f"{Colors.YELLOW}Revert not yet implemented{Colors.RESET}")
            time.sleep(1)
        elif choice == '6':
            print(f"\n{Colors.CYAN}Configuration:{Colors.RESET}")
            print(f"  Path: {base_path}")
            print(f"  Types: {', '.join(file_types)}")
            print(f"  Excluded dirs: {', '.join(list(exclude_dirs)[:5])}")
            input(f"\n{Colors.DIM}Press Enter to continue...{Colors.RESET}")
        elif choice == '7':
            clear_screen()
            print_main_banner()
            print(f"{Colors.CYAN}{Colors.BOLD}DUPLICATE FILE DETECTOR{Colors.RESET}")
            print("=" * 70)
            print()
            
            detector = DuplicateDetector(base_path, exclude_dirs)
            duplicates = detector.find_duplicates()
            
            if duplicates:
                interactive_handle_duplicates(detector, duplicates, dry_run=False)
            
            input(f"\n{Colors.DIM}Press Enter to continue...{Colors.RESET}")
        elif choice == '8':
            run_comprehensive_import_check(base_path, exclude_dirs)
        elif choice == '9':
            run_package_cleanup(base_path, exclude_dirs)
        else:
            print(f"{Colors.RED}Invalid option{Colors.RESET}")
            time.sleep(1)

def main():
    parser = argparse.ArgumentParser(description='Interactive Developer Toolkit', add_help=False)
    
    parser.add_argument('--migrate', '-m', action='store_true', help='Launch UI migration tool')
    parser.add_argument('--analyze', '-a', action='store_true', help='Launch code analyzer')
    
    parser.add_argument('--dry-run', '-d', action='store_true', help='Preview changes')
    parser.add_argument('--kebab', '-k', action='store_true', help='Convert to kebab-case')
    parser.add_argument('--barrel', '-b', action='store_true', help='Create barrel file')
    parser.add_argument('--barrel-shared', '-bs', action='store_true', help='Create shared barrel')
    parser.add_argument('--source-path', default='src/components/ui', help='Source path')
    parser.add_argument('--target-path', default='src/shared/components/ui', help='Target path')
    parser.add_argument('--cleanup', action='store_true', help='Cleanup source directory')
    
    parser.add_argument('--path', default='.', help='Base directory for analysis')
    parser.add_argument('--type', choices=['typescript', 'javascript', 'python', 'all'], 
                       default='all', help='File type to analyze')
    parser.add_argument('--exclude-dir', action='append', default=[], help='Exclude directories')
    parser.add_argument('--exclude-file', action='append', default=[], help='Exclude files')
    parser.add_argument('--json', action='store_true', help='JSON output')
    parser.add_argument('--non-interactive', action='store_true', help='Non-interactive mode')
    
    parser.add_argument('--version', action='store_true', help='Show version')
    parser.add_argument('--help', '-h', action='store_true', help='Show help')
    
    if len(sys.argv) == 1:
        while True:
            show_main_menu()
            choice = input(f"{Colors.CYAN}Select option [0-3]:{Colors.RESET} ").strip()
            
            if choice == '0':
                print(f"{Colors.GREEN}Goodbye!{Colors.RESET}")
                break
            elif choice == '1':
                run_migration_interactive()
            elif choice == '2':
                base_path = Path('.').resolve()
                file_types = SUPPORTED_EXTENSIONS['all']
                exclude_dirs = DEFAULT_EXCLUDE_DIRS
                run_analyzer_interactive(base_path, file_types, exclude_dirs)
            elif choice == '3':
                clear_screen()
                print_main_banner()
                print(f"{Colors.CYAN}Choose help topic:{Colors.RESET}\n")
                print(f"  {Colors.GREEN}1.{Colors.RESET} UI Migration Help")
                print(f"  {Colors.GREEN}2.{Colors.RESET} Code Analyzer Help")
                help_choice = input(f"\n{Colors.CYAN}Choice [1-2]:{Colors.RESET} ").strip()
                if help_choice == '1':
                    print_migration_help()
                elif help_choice == '2':
                    print_analyzer_help()
            else:
                print(f"{Colors.RED}Invalid option{Colors.RESET}")
                time.sleep(1)
        return
    
    args = parser.parse_args()
    
    if args.version:
        clear_screen()
        print_main_banner()
        print(f"{Colors.CYAN}Version {VERSION}{Colors.RESET}")
        return
    
    if args.help:
        clear_screen()
        print_main_banner()
        print(f"{Colors.BRIGHT}Interactive Developer Toolkit{Colors.RESET}\n")
        print(f"Usage: ui [--migrate|--analyze] [options]\n")
        print(f"{Colors.CYAN}Main Commands:{Colors.RESET}")
        print(f"  --migrate, -m     Launch UI migration tool")
        print(f"  --analyze, -a     Launch code analyzer")
        print(f"  --help, -h        Show this help")
        print(f"  --version         Show version\n")
        print(f"Run 'ui' without arguments for interactive mode")
        return
    
    if args.migrate:
        if args.non_interactive:
            run_migration(args.source_path, args.target_path, args.kebab, 
                         args.barrel, args.barrel_shared, args.cleanup, args.dry_run)
        else:
            run_migration_interactive()
    elif args.analyze:
        base_path = Path(args.path).resolve()
        file_types = SUPPORTED_EXTENSIONS[args.type]
        exclude_dirs = DEFAULT_EXCLUDE_DIRS | set(args.exclude_dir)
        
        if args.non_interactive:
            analyzer = UnusedAnalyzer(base_path, file_types, exclude_dirs, 
                                     args.exclude_file, [])
            unused_imports = analyzer.find_unused_imports()
            
            if args.json:
                report = {
                    'unused_imports': [
                        {
                            'file': str(imp.file_path.relative_to(base_path)),
                            'import_name': imp.import_name,
                            'import_path': imp.import_path,
                            'line_number': imp.line_number
                        }
                        for imp in unused_imports
                    ]
                }
                print(json.dumps(report, indent=2))
            else:
                imports_by_file = defaultdict(list)
                for imp in unused_imports:
                    imports_by_file[imp.file_path].append(imp)
                show_unused_imports_report(imports_by_file)
        else:
            run_analyzer_interactive(base_path, file_types, exclude_dirs)
    else:
        print(f"{Colors.YELLOW}No command specified. Run 'ui --help' or just 'ui' for interactive mode.{Colors.RESET}")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Operation cancelled.{Colors.RESET}")
    except Exception as e:
        print(f"\n{Colors.RED}Error: {e}{Colors.RESET}")
        sys.exit(1)
