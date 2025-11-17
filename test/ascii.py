#!/usr/bin/env python3

import os
import sys
from pathlib import Path

# Pastel colors matching cfg/docker scripts
class Colors:
    RESET = '\033[0m'
    PASTEL_PINK = '\033[38;2;250;162;193m'
    PASTEL_MAGENTA = '\033[38;2;212;187;248m'
    PASTEL_PURPLE = '\033[38;2;165;216;255m'
    PASTEL_BLUE = '\033[38;2;178;242;187m'
    PASTEL_CYAN = '\033[38;2;255;236;153m'
    PASTEL_GREEN = '\033[38;2;255;216;168m'

def get_version():
    version_file = Path(__file__).parent.parent / 'VERSION'
    if version_file.exists():
        return version_file.read_text().strip()
    return "unknown"

def remove_ansi(text):
    import re
    return re.sub(r'\x1b\[[0-9;]*m', '', text)

def create_gradient_text(text):
    colors = [Colors.PASTEL_PINK, Colors.PASTEL_MAGENTA, Colors.PASTEL_PURPLE,
              Colors.PASTEL_BLUE, Colors.PASTEL_CYAN, Colors.PASTEL_GREEN]

    if not text:
        return text

    result = ""
    text_length = len(text)

    for i, char in enumerate(text):
        position = (i / (text_length - 1 or 1)) * 100
        color_index = int((position / 100) * (len(colors) - 1))
        result += colors[color_index] + char

    return result + Colors.RESET

def show_banner():
    version = get_version()
    import os
    tagline = os.environ.get('tagline', 'Welcome to the dotfiles experience!')
    gradient_tagline = create_gradient_text(tagline)

    # ASCII art with gradient colors
    ascii_lines = [
        f"    {Colors.PASTEL_PINK}██████╗  ██████╗  ██████╗██╗  ██╗███████╗██████╗ {Colors.RESET}",
        f"    {Colors.PASTEL_MAGENTA}██╔══██╗██╔═══██╗██╔════╝██║ ██╔╝██╔════╝██╔══██╗{Colors.RESET}",
        f"    {Colors.PASTEL_PURPLE}██║  ██║██║   ██║██║     █████╔╝ █████╗  ██████╔╝{Colors.RESET}",
        f"    {Colors.PASTEL_BLUE}██║  ██║██║   ██║██║     ██╔═██╗ ██╔══╝  ██╔══██╗{Colors.RESET}",
        f"    {Colors.PASTEL_CYAN}██████╔╝╚██████╔╝╚██████╗██║  ██╗███████╗██║  ██║{Colors.RESET}",
        f"    {Colors.PASTEL_GREEN}╚═════╝  ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝{Colors.RESET}",
    ]

    # Calculate padding for centered tagline
    max_width = max(len(remove_ansi(line)) for line in ascii_lines)
    tagline_length = len(tagline)
    left_pad = (max_width - tagline_length) // 2

    # Print ASCII art and tagline
    for line in ascii_lines:
        print(line)
    print(' ' * (left_pad + 4) + gradient_tagline)
    print()

if __name__ == "__main__":
    show_banner()
