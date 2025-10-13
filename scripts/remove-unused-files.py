#!/usr/bin/env python3

import os
import sys
import re
import json
import argparse
import shutil
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Set, Tuple, Optional

VERSION = "1.0.0"

DEFAULT_EXCLUDE_DIRS = {"dist", "build", "tmp", ".next", "buildmodules", "node_modules", ".git", ".unused", ".unused_backups"}
BACKUP_DIR = ".unused_backups"
QUARANTINE_DIR = ".unused"

def print_welcome():
    print("\033[36m\033[1m")
    print('╔════════════════════════════════════════════════════════════════════╗')
    print('║                                                                    ║')
    print('║     ██╗   ██╗███╗   ██╗██╗   ██╗███████╗███████╗██████╗            ║')
    print('║     ██║   ██║████╗  ██║██║   ██║██╔════╝██╔════╝██╔══██╗           ║')
    print('║     ██║   ██║██╔██╗ ██║██║   ██║███████╗█████╗  ██║  ██║           ║')
    print('║     ██║   ██║██║╚██╗██║██║   ██║╚════██║██╔══╝  ██║  ██║           ║')
    print('║     ╚██████╔╝██║ ╚████║╚██████╔╝███████║███████╗██████╔╝           ║')
    print('║      ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ ╚══════╝╚══════╝╚═════╝            ║')
    print('║                                                                    ║')
    print('║          TypeScript/JavaScript Unused File Finder v1.0            ║')
    print('║                                                                    ║')
    print('╚════════════════════════════════════════════════════════════════════╝')
    print("\033[0m\n")
    print("Usage: unused [options]")
    print("Try: unused --help")

def parse_args():
    parser = argparse.ArgumentParser(
        description="Find and remove unused TypeScript/JavaScript files",
        add_help=False
    )
    parser.add_argument("--path", default=".", help="Base directory to scan")
    parser.add_argument("--ext", default="ts,tsx", help="File extensions (comma-separated)")
    parser.add_argument("--exclude-file", action="append", default=[], help="Exclude specific file names")
    parser.add_argument("--exclude-dir", action="append", default=[], help="Exclude directory names")
    parser.add_argument("--exclude-pattern", action="append", default=[], help="Exclude patterns (regex)")
    parser.add_argument("--dry-run", action="store_true", help="Report only, no deletions")
    parser.add_argument("--no-interactive", action="store_true", help="Disable interactive prompts")
    parser.add_argument("--json", action="store_true", help="Output JSON report")
    parser.add_argument("--report", help="Save report to JSON file")
    parser.add_argument("--revert", nargs="?", const="latest", help="Revert last deletion")
    parser.add_argument("--version", action="store_true", help="Show version")
    parser.add_argument("--help", action="store_true", help="Show help")
    
    return parser.parse_args()

def show_help():
    help_text = """
unused - Find and remove unused TypeScript/JavaScript files

USAGE:
    unused [OPTIONS]

OPTIONS:
    --path <dir>              Base directory (default: current directory)
    --ext <extensions>        File extensions to scan (default: ts,tsx)
    --exclude-file <name>     Exclude specific file by name (can repeat)
    --exclude-dir <name>      Exclude directory by name (can repeat)
    --exclude-pattern <regex> Exclude pattern (regex, can repeat)
    --dry-run                 Report only, no deletions
    --no-interactive          Disable prompts, just output report
    --json                    Print JSON report
    --report <file.json>      Save results to file
    --revert [timestamp]      Revert last deletion (or specific timestamp)
                              Must be run from the same directory where files were deleted
    --version                 Show version
    --help                    Show this help

EXAMPLES:
    unused
    unused --path ./src --ext ts,tsx,js
    unused --exclude-dir tests --dry-run
    unused --revert                          # Revert in current directory
    unused --revert --path ./src             # Revert in specific directory
    """
    print(help_text)

def find_files(base_path: str, extensions: List[str], exclude_dirs: Set[str], 
               exclude_files: List[str], exclude_patterns: List[str]) -> List[Path]:
    base = Path(base_path).resolve()
    files = []
    
    compiled_patterns = [re.compile(pattern) for pattern in exclude_patterns]
    
    for root, dirs, filenames in os.walk(base):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for filename in filenames:
            if filename in exclude_files:
                continue
                
            file_path = Path(root) / filename
            rel_path = file_path.relative_to(base)
            
            if any(pattern.search(str(rel_path)) for pattern in compiled_patterns):
                continue
            
            if any(filename.endswith(f".{ext}") for ext in extensions):
                files.append(file_path)
    
    return files

def extract_exports(file_path: Path) -> Dict[str, List[str]]:
    try:
        content = file_path.read_text(encoding="utf-8")
    except:
        return {"default": [], "named": [], "star": []}
    
    exports = {"default": [], "named": [], "star": []}
    
    export_default = re.findall(r'export\s+default\s+', content)
    if export_default:
        exports["default"].append("default")
    
    named_exports = re.findall(r'export\s+(?:const|let|var|function|class|type|interface|enum)\s+(\w+)', content)
    exports["named"].extend(named_exports)
    
    export_braces = re.findall(r'export\s+\{([^}]+)\}', content)
    for match in export_braces:
        names = [n.strip().split()[0] for n in match.split(",")]
        exports["named"].extend(names)
    
    star_exports = re.findall(r'export\s+\*\s+from\s+["\']([^"\']+)["\']', content)
    exports["star"].extend(star_exports)
    
    return exports

def find_imports(base_path: Path, target_file: Path, all_files: List[Path]) -> Set[str]:
    imports = set()
    rel_target = target_file.relative_to(base_path)
    
    target_no_ext = str(rel_target.with_suffix(""))
    possible_imports = [
        target_no_ext,
        f"./{target_no_ext}",
        f"../{target_no_ext}",
    ]
    
    for file in all_files:
        if file == target_file:
            continue
        
        try:
            content = file.read_text(encoding="utf-8")
        except:
            continue
        
        import_patterns = [
            r'import\s+.*?\s+from\s+["\']([^"\']+)["\']',
            r'require\s*\(\s*["\']([^"\']+)["\']\s*\)',
            r'import\s*\(\s*["\']([^"\']+)["\']\s*\)',
        ]
        
        for pattern in import_patterns:
            matches = re.findall(pattern, content)
            for match in matches:
                normalized = match.replace("\\", "/")
                
                try:
                    importing_dir = file.parent
                    resolved = (importing_dir / match).resolve()
                    target_resolved = target_file.resolve()
                    
                    if resolved == target_resolved or resolved == target_resolved.with_suffix(""):
                        imports.add(str(file.relative_to(base_path)))
                except:
                    pass
    
    return imports

def analyze_files(base_path: Path, files: List[Path]) -> Tuple[List[Dict], List[Dict]]:
    unused = []
    uncertain = []
    
    for file in files:
        if file.name == "index.ts" or file.name == "index.tsx":
            continue
        
        exports = extract_exports(file)
        imports = find_imports(base_path, file, files)
        
        has_exports = (exports["default"] or exports["named"] or exports["star"])
        
        if not imports and has_exports:
            unused.append({
                "file": str(file.relative_to(base_path)),
                "exports": exports
            })
        elif imports and has_exports:
            uncertain.append({
                "file": str(file.relative_to(base_path)),
                "exports": exports,
                "imported_by": list(imports)
            })
    
    return unused, uncertain

def print_report(unused: List[Dict], uncertain: List[Dict]):
    print("\n" + "="*60)
    print("📊 ANALYSIS REPORT")
    print("="*60 + "\n")
    
    if unused:
        print(f"✅ UNUSED FILES ({len(unused)}) - Safe to delete:\n")
        for item in unused:
            print(f"  • {item['file']}")
        print()
    else:
        print("✅ No unused files found.\n")
    
    if uncertain:
        print(f"⚠️  UNCERTAIN FILES ({len(uncertain)}) - Manual review needed:\n")
        for item in uncertain:
            print(f"  • {item['file']}")
            print(f"    Imported by: {', '.join(item['imported_by'][:3])}")
            if len(item['imported_by']) > 3:
                print(f"    ... and {len(item['imported_by']) - 3} more")
        print()
    else:
        print("⚠️  No uncertain files found.\n")

def create_backup(base_path: Path, files: List[str]) -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = base_path / BACKUP_DIR / timestamp
    backup_path.mkdir(parents=True, exist_ok=True)
    
    metadata = {
        "timestamp": timestamp,
        "files": []
    }
    
    for file_rel in files:
        src = base_path / file_rel
        dst = backup_path / file_rel
        
        if src.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            metadata["files"].append(file_rel)
    
    with open(backup_path / "deleted_files.json", "w") as f:
        json.dump(metadata, f, indent=2)
    
    return timestamp

def revert_backup(base_path: Path, timestamp: Optional[str] = None):
    backup_base = base_path / BACKUP_DIR
    
    if not backup_base.exists():
        print(f"❌ No backups found in {base_path}.")
        print(f"💡 Backup directory {BACKUP_DIR}/ not found.")
        print(f"💡 Make sure you're running this command in the same directory where files were deleted.")
        print(f"💡 Or specify the correct path with --path <directory>")
        return
    
    if timestamp == "latest" or timestamp is None:
        backups = sorted([d for d in backup_base.iterdir() if d.is_dir()])
        if not backups:
            print("❌ No backups found.")
            return
        backup_path = backups[-1]
    else:
        backup_path = backup_base / timestamp
        if not backup_path.exists():
            print(f"❌ Backup {timestamp} not found.")
            return
    
    metadata_file = backup_path / "deleted_files.json"
    if not metadata_file.exists():
        print("❌ Backup metadata not found.")
        return
    
    with open(metadata_file) as f:
        metadata = json.load(f)
    
    print(f"♻️  Reverting backup from {metadata['timestamp']}...")
    
    for file_rel in metadata["files"]:
        src = backup_path / file_rel
        dst = base_path / file_rel
        
        if src.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            print(f"  ✓ Restored: {file_rel}")
    
    print(f"\n✅ Reverted {len(metadata['files'])} files.")

def interactive_menu(base_path: Path, unused: List[Dict], dry_run: bool):
    if not unused:
        return
    
    print("\n" + "="*60)
    print("🔧 INTERACTIVE MODE")
    print("="*60 + "\n")
    
    print("What would you like to do with unused files?")
    print("  1. Delete all")
    print("  2. Quarantine (move to .unused/)")
    print("  3. Keep (do nothing)")
    print("  4. Review individually")
    
    choice = input("\nChoice [1-4]: ").strip()
    
    if choice == "1":
        if dry_run:
            print("\n🔍 DRY RUN: Would delete files (no action taken)")
            return
        
        files_to_delete = [item["file"] for item in unused]
        timestamp = create_backup(base_path, files_to_delete)
        
        for item in unused:
            file_path = base_path / item["file"]
            if file_path.exists():
                file_path.unlink()
        
        print(f"\n✅ Deleted {len(unused)} files.")
        print(f"💾 Backup saved: {timestamp}")
        print(f"   To revert: unused --revert")
    
    elif choice == "2":
        quarantine_path = base_path / QUARANTINE_DIR
        quarantine_path.mkdir(exist_ok=True)
        
        for item in unused:
            src = base_path / item["file"]
            dst = quarantine_path / item["file"]
            
            if src.exists():
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(src), str(dst))
        
        print(f"\n✅ Quarantined {len(unused)} files to {QUARANTINE_DIR}/")
    
    elif choice == "3":
        print("\n✅ No changes made.")
    
    elif choice == "4":
        print("\n📝 Individual review not yet implemented.")

def main():
    args = parse_args()
    
    if args.version:
        print(f"unused version {VERSION}")
        return
    
    if args.help:
        show_help()
        return
    
    if args.revert:
        base_path = Path(args.path).resolve()
        revert_backup(base_path, args.revert if args.revert != "latest" else None)
        return
    
    if len(sys.argv) == 1:
        print_welcome()
        return
    
    base_path = Path(args.path).resolve()
    
    if not base_path.exists():
        print(f"❌ Path not found: {args.path}")
        sys.exit(1)
    
    extensions = [e.strip() for e in args.ext.split(",")]
    exclude_dirs = DEFAULT_EXCLUDE_DIRS | set(args.exclude_dir)
    
    print(f"🔍 Scanning {base_path}...")
    print(f"📁 Extensions: {', '.join(extensions)}")
    print(f"🚫 Excluding dirs: {', '.join(sorted(exclude_dirs))}\n")
    
    files = find_files(
        str(base_path),
        extensions,
        exclude_dirs,
        args.exclude_file,
        args.exclude_pattern
    )
    
    print(f"📄 Found {len(files)} files to analyze...\n")
    
    unused, uncertain = analyze_files(base_path, files)
    
    if args.json:
        report = {
            "unused": unused,
            "uncertain": uncertain,
            "timestamp": datetime.now().isoformat()
        }
        print(json.dumps(report, indent=2))
        return
    
    if args.report:
        report = {
            "unused": unused,
            "uncertain": uncertain,
            "timestamp": datetime.now().isoformat()
        }
        with open(args.report, "w") as f:
            json.dump(report, f, indent=2)
        print(f"📊 Report saved to {args.report}")
    
    print_report(unused, uncertain)
    
    if not args.no_interactive and not args.dry_run and unused:
        interactive_menu(base_path, unused, args.dry_run)
    elif args.dry_run and unused:
        print("🔍 DRY RUN: No changes made.")

if __name__ == "__main__":
    main()
