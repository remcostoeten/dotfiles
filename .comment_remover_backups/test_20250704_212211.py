import subprocess
import re
import pyperclip
import argparse
import os
import sys
import time
import json
from datetime import datetime
from pathlib import Path
try:
    from rich.console import Console
    from rich.text import Text
    from rich.panel import Panel
    from rich.table import Table
    from rich.prompt import Prompt
    from rich.live import Live
    from rich.layout import Layout
    from rich.align import Align
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False
    print("Note: Install 'rich' library for enhanced secret display features: pip install rich")


SCRIPT_VERSION = "1.1"
LAST_UPDATED_TIMESTAMP = "2025-07-03 16:39:47 UTC"


class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    PURPLE = '\033[35m'
    YELLOW = '\033[33m'
    CYAN = '\033[36m'
    WHITE = '\033[37m'
    GRAY = '\033[90m'
    BRIGHT_CYAN = '\033[96m'
    BRIGHT_WHITE = '\033[97m'
    ORANGE = '\033[38;5;208m'
    LIGHT_BLUE = '\033[38;5;117m'


CONTENT_WIDTH = 60
STATE_FILE = Path.home() / ".turso_gen_state.json"
CONFIG_FILE = Path.home() / ".turso_gen_config.json"

class SecretDisplay:
    """Class to handle secret display with asterisks and reveal functionality."""
    
    def __init__(self, secret, name="secret"):
        self.secret = secret
        self.name = name
        self.is_revealed = False
    
    def get_masked_display(self):
        """Return the secret masked with asterisks."""
        if len(self.secret) <= 8:
            return "*" * len(self.secret)
        else:

            return f"{self.secret[:4]}{'*' * (len(self.secret) - 8)}{self.secret[-4:]}"
    
    def get_full_display(self):
        """Return the full secret."""
        return self.secret
    
    def get_display(self, reveal=False):
        """Get the display version of the secret."""
        if reveal or self.is_revealed:
            return self.get_full_display()
        return self.get_masked_display()
    
    def toggle_reveal(self):
        """Toggle the reveal state."""
        self.is_revealed = not self.is_revealed
        return self.is_revealed
    
    def create_interactive_display(self):
        """Create an interactive display with reveal option."""
        if RICH_AVAILABLE:
            return self._create_rich_display()
        else:
            return self._create_simple_display()
    
    def _create_rich_display(self):
        """Create a rich-formatted interactive display."""
        from rich.text import Text
        from rich.panel import Panel
        from rich import print as rprint
        
        masked = self.get_masked_display()
        console = Console()
        

        text = Text()
        text.append(f"{self.name.upper()}: ", style="bold white")
        text.append(masked, style="bright_cyan")
        text.append(" ", style="")
        text.append("[Press 'r' to reveal]", style="dim cyan")
        
        return Panel(text, title=f"🔐 {self.name.title()}", border_style="cyan")
    
    def _create_simple_display(self):
        """Create a simple text display."""
        masked = self.get_masked_display()
        return f"{Colors.BOLD}{Colors.ORANGE}{self.name.upper()}: {Colors.ENDC}{Colors.BRIGHT_CYAN}{masked}{Colors.ENDC} {Colors.CYAN}[Press 'r' to reveal]{Colors.ENDC}"
    
    @staticmethod
    def interactive_reveal_prompt(secrets_dict):
        """Interactive prompt to reveal secrets."""
        if not secrets_dict:
            return
            
        print(f"\n{Colors.BOLD}{Colors.CYAN}Secret Management:{Colors.ENDC}")
        print(f"{Colors.GRAY}Press 'r' + Enter to reveal all secrets, or Enter to continue{Colors.ENDC}")
        
        try:
            user_input = input(f"{Colors.BOLD}{Colors.ORANGE}Action (r/Enter): {Colors.ENDC}").strip().lower()
            
            if user_input == 'r':
                print(f"\n{Colors.BOLD}{Colors.OKGREEN}🔓 Secrets Revealed:{Colors.ENDC}")
                for name, secret_obj in secrets_dict.items():
                    print(f"{Colors.BOLD}{Colors.ORANGE}{name.upper()}: {Colors.ENDC}{Colors.BRIGHT_CYAN}{secret_obj.get_full_display()}{Colors.ENDC}")
                

                copy_input = input(f"\n{Colors.BOLD}{Colors.ORANGE}Copy revealed secrets to clipboard? (y/N): {Colors.ENDC}").strip().lower()
                if copy_input == 'y':
                    try:
                        clipboard_content = "\n".join([f"{name.upper()}={secret_obj.get_full_display()}" for name, secret_obj in secrets_dict.items()])
                        pyperclip.copy(clipboard_content)
                        print_success("Revealed secrets copied to clipboard!")
                    except Exception as e:
                        print_warning(f"Could not copy to clipboard: {e}")
                        
                input(f"\n{Colors.BOLD}{Colors.GRAY}Press Enter to continue...{Colors.ENDC}")
                
        except KeyboardInterrupt:
            print_info("\nContinuing with masked secrets...")

def print_ascii_header():
    """Print a beautiful ASCII header with version and update info."""

    version_text = f"Version: {SCRIPT_VERSION}"
    last_updated_text = f"Last Updated: {LAST_UPDATED_TIMESTAMP}"


    info_line_plain = f"{version_text}  {last_updated_text}"
    info_line_colored = f"{Colors.BOLD}{Colors.WHITE}{version_text}{Colors.ENDC}  {Colors.GRAY}{last_updated_text}{Colors.ENDC}"


    visible_length = len(info_line_plain)


    if visible_length < CONTENT_WIDTH:
        total_padding = CONTENT_WIDTH - visible_length
        left_padding = total_padding // 2
        right_padding = total_padding - left_padding
    else:
        left_padding = 0
        right_padding = 0




    centered_info_line = f"{' ' * left_padding}{info_line_colored}{' ' * right_padding}"






    print(f"""
{Colors.CYAN}╔══════════════════════════════════════════════════════════════╗
║{centered_info_line}{Colors.CYAN}║
║                                                              ║
║  {Colors.BOLD}{Colors.WHITE}        ████████╗██╗   ██╗██████╗ ███████╗ ██████╗{Colors.ENDC}{Colors.CYAN}          ║
║  {Colors.BOLD}{Colors.WHITE}        ╚══██╔══╝██║   ██║██╔══██╗██╔════╝██╔═══██╗{Colors.ENDC}{Colors.CYAN}         ║
║  {Colors.BOLD}{Colors.WHITE}           ██║   ██║   ██║██████╔╝███████╗██║   ██║{Colors.ENDC}{Colors.CYAN}         ║
║  {Colors.BOLD}{Colors.WHITE}           ██║   ██║   ██║██╔══██╗╚════██║██║   ██║{Colors.ENDC}{Colors.CYAN}         ║
║  {Colors.BOLD}{Colors.WHITE}           ██║   ╚██████╔╝██║  ██║███████║╚██████╔╝{Colors.ENDC}{Colors.CYAN}         ║
║  {Colors.BOLD}{Colors.WHITE}          ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝ ╚═════╝{Colors.ENDC}{Colors.CYAN}           ║
║                                                              ║
║           {Colors.BOLD}{Colors.ORANGE}🚀 Database Generator & Token Creator 🚀{Colors.ENDC}{Colors.CYAN}           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝{Colors.ENDC}
""")

def print_step(step_num, total_steps, message):
    """Print a formatted step with progress indicator."""
    progress = "█" * step_num + "░" * (total_steps - step_num)
    print(f"\n{Colors.BOLD}{Colors.OKBLUE}[{step_num}/{total_steps}]{Colors.ENDC} {Colors.CYAN}[{progress}]{Colors.ENDC} {Colors.BOLD}{message}{Colors.ENDC}")

def print_success(message):
    """Print a success message with checkmark."""
    print(f"{Colors.OKGREEN}✅ {message}{Colors.ENDC}")

def print_error(message):
    """Print an error message with X mark."""
    print(f"{Colors.FAIL}❌ {message}{Colors.ENDC}")

def print_warning(message):
    """Print a warning message with warning icon."""
    print(f"{Colors.WARNING}⚠️  {message}{Colors.ENDC}")

def print_info(message):
    """Print an info message with info icon."""
    print(f"{Colors.OKCYAN}ℹ️  {message}{Colors.ENDC}")

def print_section_divider(title):
    """Print a section divider with title, respecting CONTENT_WIDTH."""
    divider = "═" * CONTENT_WIDTH
    print(f"\n{Colors.PURPLE}╔{divider}╗")
    print(f"║{Colors.BOLD}{Colors.WHITE}{title.center(CONTENT_WIDTH)}{Colors.ENDC}{Colors.PURPLE}║")
    print(f"╚{divider}╝{Colors.ENDC}")

def print_env_vars_box(DATABASE_URL, auth_token, db_name, url_var_name="DATABASE_URL", token_var_name="TURSO_AUTH_TOKEN"):
    """Print environment variables in a beautiful, perfectly aligned box."""
    print_section_divider("🔐 GENERATED CREDENTIALS")

    def create_padded_line(text_to_pad, total_width):

        plain_text = re.sub(r'\033\[[0-9;]*m', '', text_to_pad)
        padding = total_width - len(plain_text)
        return f"{text_to_pad}{' ' * max(0, padding)}"

    line_title = create_padded_line(f"  {Colors.BOLD}{Colors.WHITE}DATABASE CREDENTIALS", CONTENT_WIDTH)
    line_db_name = create_padded_line(f" {Colors.BOLD}{Colors.WHITE}Database Name: {Colors.CYAN}{db_name}", CONTENT_WIDTH)
    line_created_at = create_padded_line(f" {Colors.BOLD}{Colors.WHITE}Created At:  {Colors.GRAY}{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", CONTENT_WIDTH)


    db_url_secret = SecretDisplay(DATABASE_URL, "database_url")
    auth_token_secret = SecretDisplay(auth_token, "auth_token")
    

    DATABASE_URL_display = db_url_secret.get_masked_display()
    if len(DATABASE_URL_display) > CONTENT_WIDTH - 1:
        DATABASE_URL_display = DATABASE_URL_display[:CONTENT_WIDTH - 4] + "..."

    truncated_token = auth_token_secret.get_masked_display()
    if len(truncated_token) > CONTENT_WIDTH -1:
        truncated_token = truncated_token[:CONTENT_WIDTH-4] + "..."

    line_DATABASE_URL_val = create_padded_line(f" {Colors.BRIGHT_CYAN}{DATABASE_URL_display}{Colors.ENDC}", CONTENT_WIDTH)
    line_auth_token_val = create_padded_line(f" {Colors.BRIGHT_CYAN}{truncated_token}{Colors.ENDC}", CONTENT_WIDTH)
    

    secrets_dict = {
        "database_url": db_url_secret,
        "auth_token": auth_token_secret
    }


    print(f"""
{Colors.BOLD}{Colors.OKGREEN}┌{'─' * CONTENT_WIDTH}┐
│{line_title}│
├{'─' * CONTENT_WIDTH}┤{Colors.ENDC}
{Colors.BOLD}{Colors.WHITE}│{line_db_name}│{Colors.ENDC}
{Colors.BOLD}{Colors.WHITE}│{line_created_at}│{Colors.ENDC}
{Colors.BOLD}{Colors.OKGREEN}├{'─' * CONTENT_WIDTH}┤{Colors.ENDC}
{Colors.BOLD}{Colors.WHITE}│ {url_var_name}: {' ' * (CONTENT_WIDTH - len(f"{url_var_name}: "))}│{Colors.ENDC}
|{Colors.BOLD}{Colors.WHITE}│{line_DATABASE_URL_val}│{Colors.ENDC}
|{Colors.BOLD}{Colors.WHITE}│{' ' * CONTENT_WIDTH}│{Colors.ENDC}
|{Colors.BOLD}{Colors.WHITE}│ {token_var_name}: {' ' * (CONTENT_WIDTH - len(f"{token_var_name}: "))}│{Colors.ENDC}
|{Colors.BOLD}{Colors.WHITE}│{line_auth_token_val}│{Colors.ENDC}
{Colors.BOLD}{Colors.OKGREEN}└{'─' * CONTENT_WIDTH}┘{Colors.ENDC}
""")
    

    return secrets_dict


def print_footer(db_name):
    """Print a beautiful, perfectly aligned footer."""
    line1_raw = "🎉 SUCCESS! Your Turso database is ready to use! 🎉"
    line2_raw = "📋 Credentials copied to clipboard"
    line3_raw = "🔧 Ready to paste into your .env file"
    line4_raw = "Much love xxx remcostoeten 💖"

    line1 = f"{Colors.BOLD}{Colors.OKGREEN}{line1_raw}{Colors.ENDC}".center(CONTENT_WIDTH + len(f"{Colors.BOLD}{Colors.OKGREEN}{Colors.ENDC}") - len(line1_raw))
    line2 = f"{Colors.BOLD}{Colors.CYAN}{line2_raw}{Colors.ENDC}".center(CONTENT_WIDTH + len(f"{Colors.BOLD}{Colors.CYAN}{Colors.ENDC}") - len(line2_raw))
    line3 = f"{Colors.BOLD}{Colors.ORANGE}{line3_raw}{Colors.ENDC}".center(CONTENT_WIDTH + len(f"{Colors.BOLD}{Colors.ORANGE}{Colors.ENDC}") - len(line3_raw))
    line4 = f"{Colors.BOLD}{Colors.WHITE}{line4_raw}{Colors.ENDC}".center(CONTENT_WIDTH + len(f"{Colors.BOLD}{Colors.WHITE}{Colors.ENDC}") - len(line4_raw))



    text_5a_plain = "🗑️ To delete this DB, run:"
    text_5a_content_colored = f"{Colors.FAIL}{text_5a_plain}{Colors.ENDC}"
    padding_5a = CONTENT_WIDTH - len(text_5a_plain)


    line5a_for_box = f"{text_5a_content_colored}{' ' * max(0, padding_5a)}{Colors.PURPLE}"


    indent = "  "
    script_name = os.path.basename(sys.argv[0])

    cmd_part1_plain = f"python {script_name}"
    cmd_part1_colored = f"{Colors.BOLD}{Colors.WHITE}{cmd_part1_plain}{Colors.ENDC}"

    cmd_part2_plain = " --delete-generation"
    cmd_part2_colored = f"{Colors.FAIL}{cmd_part2_plain}{Colors.ENDC}"

    text_5b_plain_for_padding = f"{indent}{cmd_part1_plain}{cmd_part2_plain}"
    text_5b_content_colored = f"{indent}{cmd_part1_colored}{cmd_part2_colored}"

    padding_5b = CONTENT_WIDTH - len(text_5b_plain_for_padding)

    line5b_for_box = f"{text_5b_content_colored}{' ' * max(0, padding_5b)}{Colors.PURPLE}"


    print(f"""
{Colors.PURPLE}╔{'═' * CONTENT_WIDTH}╗
║{line1}║
║{' ' * CONTENT_WIDTH}║
║{line2}║
║{line3}║
║{' ' * CONTENT_WIDTH}║
║{line5a_for_box}║
║{line5b_for_box}║
║{' ' * CONTENT_WIDTH}║
║{line4}║
╚{'═' * CONTENT_WIDTH}╝{Colors.ENDC}
""")

def run_command(command, timeout=30):
    """Run a shell command and return its output and error (if any)."""
    result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=timeout)
    return result.stdout.strip(), result.stderr.strip(), result.returncode

def save_last_generated_db(db_name):
    """Saves the last generated database name to a state file."""
    try:
        with open(STATE_FILE, "w") as f:
            json.dump({"last_generated_db": db_name}, f)
    except Exception as e:
        print_warning(f"Could not save state file: {e}")

def read_last_generated_db():
    """Reads the last generated database name from the state file."""
    if not STATE_FILE.exists():
        return None
    try:
        with open(STATE_FILE, "r") as f:
            data = json.load(f)
            return data.get("last_generated_db")
    except (json.JSONDecodeError, IOError) as e:
        print_warning(f"Could not read state file: {e}")


        return None

def load_config():
    """Load configuration from the config file."""
    default_config = {
        "prompts": {
            "delete_generation": True,
            "open_turso_web": True,
            "paste_to_env": True,
            "reveal_secrets": True
        },
        "env_file": {
            "default_path": ".env",
            "default_env_dir": "./"
        },
        "defaults": {
            "auto_reveal": "off",
            "no_clipboard": False,
            "default_db_prefix": "",
            "env_url_name": "DATABASE_URL",
            "env_token_name": "TURSO_AUTH_TOKEN"
        },
        "display": {
            "show_version_info": True,
            "use_colors": True,
            "content_width": 60
        }
    }
    
    if not CONFIG_FILE.exists():
        return default_config
    
    try:
        with open(CONFIG_FILE, "r") as f:
            config = json.load(f)

        merged_config = default_config.copy()
        merged_config.update(config)
        return merged_config
    except (json.JSONDecodeError, IOError) as e:
        print_warning(f"Could not read config file: {e}")
        return default_config

def save_config(config):
    """Save configuration to the config file."""
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump(config, f, indent=2)
        print_success("Configuration saved successfully!")
    except IOError as e:
        print_error(f"Could not save config file: {e}")

def configure_script():
    """Interactive configuration of the script."""
    print_section_divider("⚙️ SCRIPT CONFIGURATION")
    
    config = load_config()
    
    print_info("Configure script settings:")
    print(f"\n{Colors.BOLD}{Colors.WHITE}Post-completion prompts:{Colors.ENDC}")
    print(f"  1. Delete generation prompt: {Colors.CYAN}{'Enabled' if config['prompts']['delete_generation'] else 'Disabled'}{Colors.ENDC}")
    print(f"  2. Open Turso shell prompt: {Colors.CYAN}{'Enabled' if config['prompts']['open_turso_web'] else 'Disabled'}{Colors.ENDC}")
    print(f"  3. Paste to .env prompt: {Colors.CYAN}{'Enabled' if config['prompts']['paste_to_env'] else 'Disabled'}{Colors.ENDC}")
    print(f"  4. Reveal secrets prompt: {Colors.CYAN}{'Enabled' if config['prompts']['reveal_secrets'] else 'Disabled'}{Colors.ENDC}")
    
    print(f"\n{Colors.BOLD}{Colors.WHITE}Environment file settings:{Colors.ENDC}")
    print(f"  5. Default .env path: {Colors.CYAN}{config['env_file']['default_path']}{Colors.ENDC}")
    print(f"  6. Default .env directory: {Colors.CYAN}{config['env_file']['default_env_dir']}{Colors.ENDC}")
    
    print(f"\n{Colors.BOLD}{Colors.WHITE}Default behavior:{Colors.ENDC}")
    print(f"  7. Auto-reveal secrets: {Colors.CYAN}{config['defaults']['auto_reveal']}{Colors.ENDC}")
    print(f"  8. Skip clipboard by default: {Colors.CYAN}{'Yes' if config['defaults']['no_clipboard'] else 'No'}{Colors.ENDC}")
    print(f"  9. Default database prefix: {Colors.CYAN}{config['defaults']['default_db_prefix'] or 'None'}{Colors.ENDC}")
    print(f" 10. Default URL env var name: {Colors.CYAN}{config['defaults']['env_url_name']}{Colors.ENDC}")
    print(f" 11. Default token env var name: {Colors.CYAN}{config['defaults']['env_token_name']}{Colors.ENDC}")
    
    print(f"\n{Colors.BOLD}{Colors.WHITE}Display settings:{Colors.ENDC}")
    print(f" 12. Show version info: {Colors.CYAN}{'Enabled' if config['display']['show_version_info'] else 'Disabled'}{Colors.ENDC}")
    print(f" 13. Use colors: {Colors.CYAN}{'Enabled' if config['display']['use_colors'] else 'Disabled'}{Colors.ENDC}")
    print(f" 14. Content width: {Colors.CYAN}{config['display']['content_width']}{Colors.ENDC}")
    
    print("\nEnter the number to toggle/change, or press Enter to finish:")
    
    while True:
        try:
            choice = input(f"{Colors.BOLD}{Colors.ORANGE}Choice (1-14 or Enter): {Colors.ENDC}").strip()
            
            if not choice:
                break
            
            choice = int(choice)
            
            if choice == 1:
                config['prompts']['delete_generation'] = not config['prompts']['delete_generation']
                status = "Enabled" if config['prompts']['delete_generation'] else "Disabled"
                print(f"Delete generation prompt: {Colors.CYAN}{status}{Colors.ENDC}")
            elif choice == 2:
                config['prompts']['open_turso_web'] = not config['prompts']['open_turso_web']
                status = "Enabled" if config['prompts']['open_turso_web'] else "Disabled"
                print(f"Open Turso shell prompt: {Colors.CYAN}{status}{Colors.ENDC}")
            elif choice == 3:
                config['prompts']['paste_to_env'] = not config['prompts']['paste_to_env']
                status = "Enabled" if config['prompts']['paste_to_env'] else "Disabled"
                print(f"Paste to .env prompt: {Colors.CYAN}{status}{Colors.ENDC}")
            elif choice == 4:
                config['prompts']['reveal_secrets'] = not config['prompts']['reveal_secrets']
                status = "Enabled" if config['prompts']['reveal_secrets'] else "Disabled"
                print(f"Reveal secrets prompt: {Colors.CYAN}{status}{Colors.ENDC}")
            elif choice == 5:
                new_path = input(f"Enter new default .env filename [{config['env_file']['default_path']}]: ").strip()
                if new_path:
                    config['env_file']['default_path'] = new_path
                    print(f"Default .env path set to: {Colors.CYAN}{new_path}{Colors.ENDC}")
            elif choice == 6:
                new_dir = input(f"Enter new default .env directory [{config['env_file']['default_env_dir']}]: ").strip()
                if new_dir:
                    config['env_file']['default_env_dir'] = new_dir
                    print(f"Default .env directory set to: {Colors.CYAN}{new_dir}{Colors.ENDC}")
            elif choice == 7:
                current = config['defaults']['auto_reveal']
                new_value = 'on' if current == 'off' else 'off'
                config['defaults']['auto_reveal'] = new_value
                print(f"Auto-reveal secrets set to: {Colors.CYAN}{new_value}{Colors.ENDC}")
            elif choice == 8:
                config['defaults']['no_clipboard'] = not config['defaults']['no_clipboard']
                status = "Yes" if config['defaults']['no_clipboard'] else "No"
                print(f"Skip clipboard by default: {Colors.CYAN}{status}{Colors.ENDC}")
            elif choice == 9:
                new_prefix = input(f"Enter new default database prefix [{config['defaults']['default_db_prefix'] or 'None'}]: ").strip()
                config['defaults']['default_db_prefix'] = new_prefix
                display_prefix = new_prefix or 'None'
                print(f"Default database prefix set to: {Colors.CYAN}{display_prefix}{Colors.ENDC}")
            elif choice == 10:
                config['display']['show_version_info'] = not config['display']['show_version_info']
                status = "Enabled" if config['display']['show_version_info'] else "Disabled"
                print(f"Show version info: {Colors.CYAN}{status}{Colors.ENDC}")
            elif choice == 11:
                config['display']['use_colors'] = not config['display']['use_colors']
                status = "Enabled" if config['display']['use_colors'] else "Disabled"
                print(f"Use colors: {Colors.CYAN}{status}{Colors.ENDC}")
            elif choice == 12:
                try:
                    new_width = int(input(f"Enter new content width [{config['display']['content_width']}]: ").strip())
                    if 40 <= new_width <= 120:
                        config['display']['content_width'] = new_width
                        print(f"Content width set to: {Colors.CYAN}{new_width}{Colors.ENDC}")
                    else:
                        print_warning("Width must be between 40 and 120 characters.")
                except ValueError:
                    print_warning("Please enter a valid number.")
            else:
                print_warning("Invalid choice. Please enter 1-12.")
                
        except ValueError:
            print_warning("Invalid input. Please enter a number 1-5.")
        except KeyboardInterrupt:
            print_error("\nConfiguration cancelled.")
            return
    
    save_config(config)


def post_completion_prompts(db_name, DATABASE_URL, auth_token):
    """Handle post-completion prompts based on configuration."""
    config = load_config()
    

    options_title = "💡 ADDITIONAL OPTIONS AVAILABLE"
    option1 = "🗑️  Delete this database"
    option2 = "🔧 Open database shell"
    option3 = "💾 Save to .env file"
    

    title_padding = (CONTENT_WIDTH - len(options_title)) // 2
    option_padding = 3
    
    print(f"""
{Colors.PURPLE}╔{'═' * CONTENT_WIDTH}╗
║{' ' * title_padding}{Colors.BOLD}{Colors.WHITE}{options_title}{Colors.ENDC}{Colors.PURPLE}{' ' * (CONTENT_WIDTH - title_padding - len(options_title))}║
║{' ' * CONTENT_WIDTH}║
║{' ' * option_padding}{Colors.CYAN}{option1}{Colors.ENDC}{Colors.PURPLE}{' ' * (CONTENT_WIDTH - option_padding - len(option1))}║
║{' ' * option_padding}{Colors.CYAN}{option2}{Colors.ENDC}{Colors.PURPLE}{' ' * (CONTENT_WIDTH - option_padding - len(option2))}║
║{' ' * option_padding}{Colors.CYAN}{option3}{Colors.ENDC}{Colors.PURPLE}{' ' * (CONTENT_WIDTH - option_padding - len(option3))}║
║{' ' * CONTENT_WIDTH}║
╚{'═' * CONTENT_WIDTH}╝{Colors.ENDC}""")
    
    try:
        options_choice = input(f"\n{Colors.BOLD}{Colors.ORANGE}Press 'o' to access options or Enter to finish: {Colors.ENDC}").strip().lower()
        
        if options_choice != 'o':
            return
            
    except KeyboardInterrupt:
        print_info("\nFinishing...")
        return
    

    print_section_divider("🎯 POST-COMPLETION OPTIONS")
    

    if config['prompts']['delete_generation']:
        try:
            delete_choice = input(f"{Colors.BOLD}{Colors.ORANGE}Delete this generation? (y/N): {Colors.ENDC}").strip().lower()
            if delete_choice == 'y':
                if delete_database(db_name):
                    print_success("Database deleted successfully!")
                    try:
                        STATE_FILE.unlink(missing_ok=True)
                        print_info("State file cleared.")
                    except OSError as e:
                        print_warning(f"Could not remove state file: {e}")
                    return
        except KeyboardInterrupt:
            print_info("\nSkipping delete prompt.")
    

    if config['prompts']['open_turso_web']:
        try:
            shell_choice = input(f"{Colors.BOLD}{Colors.ORANGE}Open database shell connection? (y/N): {Colors.ENDC}").strip().lower()
            if shell_choice == 'y':
                try:
                    print_success("Opening Turso database shell...")
                    print_info(f"Connecting to database: {Colors.CYAN}{db_name}{Colors.ENDC}")
                    print_info("Type '.quit' or '.exit' to close the shell.")
                    print("\n" + "="*60)
                    

                    import subprocess
                    result = subprocess.call(["turso", "db", "shell", db_name])
                    
                    print("\n" + "="*60)
                    if result == 0:
                        print_success("Shell session completed.")
                    else:
                        print_warning("Shell session ended with non-zero exit code.")
                        
                except Exception as e:
                    print_error(f"Could not open database shell: {e}")
                    print_info(f"Manual command: {Colors.CYAN}turso db shell {db_name}{Colors.ENDC}")
        except KeyboardInterrupt:
            print_info("\nSkipping shell prompt.")
    

    if config['prompts']['paste_to_env']:
        try:
            env_choice = input(f"{Colors.BOLD}{Colors.ORANGE}Paste credentials to .env file? (y/N): {Colors.ENDC}").strip().lower()
            if env_choice == 'y':

                default_env_path = config['env_file']['default_path']
                default_env_dir = config['env_file']['default_env_dir']
                
                suggested_path = f"{default_env_dir.rstrip('/')}/{default_env_path}"
                env_path = input(f"{Colors.BOLD}{Colors.ORANGE}Enter .env file path [{suggested_path}]: {Colors.ENDC}").strip()
                
                if not env_path:
                    env_path = suggested_path
                
                try:
                    env_file_path = Path(env_path)
                    env_file_path.parent.mkdir(parents=True, exist_ok=True)
                    

                    if env_file_path.exists():
                        overwrite = input(f"{Colors.BOLD}{Colors.ORANGE}File exists. Append to existing file? (Y/n): {Colors.ENDC}").strip().lower()
                        mode = 'a' if overwrite != 'n' else 'w'
                    else:
                        mode = 'w'
                    
                    with open(env_file_path, mode) as f:
                        if mode == 'a':
                            f.write("\n\n# Turso Credentials (added by script)\n")
                        else:
                            f.write("# Turso Credentials (generated by script)\n")
                        f.write(f"# Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                        f.write(f"DATABASE_URL={DATABASE_URL}\n")
                        f.write(f"TURSO_AUTH_TOKEN={auth_token}\n")
                    
                    print_success(f"Credentials {'appended to' if mode == 'a' else 'written to'} {Colors.CYAN}{env_file_path}{Colors.ENDC}")
                    
                except IOError as e:
                    print_error(f"Could not write to {env_path}: {e}")
                    
        except KeyboardInterrupt:
            print_info("\nSkipping .env prompt.")

def check_database_exists(db_name):
    """Check if a database with the given name already exists."""
    print_info(f"Checking if database '{Colors.CYAN}{db_name}{Colors.ENDC}' already exists...")
    
    output, error, code = run_command("turso db list --json")
    if code != 0:
        print_warning("Could not fetch database list for existence check.")
        if error: print_warning(f"Turso CLI Error: {error}")
        return False
    
    try:
        data = json.loads(output)
        databases = data.get("databases", data.get("dbs", []))
        
        for db_info in databases:
            existing_name = db_info.get("Name", db_info.get("name", ""))
            if existing_name == db_name:
                return True
        return False
        
    except (json.JSONDecodeError, KeyError) as e:
        print_warning(f"Could not parse database list: {e}")
        return False

def delete_database(db_name):
    """Deletes a Turso database."""
    print_info(f"Attempting to delete database: {Colors.CYAN}{db_name}{Colors.ENDC}")
    command = f"turso db destroy {db_name} --yes"

    output, error, code = run_command(command, timeout=60)



    if code == 0 and (f"Destroyed database {db_name}" in output or "successfully deleted" in output.lower()):
        print_success(f"Successfully deleted database '{Colors.CYAN}{db_name}{Colors.ENDC}'")
        return True
    else:
        print_error(f"Failed to delete database '{Colors.CYAN}{db_name}{Colors.ENDC}'")

        if error: print_error(f"Turso CLI Error: {error}")
        if output: print_info(f"Turso CLI Output: {output}")
        return False

def delete_last_generated_db():
    """Handler for the --delete-generation flag."""
    print_section_divider("🗑️ Delete Last Generated Database")
    db_name = read_last_generated_db()
    if not db_name:
        print_error("No previously generated database found to delete.")
        print_info(f"State file ({STATE_FILE}) not found, empty, or unreadable.")
        sys.exit(1)

    if delete_database(db_name):
        try:
            STATE_FILE.unlink()
            print_info("Cleared state file for the deleted database.")
        except OSError as e:
            print_warning(f"Could not remove state file {STATE_FILE}: {e}")
    else:
        sys.exit(1)

def interactive_delete():
    """Provides an interactive UI to delete databases."""
    print_section_divider("🗑️ Interactive Database Deletion")
    print_info("Fetching list of databases...")

    output, error, code = run_command("turso db list --json")
    if code != 0:
        print_error("Could not fetch database list.")
        if error: print_error(f"Turso CLI Error: {error}")
        sys.exit(1)

    try:
        data = json.loads(output)

        databases = data.get("databases", data.get("dbs", []))
    except (json.JSONDecodeError, KeyError) as e:
        print_error("Could not parse the list of databases.")
        print_info(f"Received output: {output}")
        print_error(f"Parsing error: {e}")
        sys.exit(1)

    if not databases:
        print_success("You have no databases to delete. All clear! ✨")
        sys.exit(0)

    print_info("Select databases to delete by typing their numbers, separated by spaces.")
    print_info(f"Example: '{Colors.ORANGE}1 3 4{Colors.ENDC}' to select databases 1, 3, and 4.")
    print("")

    for i, db_info in enumerate(databases):

        db_name = db_info.get("Name", db_info.get("name", "N/A"))
        db_region = db_info.get("Region", db_info.get("region", "N/A"))
        print(f"  {Colors.BOLD}{Colors.WHITE}[{i+1}]{Colors.ENDC} {Colors.CYAN}{db_name}{Colors.ENDC} ({Colors.GRAY}Region: {db_region}{Colors.ENDC})")

    print("")

    try:
        selection_str = input(f"\n{Colors.BOLD}{Colors.ORANGE}Enter numbers to delete (or press Enter to cancel): {Colors.ENDC}")
        if not selection_str.strip():
            print_info("Deletion cancelled by user.")
            sys.exit(0)

        selected_indices = []
        for item in selection_str.split():
            try:
                selected_indices.append(int(item) - 1)
            except ValueError:
                print_warning(f"Invalid input '{item}' skipped. Please enter numbers only.")

        dbs_to_delete_names = []
        valid_selections = False
        for i in selected_indices:
            if 0 <= i < len(databases):
                db_name_key = "Name" if "Name" in databases[i] else "name"
                dbs_to_delete_names.append(databases[i][db_name_key])
                valid_selections = True
            else:
                print_warning(f"Invalid selection number: {i+1}. Skipping.")

        if not valid_selections or not dbs_to_delete_names:
            print_error("No valid databases selected for deletion. Aborting.")
            sys.exit(1)

        print_section_divider("🚨 CONFIRM DELETION")
        print_warning("You are about to PERMANENTLY delete the following databases:")
        for db_name_to_delete in dbs_to_delete_names:
            print(f"  - {Colors.BOLD}{Colors.FAIL}{db_name_to_delete}{Colors.ENDC}")

        confirm = input(f"\n{Colors.BOLD}{Colors.ORANGE}Are you absolutely sure? This action cannot be undone. (yes/N): {Colors.ENDC}").strip().lower()

        if confirm == 'yes':
            print_info("Proceeding with deletion...")
            all_successful = True
            for db_name_to_delete in dbs_to_delete_names:
                if not delete_database(db_name_to_delete):
                    all_successful = False
            if all_successful:
                print_success("Selected databases have been processed for deletion.")
            else:
                print_warning("Some databases could not be deleted. Check messages above.")
        else:
            print_info("Deletion aborted by user.")

    except ValueError:
        print_error("Invalid input. Please enter numbers separated by spaces.")
        sys.exit(1)
    except KeyboardInterrupt:
        print_error("\nOperation cancelled by user.")
        sys.exit(1)


def check_dependencies():
    """Check if required dependencies are installed."""
    print_step(1, 6, "Checking system dependencies...")
    turso_output, turso_error, turso_code = run_command("turso --version")
    if turso_code != 0:
        print_error("Turso CLI is not installed or not in PATH!")
        print_info("Please install Turso CLI from: https://docs.turso.tech/reference/turso-cli")
        sys.exit(1)

    turso_version = turso_output.split('\n')[0] if turso_output else "Unknown version"
    print_success(f"Turso CLI found: {Colors.CYAN}{turso_version}{Colors.ENDC}")

    try:
        pyperclip.copy("test_clipboard_turso_gen")
        if pyperclip.paste() == "test_clipboard_turso_gen":
             print_success("Clipboard functionality available.")
        else:
            raise pyperclip.PyperclipException("Paste check failed")
    except Exception as e:
        print_warning(f"Clipboard functionality might be limited or unavailable: {e}")
        print_info("For Linux, try: sudo apt-get install xclip or sudo apt-get install xsel")
        print_info("For macOS, clipboard access should be default.")
        print_info("For Windows, clipboard access should be default.")


def main():
    script_name = os.path.basename(sys.argv[0])
    parser = argparse.ArgumentParser(
        description=f'{Colors.BOLD}{Colors.ORANGE}Turso Database & Token Generator{Colors.ENDC} - Automate Turso DB tasks.',
        formatter_class=argparse.RawTextHelpFormatter,
        epilog=f"""
{Colors.BOLD}{Colors.WHITE}Examples:{Colors.ENDC}
  {Colors.CYAN}python {script_name}{Colors.ENDC}
    {Colors.GRAY}

  {Colors.CYAN}python {script_name} --overwrite .env.local{Colors.ENDC}
    {Colors.GRAY}

  {Colors.CYAN}python {script_name} --no-clipboard{Colors.ENDC}
    {Colors.GRAY}

{Colors.BOLD}{Colors.ORANGE}Configuration:{Colors.ENDC}
  {Colors.CYAN}python {script_name} --configure{Colors.ENDC}
    {Colors.GRAY}

{Colors.BOLD}{Colors.FAIL}Deletion Commands:{Colors.ENDC}
  {Colors.CYAN}python {script_name} --delete-generation{Colors.ENDC}
    {Colors.GRAY}

  {Colors.CYAN}python {script_name} --delete-interactive{Colors.ENDC}
    {Colors.GRAY}
        """
    )
    parser.add_argument('--name', metavar='DB_NAME',
                       help='Custom name for the database. If not provided, Turso will generate a random name.')
    parser.add_argument('--overwrite', metavar='FILENAME',
                       help='Filename (e.g., .env or .env.production) to update/create in project root.')
    parser.add_argument('--no-clipboard', action='store_true',
                       help='Skip copying credentials to the clipboard.')
    parser.add_argument('--auto-reveal', choices=['on', 'off'], default='off',
                       help='Automatically reveal secrets without prompting. Default: off')
    parser.add_argument('--env-url-name', metavar='VAR_NAME', default='DATABASE_URL',
                       help='Custom name for the database URL environment variable. Default: DATABASE_URL')
    parser.add_argument('--env-token-name', metavar='VAR_NAME', default='TURSO_AUTH_TOKEN',
                       help='Custom name for the auth token environment variable. Default: TURSO_AUTH_TOKEN')
    parser.add_argument('--configure', action='store_true',
                       help='Open configuration menu to set preferences.')

    delete_group = parser.add_argument_group(f'{Colors.BOLD}{Colors.FAIL}Deletion Options{Colors.ENDC} (use one at a time)')
    delete_group.add_argument('--delete-generation', action='store_true',
                              help='Delete the last database created by THIS script (uses state file).')
    delete_group.add_argument('--delete-interactive', action='store_true',
                              help='Interactively select and delete any of your Turso databases.')

    args = parser.parse_args()
    

    config = load_config()
    

    if '--auto-reveal' not in sys.argv:
        args.auto_reveal = config['defaults']['auto_reveal']
    
    if '--no-clipboard' not in sys.argv and config['defaults']['no_clipboard']:
        args.no_clipboard = True
    

    if not args.name and config['defaults']['default_db_prefix']:
        prefix = config['defaults']['default_db_prefix']
        args.name = f"{prefix}-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    

    global CONTENT_WIDTH
    CONTENT_WIDTH = config['display']['content_width']

    if args.delete_generation:
        os.system('clear' if os.name == 'posix' else 'cls')
        delete_last_generated_db()
        sys.exit(0)

    if args.delete_interactive:
        os.system('clear' if os.name == 'posix' else 'cls')
        interactive_delete()
        sys.exit(0)

    if args.configure:
        os.system('clear' if os.name == 'posix' else 'cls')
        print_ascii_header()
        configure_script()
        sys.exit(0)

    os.system('clear' if os.name == 'posix' else 'cls')
    print_ascii_header()

    try:
        check_dependencies()




        print_step(2, 6, "Verifying Turso CLI authentication...")
        auth_output, auth_error, auth_code = run_command("turso auth status")
        if auth_code != 0 or "You are not logged in" in auth_output or "not authenticated" in auth_output.lower():
            print_error("Turso CLI authentication failed or you are not logged in.")
            print_info(f"Please run: {Colors.BOLD}turso auth login{Colors.ENDC}")
            sys.exit(1)
        whoami_output, _, _ = run_command("turso auth whoami")
        print_success(f"Turso CLI authentication verified (Logged in as: {Colors.CYAN}{whoami_output or 'user'}{Colors.ENDC}).")


        print_step(3, 6, "Creating new Turso database...")


        db_create_command = f"turso db create"
        if args.name:
            db_create_command += f" {args.name}"
        create_output, create_error, create_code = run_command(db_create_command, timeout=90)
        if create_code != 0:
            print_error(f"Database creation failed: {create_error or 'Unknown error'}")
            sys.exit(1)

        db_name_match = re.search(r'(?:Created database|Database)\s+([\w-]+)', create_output)
        if not db_name_match:
            print_error("Could not extract database name from Turso output.")
            print_info(f"Output: {create_output}")
            sys.exit(1)
        db_name = db_name_match.group(1)
        print_success(f"Database '{Colors.CYAN}{db_name}{Colors.ENDC}' created successfully!")
        save_last_generated_db(db_name)

        print_step(4, 6, "Retrieving database connection details...")
        show_output, show_error, show_code = run_command(f"turso db show {db_name}", timeout=60)
        if show_code != 0:
            print_error(f"Failed to get database details for {db_name}: {show_error}")
            sys.exit(1)

        url_match = re.search(r'URL:\s+(libsql://[\w.-]+)', show_output)
        if not url_match:
            print_error("Could not extract database URL from Turso output.")
            print_info(f"Output: {show_output}")
            sys.exit(1)
        DATABASE_URL = url_match.group(1)
        print_success("Database URL retrieved.")

        print_step(5, 6, "Generating authentication token...")
        token_output, token_error, token_code = run_command(f"turso db tokens create {db_name}", timeout=60)
        if token_code != 0:
            print_error(f"Token creation failed for {db_name}: {token_error}")
            sys.exit(1)
        auth_token = token_output.strip()
        if not auth_token or len(auth_token) < 10:
            print_error("Generated token appears invalid or empty.")
            print_info(f"Output: {token_output}")
            sys.exit(1)
        print_success("Authentication token generated.")


        url_var_name = args.env_url_name
        token_var_name = args.env_token_name
        
        new_vars = {url_var_name: DATABASE_URL, token_var_name: auth_token}
        env_vars_string_for_clipboard = f"{url_var_name}={DATABASE_URL}\n{token_var_name}={auth_token}"


        secrets_dict = print_env_vars_box(DATABASE_URL, auth_token, db_name, url_var_name, token_var_name)

        print_step(6, 6, "Finalizing setup...")
        

        if not args.no_clipboard:
            try:
                pyperclip.copy(env_vars_string_for_clipboard)
                print_success("🔗 URL and auth token copied to clipboard!")
                

                if args.auto_reveal == 'on':
                    print(f"\n{Colors.BOLD}{Colors.OKGREEN}🔓 Secrets Revealed (auto-reveal enabled):{Colors.ENDC}")
                    print(f"{Colors.BOLD}{Colors.ORANGE}{url_var_name}: {Colors.ENDC}{Colors.BRIGHT_CYAN}{DATABASE_URL}{Colors.ENDC}")
                    print(f"{Colors.BOLD}{Colors.ORANGE}{token_var_name}: {Colors.ENDC}{Colors.BRIGHT_CYAN}{auth_token}{Colors.ENDC}")
                    input(f"{Colors.BOLD}{Colors.GRAY}Press Enter to continue...{Colors.ENDC}")
                else:
                    try:
                        reveal_choice = input(f"\n{Colors.BOLD}{Colors.ORANGE}Do you want to reveal them? (y/N): {Colors.ENDC}").strip().lower()
                        if reveal_choice == 'y':
                            print(f"\n{Colors.BOLD}{Colors.OKGREEN}🔓 Secrets Revealed:{Colors.ENDC}")
                            print(f"{Colors.BOLD}{Colors.ORANGE}{url_var_name}: {Colors.ENDC}{Colors.BRIGHT_CYAN}{DATABASE_URL}{Colors.ENDC}")
                            print(f"{Colors.BOLD}{Colors.ORANGE}{token_var_name}: {Colors.ENDC}{Colors.BRIGHT_CYAN}{auth_token}{Colors.ENDC}")
                            input(f"\n{Colors.BOLD}{Colors.GRAY}Press Enter to continue...{Colors.ENDC}")
                        else:
                            print_info("Continuing with masked secrets...")
                    except KeyboardInterrupt:
                        print_info("\nContinuing with masked secrets...")
                    
            except Exception as e:
                print_warning(f"Could not copy to clipboard: {e}")
                print_info("You can manually copy the credentials from the box above.")

                try:
                    reveal_choice = input(f"\n{Colors.BOLD}{Colors.ORANGE}Do you want to reveal the secrets? (y/N): {Colors.ENDC}").strip().lower()
                    if reveal_choice == 'y':
                        print(f"\n{Colors.BOLD}{Colors.OKGREEN}🔓 Secrets Revealed:{Colors.ENDC}")
                        print(f"{Colors.BOLD}{Colors.ORANGE}{url_var_name}: {Colors.ENDC}{Colors.BRIGHT_CYAN}{DATABASE_URL}{Colors.ENDC}")
                        print(f"{Colors.BOLD}{Colors.ORANGE}{token_var_name}: {Colors.ENDC}{Colors.BRIGHT_CYAN}{auth_token}{Colors.ENDC}")
                        input(f"\n{Colors.BOLD}{Colors.GRAY}Press Enter to continue...{Colors.ENDC}")
                except KeyboardInterrupt:
                    print_info("\nContinuing...")
        else:

            try:
                reveal_choice = input(f"\n{Colors.BOLD}{Colors.ORANGE}Do you want to reveal the secrets? (y/N): {Colors.ENDC}").strip().lower()
                if reveal_choice == 'y':
                    print(f"\n{Colors.BOLD}{Colors.OKGREEN}🔓 Secrets Revealed:{Colors.ENDC}")
                    print(f"{Colors.BOLD}{Colors.ORANGE}{url_var_name}: {Colors.ENDC}{Colors.BRIGHT_CYAN}{DATABASE_URL}{Colors.ENDC}")
                    print(f"{Colors.BOLD}{Colors.ORANGE}{token_var_name}: {Colors.ENDC}{Colors.BRIGHT_CYAN}{auth_token}{Colors.ENDC}")
                    input(f"\n{Colors.BOLD}{Colors.GRAY}Press Enter to continue...{Colors.ENDC}")
            except KeyboardInterrupt:
                print_info("\nContinuing...")
        
        if args.overwrite:

            project_root = Path.cwd()

            current_dir_check = Path.cwd()
            while current_dir_check != current_dir_check.parent:
                if (current_dir_check / ".git").is_dir():
                    project_root = current_dir_check
                    print_info(f"Project root identified at: {Colors.CYAN}{project_root}{Colors.ENDC}")
                    break
                current_dir_check = current_dir_check.parent

            env_file_path = project_root / args.overwrite


            try:

                env_file_path.parent.mkdir(parents=True, exist_ok=True)

                mode = 'a' if env_file_path.exists() else 'w'
                with open(env_file_path, mode) as f:
                    if mode == 'a': f.write("\n\n# Turso Credentials (added by script)\n")
                    else: f.write("# Turso Credentials (generated by script)\n")
                    f.write(f"# Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                    f.write(f"DATABASE_URL={DATABASE_URL}\n")
                    f.write(f"TURSO_AUTH_TOKEN={auth_token}\n")
                print_success(f"Environment variables {'appended to' if mode == 'a' else 'written to'} {Colors.CYAN}{env_file_path}{Colors.ENDC}")
            except IOError as e:
                print_error(f"Could not write to {env_file_path}: {e}")
        else:
            print_info(f"To save credentials to a file, use: {Colors.BOLD}--overwrite FILENAME{Colors.ENDC}")

        print_footer(db_name)
        

        post_completion_prompts(db_name, DATABASE_URL, auth_token)

    except KeyboardInterrupt:
        print_error("\nOperation cancelled by user.")
        sys.exit(1)
    except Exception as e:
        print_error(f"An unexpected error occurred: {e}")



        sys.exit(1)

if __name__ == "__main__":
    main()
