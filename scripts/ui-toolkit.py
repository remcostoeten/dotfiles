#!/usr/bin/env python3

import os
import re
import shutil
import argparse
import json
import sys
import time
import ast
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
        choice = input(f"{Colors.CYAN}Select option [0-6]:{Colors.RESET} ").strip()
        
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
