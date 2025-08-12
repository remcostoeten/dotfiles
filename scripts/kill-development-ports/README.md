# kill-dev

Are you also to dumb to remember simple kill ports command? I've got your back. A powerful CLI tool to find and kill development server processes on specified or common dev ports. 

## Features

- 🔍 Automatically scans common development ports (Next.js, React, Vite)
- 🎯 Supports specific port numbers or port ranges
- 📋 Interactive process selection
- 💪 Works on Windows, macOS, and Linux

## Setup (Dotfiles Integration)

This tool is now integrated into your dotfiles. To set it up:

```bash
# From your dotfiles directory
cd scripts/kill-development-ports
./setup.sh
```

This will install the necessary Node.js dependencies locally.

## Usage

```bash
# Scan default ports (3000-3010, 5000-5005, 5173-5183)
ports
# or
kill-dev

# Scan specific port
ports 3000
# or
kill-dev 3000

# Scan multiple ports
ports 3000 8080
# or
kill-dev 3000 8080

# Scan port range
ports 3000-3005
# or
kill-dev 3000-3005

# Mix ports and ranges
ports 3000 8000-8010
# or
kill-dev 3000 8000-8010
```

### Available Commands

- `ports [ports...]` - Short and sweet main command
- `kill-dev [ports...]` - Descriptive alias
- `kill-ports [ports...]` - Full command name

### Interactive Selection

1. The tool will scan for processes on the specified ports
2. Select processes using:
   - `Space` to select/deselect individual processes
   - `a` to toggle all processes
   - `i` to invert selection
   - `Enter` to confirm and proceed

## Default Ports

- Next.js/React: 3000-3010
- Generic dev: 5000-5005
- Vite: 5173-5183

## Requirements

- Node.js >= 14.0.0

## License

MIT © [Remco Stoeten](https://github.com/remcostoeten)
