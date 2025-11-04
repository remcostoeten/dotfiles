#!/usr/bin/env python3
"""
License Generator - A beautiful CLI tool for generating software licenses

Features:
- Interactive mode with colored prompts
- CLI mode for quick generation
- Multiple license types (currently MIT)
- Custom date formatting
- Clipboard support
- File output
"""

import argparse
import sys
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

try:
    import pyperclip
    CLIPBOARD_AVAILABLE = True
except ImportError:
    CLIPBOARD_AVAILABLE = False

try:
    from rich.console import Console
    from rich.prompt import Prompt, Confirm
    from rich.panel import Panel
    from rich.table import Table
    from rich.text import Text
    from rich.spinner import Spinner
    from rich import print as rprint
    from rich.live import Live
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False

# Constants
DEFAULT_AUTHOR = "Remco Stoeten"
VERSION = "1.0.0"

# Colors for terminal output (fallback if rich not available)
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def colored_print(text: str, color: str = ""):
    """Print text with color (fallback if rich not available)"""
    if not RICH_AVAILABLE:
        print(f"{color}{text}{Colors.ENDC}")
    else:
        rprint(text)

def get_dutch_date(date_obj: datetime = None) -> str:
    """Get date in Dutch format"""
    if date_obj is None:
        date_obj = datetime.now()
    return date_obj.strftime("%d/%m/%Y")

class LicenseGenerator:
    def __init__(self):
        if RICH_AVAILABLE:
            self.console = Console()
        else:
            self.console = None

    def print_header(self):
        """Print beautiful header"""
        if RICH_AVAILABLE:
            title = Text("License Generator", style="bold blue")
            subtitle = Text("Create beautiful software licenses with ease", style="italic cyan")
            panel = Panel.fit(
                f"{title}\n{subtitle}",
                border_style="blue",
                padding=(1, 2)
            )
            self.console.print(panel)
        else:
            colored_print("License Generator", Colors.BOLD + Colors.BLUE)
            colored_print("Create beautiful software licenses with ease", Colors.CYAN)
            print()

    def print_success(self, message: str):
        """Print success message"""
        if RICH_AVAILABLE:
            self.console.print(f"[+] {message}", style="bold green")
        else:
            colored_print(f"[+] {message}", Colors.GREEN)

    def print_error(self, message: str):
        """Print error message"""
        if RICH_AVAILABLE:
            self.console.print(f"[!] {message}", style="bold red")
        else:
            colored_print(f"[!] {message}", Colors.RED)

    def print_info(self, message: str):
        """Print info message"""
        if RICH_AVAILABLE:
            self.console.print(f"[*] {message}", style="blue")
        else:
            colored_print(f"[*] {message}", Colors.BLUE)

    def show_help(self):
        """Show beautiful help menu"""
        if RICH_AVAILABLE:
            title = Text("License Generator Help", style="bold blue")
            panel = Panel(title, border_style="blue", padding=(0, 1))
            self.console.print(panel)
            print()

            # Interactive mode
            interactive_title = Text("Interactive Mode", style="bold cyan")
            self.console.print(interactive_title)
            self.console.print("Simply run 'license' and answer the prompts interactively.")
            print()

            # CLI mode
            cli_title = Text("CLI Mode", style="bold yellow")
            self.console.print(cli_title)

            table = Table(show_header=True, header_style="bold blue")
            table.add_column("Argument", style="cyan")
            table.add_column("Description", style="white")
            table.add_column("Default", style="green")

            table.add_row("--license", "License type", "mit")
            table.add_row("--date", "Date in DD/MM/YYYY format", "today")
            table.add_row("--author", "Author name", "Remco Stoeten")
            table.add_row("--project", "Project name", "Required in CLI mode")
            table.add_row("--path", "Output file path", "Clipboard only")
            table.add_row("--help, -h", "Show this help", "")

            self.console.print(table)
            print()

            # Examples
            examples_title = Text("Examples", style="bold green")
            self.console.print(examples_title)

            examples = [
                ("Interactive mode", "license"),
                ("Quick MIT license", "license --project 'My App'"),
                ("Custom author and date", "license --project 'My App' --author 'John Doe' --date '01/01/2024'"),
                ("Save to file", "license --project 'My App' --path /path/to/LICENSE.md"),
            ]

            for desc, cmd in examples:
                self.console.print(f"• {desc}: ", style="white", end="")
                self.console.print(cmd, style="cyan bold")
        else:
            colored_print("License Generator Help", Colors.BOLD + Colors.BLUE)
            print()
            colored_print("Interactive Mode:", Colors.BOLD + Colors.CYAN)
            print("  Simply run 'license' and answer the prompts interactively.")
            print()
            colored_print("CLI Mode:", Colors.BOLD + Colors.YELLOW)
            print("  --license    License type (default: mit)")
            print("  --date       Date in DD/MM/YYYY format (default: today)")
            print("  --author     Author name (default: Remco Stoeten)")
            print("  --project    Project name (required in CLI mode)")
            print("  --path       Output file path (default: clipboard only)")
            print("  --help, -h   Show this help")
            print()
            colored_print("Examples:", Colors.BOLD + Colors.GREEN)
            print("  license")
            print("  license --project 'My App'")
            print("  license --project 'My App' --author 'John Doe' --date '01/01/2024'")
            print("  license --project 'My App' --path /path/to/LICENSE.md")

    def generate_mit_license(self, author: str, project: str, date: str) -> str:
        """Generate MIT license text"""
        return f"""MIT License

Copyright (c) {date} {author}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE."""

    def get_license_text(self, license_type: str, **kwargs) -> Optional[str]:
        """Get license text based on type"""
        license_type = license_type.lower()

        if license_type == "mit":
            return self.generate_mit_license(
                author=kwargs.get("author", ""),
                project=kwargs.get("project", ""),
                date=kwargs.get("date", "")
            )
        else:
            return None

    def copy_to_clipboard(self, text: str) -> bool:
        """Copy text to clipboard"""
        if not CLIPBOARD_AVAILABLE:
            return False

        try:
            pyperclip.copy(text)
            return True
        except Exception:
            return False

    def save_to_file(self, content: str, file_path: str) -> bool:
        """Save content to file"""
        try:
            path = Path(file_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding='utf-8')
            return True
        except Exception as e:
            return False

    def run_interactive_mode(self):
        """Run interactive mode with beautiful prompts"""
        self.print_header()

        # License type selection
        if RICH_AVAILABLE:
            license_table = Table(title="Available Licenses")
            license_table.add_column("Option", style="cyan")
            license_table.add_column("License", style="white")
            license_table.add_column("Description", style="green")
            license_table.add_row("1", "MIT", "Permissive free software license")
            self.console.print(license_table)
            print()

        license_choice = Prompt.ask(
            "Select license type",
            choices=["mit"],
            default="mit" if RICH_AVAILABLE else "mit"
        ) if RICH_AVAILABLE else input("Select license type (mit): ").strip().lower() or "mit"

        # Date selection
        use_custom_date = Confirm.ask(
            "Use custom date?",
            default=False
        ) if RICH_AVAILABLE else input("Use custom date? (y/N): ").strip().lower() in ['y', 'yes']

        if use_custom_date:
            if RICH_AVAILABLE:
                custom_date = Prompt.ask("Enter date (DD/MM/YYYY)", default=get_dutch_date())
            else:
                custom_date = input(f"Enter date (DD/MM/YYYY) [{get_dutch_date()}]: ").strip() or get_dutch_date()
        else:
            custom_date = get_dutch_date()

        # Project name
        if RICH_AVAILABLE:
            project_name = Prompt.ask("Enter project name")
        else:
            project_name = input("Enter project name: ").strip()
            while not project_name:
                colored_print("Project name is required!", Colors.RED)
                project_name = input("Enter project name: ").strip()

        # Author name
        use_default_author = Confirm.ask(
            f"Use default author '{DEFAULT_AUTHOR}'?",
            default=True
        ) if RICH_AVAILABLE else input(f"Use default author '{DEFAULT_AUTHOR}'? (Y/n): ").strip().lower() in ['', 'y', 'yes']

        if use_default_author:
            author_name = DEFAULT_AUTHOR
        else:
            if RICH_AVAILABLE:
                author_name = Prompt.ask("Enter author name")
            else:
                author_name = input("Enter author name: ").strip()
                while not author_name:
                    colored_print("Author name is required!", Colors.RED)
                    author_name = input("Enter author name: ").strip()

        # Generate license
        self.print_info("Generating license...")
        license_text = self.get_license_text(license_choice, author=author_name, project=project_name, date=custom_date)

        if not license_text:
            self.print_error("Failed to generate license!")
            return

        # Copy to clipboard
        if self.copy_to_clipboard(license_text):
            self.print_success("License copied to clipboard!")
        else:
            if CLIPBOARD_AVAILABLE:
                self.print_error("Failed to copy to clipboard")
            else:
                self.print_info("Clipboard functionality not available (install pyperclip)")

        # Ask about saving to file
        save_to_file = Confirm.ask(
            "Save license to file?",
            default=False
        ) if RICH_AVAILABLE else input("Save license to file? (y/N): ").strip().lower() in ['y', 'yes']

        if save_to_file:
            if RICH_AVAILABLE:
                file_path = Prompt.ask("Enter file path (including filename)")
            else:
                file_path = input("Enter file path (including filename): ").strip()

            if file_path:
                if self.save_to_file(license_text, file_path):
                    self.print_success(f"License saved to {file_path}")
                else:
                    self.print_error(f"Failed to save license to {file_path}")

        # Show preview
        print()
        if RICH_AVAILABLE:
            preview_panel = Panel(
                license_text,
                title=f"[bold green]{project_name} - {license_choice.upper()} License[/bold green]",
                border_style="green",
                padding=(1, 2)
            )
            self.console.print(preview_panel)
        else:
            colored_print(f"{project_name} - {license_choice.upper()} License", Colors.BOLD + Colors.GREEN)
            print("-" * 50)
            print(license_text)
            print("-" * 50)

    def run_cli_mode(self, args: argparse.Namespace):
        """Run CLI mode"""
        # Validate required arguments
        if not args.project:
            self.print_error("Project name is required in CLI mode. Use --project 'Your Project Name'")
            return

        # Set defaults
        author = args.author or DEFAULT_AUTHOR
        date = args.date or get_dutch_date()
        license_type = args.license or "mit"
        project = args.project

        # Generate license
        license_text = self.get_license_text(license_type, author=author, project=project, date=date)

        if not license_text:
            self.print_error(f"Unsupported license type: {license_type}")
            return

        # Handle output
        if args.path:
            if self.save_to_file(license_text, args.path):
                self.print_success(f"License saved to {args.path}")
            else:
                self.print_error(f"Failed to save license to {args.path}")
        else:
            if self.copy_to_clipboard(license_text):
                self.print_success(f"License for '{project}' copied to clipboard!")
            else:
                if CLIPBOARD_AVAILABLE:
                    self.print_error("Failed to copy to clipboard")
                else:
                    self.print_info("Clipboard functionality not available (install pyperclip)")
                    print("\n" + license_text)

def main():
    """Main entry point"""
    generator = LicenseGenerator()

    # Check for help argument
    if len(sys.argv) > 1 and sys.argv[1] in ['-h', '--help', 'help']:
        generator.show_help()
        return

    # Parse arguments
    parser = argparse.ArgumentParser(
        description="License Generator - Create beautiful software licenses",
        add_help=False  # We handle help ourselves
    )

    parser.add_argument('--license', help='License type (default: mit)')
    parser.add_argument('--date', help='Date in DD/MM/YYYY format (default: today)')
    parser.add_argument('--author', help=f'Author name (default: {DEFAULT_AUTHOR})')
    parser.add_argument('--project', help='Project name (required in CLI mode)')
    parser.add_argument('--path', help='Output file path (default: clipboard only)')

    # If no arguments provided, run interactive mode
    if len(sys.argv) == 1:
        generator.run_interactive_mode()
        return

    # Parse and run CLI mode
    try:
        args = parser.parse_args()
        generator.run_cli_mode(args)
    except SystemExit:
        # argparse calls sys.exit on error, but we want to continue with interactive mode
        generator.print_error("Invalid arguments. Use 'license --help' for usage information.")

if __name__ == "__main__":
    main()