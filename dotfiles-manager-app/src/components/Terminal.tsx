import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

export default function Terminal() {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [dotfilesPath, setDotfilesPath] = useState('')

  useEffect(() => {
    loadDotfilesPath()
  }, [])

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return

    // Initialize xterm.js
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"Cascadia Code", "Fira Code", "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      cols: 80,
      rows: 24,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)

    term.open(terminalRef.current)
    fitAddon.fit()

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    // Welcome message
    term.writeln('Dotfiles Manager Terminal')
    term.writeln('Type commands below or use quick actions on the right')
    term.writeln('')
    writePrompt(term)

    // Handle input
    let currentLine = ''
    term.onData((data) => {
      const code = data.charCodeAt(0)

      if (code === 13) {
        // Enter
        term.writeln('')
        if (currentLine.trim()) {
          executeCommand(currentLine.trim())
        }
        currentLine = ''
        writePrompt(term)
      } else if (code === 127) {
        // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1)
          term.write('\b \b')
        }
      } else if (code === 27) {
        // Escape sequences (arrow keys)
        // Arrow up: \x1b[A
        // Arrow down: \x1b[B
        // For simplicity, we'll handle this in a basic way
      } else if (code >= 32 && code < 127) {
        // Printable characters
        currentLine += data
        term.write(data)
      }
    })

    // Handle resize
    const handleResize = () => {
      fitAddon.fit()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      term.dispose()
    }
  }, [])

  const loadDotfilesPath = async () => {
    try {
      const path = await invoke<string>('get_dotfiles_path')
      setDotfilesPath(path)
    } catch (error) {
      console.error('Failed to get dotfiles path:', error)
    }
  }

  const writePrompt = (term: XTerm) => {
    term.write('\r\n$ ')
  }

  const executeCommand = async (command: string) => {
    const term = xtermRef.current
    if (!term) return

    // Parse command
    const parts = command.trim().split(/\s+/)
    const cmd = parts[0]
    const args = parts.slice(1)

    try {
      const output = await invoke<string>('execute_command', {
        command: cmd,
        args: args,
      })

      if (output) {
        const lines = output.split('\n')
        lines.forEach((line) => {
          term.writeln(line)
        })
      }
    } catch (error) {
      term.writeln(`\x1b[31mError: ${error}\x1b[0m`)
    }
  }

  const runQuickCommand = async (command: string) => {
    const term = xtermRef.current
    if (!term) return

    term.writeln(`$ ${command}`)
    
    const parts = command.trim().split(/\s+/)
    const cmd = parts[0]
    const args = parts.slice(1)

    try {
      const output = await invoke<string>('execute_command', {
        command: cmd,
        args: args,
      })

      if (output) {
        const lines = output.split('\n')
        lines.forEach((line) => {
          term.writeln(line)
        })
      }
    } catch (error) {
      term.writeln(`\x1b[31mError: ${error}\x1b[0m`)
    }

    writePrompt(term)
  }

  const clearTerminal = () => {
    xtermRef.current?.clear()
    if (xtermRef.current) {
      writePrompt(xtermRef.current)
    }
  }

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <h2>Integrated Terminal</h2>
        <div className="terminal-info">
          <span>{dotfilesPath}</span>
          <button onClick={clearTerminal} className="btn-clear">
            Clear
          </button>
        </div>
      </div>

      <div className="terminal-layout">
        <div className="terminal-main">
          <div ref={terminalRef} className="terminal" />
        </div>

        <div className="quick-commands">
          <h3>Quick Commands</h3>
          
          <div className="command-group">
            <h4>Git</h4>
            <button onClick={() => runQuickCommand('git status')}>
              Git Status
            </button>
            <button onClick={() => runQuickCommand('git log --oneline -10')}>
              Recent Commits
            </button>
            <button onClick={() => runQuickCommand('git diff')}>
              Git Diff
            </button>
          </div>

          <div className="command-group">
            <h4>System</h4>
            <button onClick={() => runQuickCommand('ls -la')}>
              List Files
            </button>
            <button onClick={() => runQuickCommand('df -h')}>
              Disk Usage
            </button>
            <button onClick={() => runQuickCommand('free -h')}>
              Memory Usage
            </button>
          </div>

          <div className="command-group">
            <h4>Dotfiles</h4>
            <button onClick={() => runQuickCommand('fish --version')}>
              Fish Version
            </button>
            <button onClick={() => runQuickCommand('nvim --version')}>
              Neovim Version
            </button>
            <button onClick={() => runQuickCommand('cat setup.sh | head -20')}>
              Setup.sh Preview
            </button>
          </div>

          <div className="command-group">
            <h4>Package Managers</h4>
            <button onClick={() => runQuickCommand('apt list --installed | wc -l')}>
              APT Packages Count
            </button>
            <button onClick={() => runQuickCommand('flatpak list | wc -l')}>
              Flatpak Apps Count
            </button>
            <button onClick={() => runQuickCommand('snap list | wc -l')}>
              Snap Packages Count
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .terminal-container {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 100px);
          padding: 20px;
        }

        .terminal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .terminal-header h2 {
          margin: 0;
        }

        .terminal-info {
          display: flex;
          align-items: center;
          gap: 15px;
          font-size: 14px;
          color: #666;
        }

        .btn-clear {
          padding: 6px 12px;
          background-color: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
        }

        .btn-clear:hover {
          background-color: #c82333;
        }

        .terminal-layout {
          display: flex;
          gap: 20px;
          flex: 1;
          min-height: 0;
        }

        .terminal-main {
          flex: 1;
          border: 1px solid #ddd;
          border-radius: 6px;
          overflow: hidden;
          background-color: #1e1e1e;
        }

        .terminal {
          width: 100%;
          height: 100%;
          padding: 10px;
        }

        .quick-commands {
          width: 280px;
          border: 1px solid #ddd;
          border-radius: 6px;
          padding: 15px;
          background-color: #f9f9f9;
          overflow-y: auto;
        }

        .quick-commands h3 {
          margin-top: 0;
          margin-bottom: 15px;
          font-size: 16px;
        }

        .command-group {
          margin-bottom: 20px;
        }

        .command-group h4 {
          margin: 0 0 10px 0;
          font-size: 14px;
          color: #666;
        }

        .command-group button {
          width: 100%;
          padding: 8px 12px;
          margin-bottom: 8px;
          background-color: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          text-align: left;
          transition: all 0.2s;
        }

        .command-group button:hover {
          background-color: #007bff;
          color: white;
          border-color: #007bff;
        }
      `}</style>
    </div>
  )
}

