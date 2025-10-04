# Docker Container Manager

An interactive terminal UI for managing Docker containers, inspired by the PostgreSQL manager. This tool provides a user-friendly interface for common Docker container operations with advanced features like multi-selection, progress tracking, and system notifications.

## Features

- Beautiful terminal UI with keyboard navigation
- Container management:
  - List all containers with detailed information
  - Start/stop containers
  - Remove containers
  - View container logs
  - Monitor container statistics
- Bulk operations support
- System cleanup utilities
- Cross-platform clipboard support
- System notifications (where available)
- Progress tracking for long operations

## Installation

1. Ensure you have Node.js (v18 or later) installed
2. Clone this repository
3. Install dependencies:
   ```bash
   cd docker
   npm install
   ```
4. Build the project:
   ```bash
   npm run build
   ```
5. Link the binary (optional):
   ```bash
   npm link
   ```

## Requirements

- Node.js v18 or later
- Docker daemon running
- For clipboard support:
  - Linux: `xclip` (X11) or `wl-copy` (Wayland)
  - macOS: Built-in
  - Windows: Built-in
- For notifications:
  - Linux: `notify-send`
  - macOS: Built-in or `terminal-notifier`
  - Windows: Built-in

## Usage

### Interactive Mode

Start the interactive interface:
```bash
docker-manager
```

### Command Line Mode

Run specific commands directly:
```bash
docker-manager list          # List all containers
docker-manager start         # Start a container
docker-manager stop          # Stop a container
docker-manager remove        # Remove a container
docker-manager logs          # View container logs
docker-manager stats         # View container statistics
docker-manager cleanup      # Clean up system
```

Get help:
```bash
docker-manager help
```

## Keyboard Shortcuts

### Global
- `↑/↓`: Navigate menu items
- `Enter`: Select/Confirm
- `Backspace`: Go back
- `q`: Quit
- `Ctrl+C`: Force quit

### Container List
- `Space`: Toggle selection (for bulk operations)
- `s`: Start/Stop selected container(s)
- `d`: Delete selected container(s)
- `Enter`: View details/Perform action

### Container Details
- `l`: View logs
- `s`: View statistics
- `c`: Copy container ID
- `r`: Refresh

### Logs View
- `f`: Toggle follow mode
- `c`: Clear logs
- `Backspace`: Return to details

## Error Codes

Common error codes and their meanings:

| Code | Description | Solution |
|------|-------------|----------|
| E001 | Docker daemon not running | Start Docker daemon |
| E002 | Container not found | Verify container ID/name |
| E003 | Permission denied | Run with appropriate permissions |
| E004 | Network error | Check Docker network configuration |
| E005 | Resource conflict | Resolve container name/port conflicts |

## Troubleshooting

1. **Docker daemon not running**
   - Error: "Docker daemon is not running"
   - Solution: Start Docker service (`systemctl start docker` on Linux)

2. **Permission issues**
   - Error: "Permission denied"
   - Solution: Add user to docker group or use sudo

3. **Clipboard not working**
   - Linux: Install xclip or wl-copy
   - Verify terminal has required permissions

4. **Notifications not showing**
   - Linux: Install notify-send
   - macOS: Install terminal-notifier
   - Verify notification permissions

## Development

For development work:

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start in development mode:
   ```bash
   npm run dev
   ```

### Directory Structure

```
docker/
├── index.ts               # Main entry point
├── terminal-manager.ts    # Terminal UI manager
├── docker-utils.ts        # Docker operations
├── ui-components.ts      # UI components
├── ui-utils.ts           # UI utilities
├── system-utils.ts       # System integration
└── types.ts              # TypeScript types
```

### Testing

Run tests (when implemented):
```bash
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT

## Acknowledgments

- Inspired by the PostgreSQL database manager
- Built with TypeScript and Node.js
- Uses ANSI escape codes for terminal graphics