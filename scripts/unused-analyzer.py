#!/usr/bin/env python3

import os
import sys
import re
import json
import argparse
import shutil
import ast
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Set, Tuple, Optional, NamedTuple
from dataclasses import dataclass
from collections import defaultdict

VERSION = "2.0.0"

DEFAULT_EXCLUDE_DIRS = {
    "dist", "build", "tmp", ".next", "node_modules", ".git", 
    ".unused", ".unused_backups", "coverage", "__pycache__",
    ".pytest_cache", ".venv", "env", "venv"
}

BACKUP_DIR = ".unused_backups"
QUARANTINE_DIR = ".unused"

# Support for multiple file types
SUPPORTED_EXTENSIONS = {
    'typescript': ['ts', 'tsx'],
    'javascript': ['js', 'jsx', 'mjs', 'cjs'],
    'python': ['py'],
    'all': ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py']
}

@dataclass
class ImportInfo:
    """Information about an import statement"""
    source_file: Path
    imported_name: str
    import_path: str
    import_type: str  # 'default', 'named', 'namespace', 'side-effect'
    line_number: int

@dataclass
class ExportInfo:
    """Information about an export statement"""
    source_file: Path
    exported_name: str
    export_type: str  # 'default', 'named', 'function', 'class', 'const', 'type'
    line_number: int

@dataclass
class UnusedImport:
    """Information about an unused import"""
    file_path: Path
    import_name: str
    import_path: str
    line_number: int
    import_type: str

class Colors:
    """ANSI color codes for terminal output"""
    RESET = '\033[0m'
    BOLD = '\033[1m'
    RED = '\033[31m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    BLUE = '\033[34m'
    MAGENTA = '\033[35m'
    CYAN = '\033[36m'
    WHITE = '\033[37m'

def print_banner():
    print(f"{Colors.CYAN}{Colors.BOLD}")
    print('╔════════════════════════════════════════════════════════════════════════════════╗')
    print('║                                                                                ║')
    print('║     ██╗   ██╗███╗   ██╗██╗   ██╗███████╗███████╗██████╗                      ║')
    print('║     ██║   ██║████╗  ██║██║   ██║██╔════╝██╔════╝██╔══██╗                     ║')
    print('║     ██║   ██║██╔██╗ ██║██║   ██║███████╗█████╗  ██║  ██║                     ║')
    print('║     ██║   ██║██║╚██╗██║██║   ██║╚════██║██╔══╝  ██║  ██║                     ║')
    print('║     ╚██████╔╝██║ ╚████║╚██████╔╝███████║███████╗██████╔╝                     ║')
    print('║      ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ ╚══════╝╚══════╝╚═════╝                      ║')
    print('║                                                                                ║')
    print('║               Advanced Code Analysis & Cleanup Tool v2.0                      ║')
    print('║           • Unused Files • Unused Imports • Interactive Cleanup              ║')
    print('║                                                                                ║')
    print('╚════════════════════════════════════════════════════════════════════════════════╝')
    print(f"{Colors.RESET}\n")

def show_main_menu():
    """Display the main interactive menu"""
    print(f"{Colors.CYAN}{Colors.BOLD}🚀 UNUSED ANALYZER - MAIN MENU{Colors.RESET}")
    print("=" * 60)
    print()
    print("Select analysis type:")
    print(f"  {Colors.GREEN}1.{Colors.RESET} Find unused files")
    print(f"  {Colors.GREEN}2.{Colors.RESET} Find unused imports")
    print(f"  {Colors.GREEN}3.{Colors.RESET} Find unused exports")
    print(f"  {Colors.GREEN}4.{Colors.RESET} Complete analysis (all of the above)")
    print(f"  {Colors.GREEN}5.{Colors.RESET} Revert previous changes")
    print(f"  {Colors.GREEN}6.{Colors.RESET} Show configuration")
    print(f"  {Colors.RED}0.{Colors.RESET} Exit")
    print()

def parse_args():
    parser = argparse.ArgumentParser(
        description="Advanced unused code analyzer with interactive cleanup",
        add_help=False
    )
    parser.add_argument("--path", default=".", help="Base directory to scan")
    parser.add_argument("--type", choices=['typescript', 'javascript', 'python', 'all'], 
                       default='all', help="File type to analyze")
    parser.add_argument("--exclude-file", action="append", default=[], 
                       help="Exclude specific file names")
    parser.add_argument("--exclude-dir", action="append", default=[], 
                       help="Exclude directory names")
    parser.add_argument("--exclude-pattern", action="append", default=[], 
                       help="Exclude patterns (regex)")
    parser.add_argument("--dry-run", action="store_true", 
                       help="Report only, no changes")
    parser.add_argument("--non-interactive", action="store_true", 
                       help="Disable interactive mode")
    parser.add_argument("--json", action="store_true", help="Output JSON report")
    parser.add_argument("--report", help="Save report to JSON file")
    parser.add_argument("--revert", nargs="?", const="latest", 
                       help="Revert last changes")
    parser.add_argument("--version", action="store_true", help="Show version")
    parser.add_argument("--help", action="store_true", help="Show help")
    
    return parser.parse_args()

class JavaScriptAnalyzer:
    """Analyzer for JavaScript/TypeScript files"""
    
    @staticmethod
    def extract_imports(file_path: Path) -> List[ImportInfo]:
        """Extract all import statements from a JS/TS file"""
        try:
            content = file_path.read_text(encoding='utf-8')
        except Exception:
            return []
        
        imports = []
        lines = content.split('\n')
        
        # Patterns for different import types
        patterns = [
            # import { named } from 'module'
            (r"import\s+\{\s*([^}]+)\s*\}\s+from\s+['\"]([^'\"]+)['\"]", 'named'),
            # import defaultName from 'module'
            (r"import\s+(\w+)\s+from\s+['\"]([^'\"]+)['\"]", 'default'),
            # import * as namespace from 'module'
            (r"import\s+\*\s+as\s+(\w+)\s+from\s+['\"]([^'\"]+)['\"]", 'namespace'),
            # import 'module' (side effect)
            (r"import\s+['\"]([^'\"]+)['\"]", 'side-effect'),
            # const x = require('module')
            (r"(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['\"]([^'\"]+)['\"]\s*\)", 'require'),
        ]
        
        for line_num, line in enumerate(lines, 1):
            for pattern, import_type in patterns:
                matches = re.finditer(pattern, line)
                for match in matches:
                    if import_type == 'named':
                        # Handle multiple named imports
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
        """Extract all export statements from a JS/TS file"""
        try:
            content = file_path.read_text(encoding='utf-8')
        except Exception:
            return []
        
        exports = []
        lines = content.split('\n')
        
        # Patterns for different export types
        patterns = [
            # export default
            (r"export\s+default\s+(\w+)", 'default'),
            # export const/let/var name
            (r"export\s+(?:const|let|var)\s+(\w+)", 'const'),
            # export function name
            (r"export\s+function\s+(\w+)", 'function'),
            # export class name
            (r"export\s+class\s+(\w+)", 'class'),
            # export type/interface name
            (r"export\s+(?:type|interface)\s+(\w+)", 'type'),
            # export { named }
            (r"export\s+\{\s*([^}]+)\s*\}", 'named'),
        ]
        
        for line_num, line in enumerate(lines, 1):
            for pattern, export_type in patterns:
                matches = re.finditer(pattern, line)
                for match in matches:
                    if export_type == 'named':
                        # Handle multiple named exports
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
        """Find all usages of an identifier in a file"""
        try:
            content = file_path.read_text(encoding='utf-8')
        except Exception:
            return []
        
        # Look for the identifier as a word (not part of another word)
        pattern = rf'\b{re.escape(identifier)}\b'
        lines = content.split('\n')
        usage_lines = []
        
        for line_num, line in enumerate(lines, 1):
            if re.search(pattern, line):
                # Exclude the import/export lines themselves
                if not (line.strip().startswith('import') or line.strip().startswith('export')):
                    usage_lines.append(line_num)
        
        return usage_lines

class UnusedAnalyzer:
    """Main analyzer class that coordinates different analysis types"""
    
    def __init__(self, base_path: Path, file_types: List[str], exclude_dirs: Set[str], 
                 exclude_files: List[str], exclude_patterns: List[str]):
        self.base_path = base_path
        self.file_types = file_types
        self.exclude_dirs = exclude_dirs
        self.exclude_files = exclude_files
        self.exclude_patterns = [re.compile(p) for p in exclude_patterns]
        self.all_files = self._find_files()
    
    def _find_files(self) -> List[Path]:
        """Find all files matching the criteria"""
        files = []
        
        for root, dirs, filenames in os.walk(self.base_path):
            # Filter out excluded directories
            dirs[:] = [d for d in dirs if d not in self.exclude_dirs]
            
            for filename in filenames:
                if filename in self.exclude_files:
                    continue
                
                file_path = Path(root) / filename
                rel_path = file_path.relative_to(self.base_path)
                
                # Check exclude patterns
                if any(pattern.search(str(rel_path)) for pattern in self.exclude_patterns):
                    continue
                
                # Check file extension
                if any(filename.endswith(f'.{ext}') for ext in self.file_types):
                    files.append(file_path)
        
        return files
    
    def find_unused_imports(self) -> List[UnusedImport]:
        """Find all unused imports across the codebase"""
        unused_imports = []
        
        print(f"{Colors.BLUE}🔍 Analyzing imports in {len(self.all_files)} files...{Colors.RESET}")
        
        for file_path in self.all_files:
            if file_path.suffix in ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']:
                imports = JavaScriptAnalyzer.extract_imports(file_path)
                
                for import_info in imports:
                    if import_info.import_type == 'side-effect':
                        continue  # Side-effect imports are always considered used
                    
                    # Check if the imported name is used in the file
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
        """Find exports that are not imported anywhere"""
        unused_exports = []
        
        print(f"{Colors.BLUE}🔍 Analyzing exports across {len(self.all_files)} files...{Colors.RESET}")
        
        # First, collect all imports
        all_imports = {}
        for file_path in self.all_files:
            if file_path.suffix in ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']:
                imports = JavaScriptAnalyzer.extract_imports(file_path)
                for import_info in imports:
                    key = (import_info.import_path, import_info.imported_name)
                    if key not in all_imports:
                        all_imports[key] = []
                    all_imports[key].append(import_info)
        
        # Then check each export
        for file_path in self.all_files:
            if file_path.suffix in ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']:
                exports = JavaScriptAnalyzer.extract_exports(file_path)
                
                for export_info in exports:
                    # Look for imports of this export
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
        """Find completely unused files"""
        unused = []
        uncertain = []
        
        print(f"{Colors.BLUE}🔍 Analyzing file dependencies...{Colors.RESET}")
        
        for file_path in self.all_files:
            if file_path.name in ['index.ts', 'index.tsx', 'index.js', 'index.jsx']:
                continue  # Skip index files
            
            # Check if this file is imported anywhere
            rel_path = file_path.relative_to(self.base_path)
            is_imported = self._is_file_imported(file_path)
            
            # Check if file has exports
            if file_path.suffix in ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']:
                exports = JavaScriptAnalyzer.extract_exports(file_path)
                has_exports = len(exports) > 0
            else:
                has_exports = False  # For other file types, assume no exports
            
            if not is_imported and has_exports:
                unused.append({
                    'file': str(rel_path),
                    'reason': 'No imports found',
                    'has_exports': has_exports
                })
            elif is_imported and has_exports:
                uncertain.append({
                    'file': str(rel_path),
                    'reason': 'Has imports but needs review',
                    'has_exports': has_exports
                })
        
        return unused, uncertain
    
    def _is_file_imported(self, target_file: Path) -> bool:
        """Check if a file is imported anywhere in the codebase"""
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
                imports = JavaScriptAnalyzer.extract_imports(file_path)
                for import_info in imports:
                    if import_info.import_path in possible_import_paths:
                        return True
        
        return False

def interactive_cleanup_imports(unused_imports: List[UnusedImport], dry_run: bool) -> bool:
    """Interactive cleanup for unused imports"""
    if not unused_imports:
        print(f"{Colors.GREEN}✅ No unused imports found!{Colors.RESET}")
        return True
    
    print(f"{Colors.YELLOW}📋 Found {len(unused_imports)} unused imports{Colors.RESET}")
    print()
    
    # Group by file for better presentation
    imports_by_file = defaultdict(list)
    for imp in unused_imports:
        imports_by_file[imp.file_path].append(imp)
    
    print("What would you like to do?")
    print(f"  {Colors.GREEN}1.{Colors.RESET} Remove all unused imports")
    print(f"  {Colors.GREEN}2.{Colors.RESET} Review each file individually")
    print(f"  {Colors.GREEN}3.{Colors.RESET} Show detailed report only")
    print(f"  {Colors.RED}4.{Colors.RESET} Cancel")
    
    while True:
        choice = input(f"\n{Colors.CYAN}Choice [1-4]:{Colors.RESET} ").strip()
        if choice in ['1', '2', '3', '4']:
            break
        print(f"{Colors.RED}Invalid choice. Please enter 1, 2, 3, or 4.{Colors.RESET}")
    
    if choice == '4':
        print(f"{Colors.YELLOW}Operation cancelled.{Colors.RESET}")
        return False
    
    if choice == '3':
        _show_unused_imports_report(imports_by_file)
        return True
    
    if choice == '1':
        return _remove_all_unused_imports(imports_by_file, dry_run)
    
    if choice == '2':
        return _review_imports_individually(imports_by_file, dry_run)
    
    return True

def _show_unused_imports_report(imports_by_file: Dict[Path, List[UnusedImport]]):
    """Show detailed report of unused imports"""
    print(f"\n{Colors.CYAN}{Colors.BOLD}📊 UNUSED IMPORTS REPORT{Colors.RESET}")
    print("=" * 60)
    
    for file_path, imports in imports_by_file.items():
        rel_path = file_path.relative_to(Path.cwd()) if file_path.is_absolute() else file_path
        print(f"\n{Colors.YELLOW}📄 {rel_path}{Colors.RESET}")
        
        for imp in imports:
            print(f"  {Colors.RED}✗{Colors.RESET} Line {imp.line_number}: "
                  f"{imp.import_name} from '{imp.import_path}' ({imp.import_type})")

def _remove_all_unused_imports(imports_by_file: Dict[Path, List[UnusedImport]], dry_run: bool) -> bool:
    """Remove all unused imports from files"""
    if dry_run:
        print(f"\n{Colors.BLUE}🔍 DRY RUN: Would remove {sum(len(imports) for imports in imports_by_file.values())} unused imports{Colors.RESET}")
        _show_unused_imports_report(imports_by_file)
        return True
    
    print(f"\n{Colors.YELLOW}⚠️  This will modify {len(imports_by_file)} files.{Colors.RESET}")
    confirm = input(f"{Colors.CYAN}Continue? [y/N]:{Colors.RESET} ").strip().lower()
    
    if confirm not in ['y', 'yes']:
        print(f"{Colors.YELLOW}Operation cancelled.{Colors.RESET}")
        return False
    
    # Create backup
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = Path(BACKUP_DIR) / f"imports_{timestamp}"
    backup_dir.mkdir(parents=True, exist_ok=True)
    
    files_modified = 0
    imports_removed = 0
    
    for file_path, imports in imports_by_file.items():
        try:
            # Backup original file
            rel_path = file_path.relative_to(Path.cwd()) if file_path.is_absolute() else file_path
            backup_file = backup_dir / rel_path
            backup_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(file_path, backup_file)
            
            # Read file content
            content = file_path.read_text(encoding='utf-8')
            lines = content.split('\n')
            
            # Sort imports by line number (descending) to avoid index issues
            sorted_imports = sorted(imports, key=lambda x: x.line_number, reverse=True)
            
            # Remove import lines
            for imp in sorted_imports:
                if imp.line_number <= len(lines):
                    # Check if this line contains the import
                    line = lines[imp.line_number - 1]
                    if imp.import_name in line or imp.import_path in line:
                        lines.pop(imp.line_number - 1)
                        imports_removed += 1
            
            # Write back the modified content
            file_path.write_text('\n'.join(lines), encoding='utf-8')
            files_modified += 1
            
            print(f"  {Colors.GREEN}✓{Colors.RESET} Modified {rel_path}")
            
        except Exception as e:
            print(f"  {Colors.RED}✗{Colors.RESET} Error processing {file_path}: {e}")
    
    print(f"\n{Colors.GREEN}✅ Success!{Colors.RESET}")
    print(f"  Files modified: {files_modified}")
    print(f"  Imports removed: {imports_removed}")
    print(f"  Backup saved: {backup_dir}")
    
    return True

def _review_imports_individually(imports_by_file: Dict[Path, List[UnusedImport]], dry_run: bool) -> bool:
    """Review and remove imports file by file"""
    print(f"\n{Colors.CYAN}🔍 Individual file review{Colors.RESET}")
    
    for file_path, imports in imports_by_file.items():
        rel_path = file_path.relative_to(Path.cwd()) if file_path.is_absolute() else file_path
        print(f"\n{Colors.YELLOW}📄 {rel_path}{Colors.RESET} ({len(imports)} unused imports)")
        
        for imp in imports:
            print(f"  Line {imp.line_number}: {imp.import_name} from '{imp.import_path}'")
        
        print(f"\nOptions:")
        print(f"  {Colors.GREEN}1.{Colors.RESET} Remove all from this file")
        print(f"  {Colors.GREEN}2.{Colors.RESET} Skip this file")
        print(f"  {Colors.GREEN}3.{Colors.RESET} Show file content")
        print(f"  {Colors.RED}4.{Colors.RESET} Exit review")
        
        while True:
            choice = input(f"{Colors.CYAN}Choice [1-4]:{Colors.RESET} ").strip()
            if choice in ['1', '2', '3', '4']:
                break
            print(f"{Colors.RED}Invalid choice.{Colors.RESET}")
        
        if choice == '4':
            break
        elif choice == '3':
            _show_file_content(file_path, imports)
        elif choice == '1' and not dry_run:
            # Remove imports from this file (implementation similar to _remove_all_unused_imports)
            pass
    
    return True

def _show_file_content(file_path: Path, imports: List[UnusedImport]):
    """Show file content with highlighted unused imports"""
    try:
        content = file_path.read_text(encoding='utf-8')
        lines = content.split('\n')
        
        print(f"\n{Colors.CYAN}📄 File content:{Colors.RESET}")
        print("-" * 60)
        
        unused_lines = {imp.line_number for imp in imports}
        
        for i, line in enumerate(lines, 1):
            if i in unused_lines:
                print(f"{Colors.RED}{i:3d}: {line}{Colors.RESET}")
            else:
                print(f"{i:3d}: {line}")
        
        print("-" * 60)
    except Exception as e:
        print(f"{Colors.RED}Error reading file: {e}{Colors.RESET}")

def main():
    args = parse_args()
    
    if args.version:
        print(f"Unused Analyzer v{VERSION}")
        return
    
    if args.help:
        print_banner()
        print("Advanced unused code analyzer with interactive cleanup")
        print("\nFor detailed usage, run with specific options or use interactive mode.")
        return
    
    # Handle revert
    if args.revert:
        print("Revert functionality not yet implemented in v2.0")
        return
    
    # Set up analysis parameters
    base_path = Path(args.path).resolve()
    if not base_path.exists():
        print(f"{Colors.RED}❌ Path not found: {args.path}{Colors.RESET}")
        return
    
    file_extensions = SUPPORTED_EXTENSIONS[args.type]
    exclude_dirs = DEFAULT_EXCLUDE_DIRS | set(args.exclude_dir)
    
    # Initialize analyzer
    analyzer = UnusedAnalyzer(
        base_path=base_path,
        file_types=file_extensions,
        exclude_dirs=exclude_dirs,
        exclude_files=args.exclude_file,
        exclude_patterns=args.exclude_pattern
    )
    
    print(f"{Colors.CYAN}🔍 Scanning: {base_path}{Colors.RESET}")
    print(f"📁 Extensions: {', '.join(file_extensions)}")
    print(f"📄 Found {len(analyzer.all_files)} files")
    print()
    
    # Interactive or direct mode
    if not args.non_interactive and len(sys.argv) == 1:
        # Interactive mode with main menu
        while True:
            show_main_menu()
            choice = input(f"{Colors.CYAN}Select option [0-6]:{Colors.RESET} ").strip()
            
            if choice == '0':
                print(f"{Colors.GREEN}Goodbye!{Colors.RESET}")
                break
            elif choice == '1':
                unused_files, uncertain_files = analyzer.find_unused_files()
                print(f"Found {len(unused_files)} unused files, {len(uncertain_files)} uncertain")
            elif choice == '2':
                unused_imports = analyzer.find_unused_imports()
                interactive_cleanup_imports(unused_imports, args.dry_run)
            elif choice == '3':
                unused_exports = analyzer.find_unused_exports()
                print(f"Found {len(unused_exports)} unused exports")
            elif choice == '4':
                print("Complete analysis not yet implemented")
            elif choice == '5':
                print("Revert not yet implemented")
            elif choice == '6':
                print(f"Configuration:\n  Path: {base_path}\n  Types: {file_extensions}")
            else:
                print(f"{Colors.RED}Invalid option{Colors.RESET}")
    else:
        # Direct mode - analyze unused imports by default
        unused_imports = analyzer.find_unused_imports()
        
        if args.json:
            report = {
                'unused_imports': [
                    {
                        'file': str(imp.file_path.relative_to(base_path)),
                        'import_name': imp.import_name,
                        'import_path': imp.import_path,
                        'line_number': imp.line_number,
                        'import_type': imp.import_type
                    }
                    for imp in unused_imports
                ],
                'timestamp': datetime.now().isoformat()
            }
            print(json.dumps(report, indent=2))
        elif args.non_interactive:
            # Non-interactive mode - just show the report
            imports_by_file = defaultdict(list)
            for imp in unused_imports:
                imports_by_file[imp.file_path].append(imp)
            _show_unused_imports_report(imports_by_file)
        else:
            interactive_cleanup_imports(unused_imports, args.dry_run)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Operation cancelled by user.{Colors.RESET}")
    except Exception as e:
        print(f"\n{Colors.RED}Error: {e}{Colors.RESET}")
        sys.exit(1)