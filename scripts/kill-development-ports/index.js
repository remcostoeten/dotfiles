#!/usr/bin/env node

/**
 * Kill Dev - Development Process Terminator
 * 
 * A powerful utility to hunt down and terminate stubborn development processes
 * running on common ports used by Next.js, React, Vite, and other dev servers.
 * 
 * Features:
 * - Scans default development ports (3000-3010, 5000-5005, 5173-5183)
 * - Interactive process selection with fuzzy search
 * - Supports port ranges and individual port specification
 * - Clean ASCII interface without excessive colors/emojis
 * - Cross-platform support (Linux, macOS, Windows)
 * 
 * Usage:
 *   kill-dev                    # Scan default ports
 *   kill-dev 3000              # Scan specific port
 *   kill-dev 3000 8080         # Scan multiple ports
 *   kill-dev 3000-3005         # Scan port range
 *   kill-dev 3000 8000-8010    # Mix ports and ranges
 * 
 * Dependencies: inquirer, figlet, ora, cli-table3
 * Author: Remco Stoeten
 */

const inquirer = require("inquirer");
const chalk = require("chalk");
const figlet = require("figlet");
const ora = require("ora");
const Table = require("cli-table3");
const { exec } = require("child_process");

// Default ports to scan (Next.js/React, generic dev, and Vite common ports)
const DEFAULT_PORTS = [
  // Next.js/React ports (3000-3010)
  ...Array.from({ length: 11 }, (_, i) => 3000 + i),
  // Generic dev ports often used by local servers (5000-5005)
  ...Array.from({ length: 6 }, (_, i) => 5000 + i),
  // Vite ports (5173-5183)
  ...Array.from({ length: 11 }, (_, i) => 5173 + i)
];

/**
 * Display help information
 */
function showHelp() {
  const asciiArt = `
▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
██                                                                    ██
██  ▄▄▄  ▄▄▄ ▄▄▄ ▄▄▄       ▄▄▄▄▄ ▄▄▄▄▄ ▄▄  ▄                        ██
██  █ █▄▄██▄▄█ █▄██▄▄       █ █▄▄█▄▄▄█▄██▄▄█▄▄                      ██
██  █▄▄▄█▄▄█▄▄█▄▄█▄▄▄       █▄▄▄█▄▄▄█▄▄█▄▄█▄▄                      ██
██                                                                    ██
██                 Process Port Terminator v1.0.0                    ██
██                                                                    ██
████████████████████████████████████████████████████████████████████████
`;
  console.log(chalk.gray(asciiArt));
  
  const helpContent = `
USAGE:
  kill-dev [ports...]
  kill-port [ports...]

OPTIONS:
  -h, --help     Show this help message
  -v, --version  Show version number

EXAMPLES:
  kill-dev              # Scan default ports (3000-3010, 5173-5183)
  kill-dev 3000         # Scan specific port
  kill-dev 3000 8080    # Scan multiple ports
  kill-dev 3000-3005    # Scan port range
  kill-dev 3000 8000-8010 # Mix ports and ranges

DEFAULT PORTS:
  Next.js/React: 3000-3010
  Generic dev: 5000-5005
  Vite: 5173-5183

INTERACTIVE CONTROLS:
  Space    Select/deselect processes
  Enter    Confirm selection
  Ctrl+C   Exit
  `;
  
  console.log(helpContent);
}

/**
 * Parse command-line arguments for port numbers
 */
function parsePortsFromArgs(args) {
  // Check for help flags
  if (args.includes('-h') || args.includes('--help')) {
    showHelp();
    process.exit(0);
  }
  
  // Check for version flag
  if (args.includes('-v') || args.includes('--version')) {
    const pkg = require('./package.json');
    console.log(`Kill Dev v${pkg.version}\n`);
    process.exit(0);
  }
  
  if (args.length === 0) return DEFAULT_PORTS;
  
  const ports = new Set();
  for (const arg of args) {
    if (arg.includes("-") && !arg.startsWith('-')) {
      // Handle port ranges (e.g., "3000-3005")
      const [startStr, endStr] = arg.split("-");
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end) && start <= end && start > 0 && end <= 65535) {
        for (let i = start; i <= end; i++) {
          ports.add(i);
        }
      } else {
        console.warn(`Warning: Invalid port range '${arg}'. Skipping.`);
      }
    } else if (!arg.startsWith('-')) {
      // Handle single ports
      const port = parseInt(arg, 10);
      if (!isNaN(port) && port > 0 && port <= 65535) {
        ports.add(port);
      } else {
        console.warn(`Warning: Invalid port '${arg}'. Skipping.`);
      }
    }
  }
  return Array.from(ports);
}

/**
 * Find processes running on a specific port
 */
async function findProcessesByPort(port) {
  return new Promise((resolve) => {
    let cmd;
    
    if (process.platform === 'win32') {
      cmd = `netstat -ano | findstr :${port}`;
    } else {
      // Use ss instead of lsof for better detection on Linux/Unix
      cmd = `ss -tlnp | grep :${port}`;
    }
    
    exec(cmd, (error, stdout) => {
      if (error || !stdout) {
        resolve(null);
        return;
      }
      
      if (process.platform === 'win32') {
        // Parse Windows netstat output
        const lines = stdout.trim().split('\n');
        const processes = new Set();
        
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const pid = parseInt(parts[4], 10);
            if (!isNaN(pid)) {
              processes.add(pid);
            }
          }
        }
        
        if (processes.size > 0) {
          // Get process names for the PIDs
          const pids = Array.from(processes);
          Promise.all(pids.map(pid => getProcessNameByPid(pid))).then(names => {
            resolve(pids.map((pid, i) => ({
              pid,
              name: names[i] || 'unknown',
              port
            })));
          });
        } else {
          resolve(null);
        }
      } else {
        // Parse Unix ss output
        // Example: LISTEN 0 511 *:3000 *:* users:(("next-server (v1",pid=195091,fd=24))
        const lines = stdout.trim().split('\n');
        const processes = [];
        
        for (const line of lines) {
          // Extract PID and process name from users:(("name",pid=12345,fd=...))
          const userMatch = line.match(/users:\(\("([^"]+)",pid=(\d+),/);
          if (userMatch) {
            const name = userMatch[1];
            const pid = parseInt(userMatch[2], 10);
            if (!isNaN(pid)) {
              processes.push({ pid, name, port });
            }
          }
        }
        
        resolve(processes.length > 0 ? processes : null);
      }
    });
  });
}

/**
 * Get process name by PID on Windows
 */
async function getProcessNameByPid(pid) {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, (error, stdout) => {
        if (error || !stdout) {
          resolve('unknown');
          return;
        }
        
        try {
          // Parse CSV format
          const match = stdout.match(/"([^"]+)"/);
          resolve(match ? match[1] : 'unknown');
        } catch (e) {
          resolve('unknown');
        }
      });
    } else {
      exec(`ps -p ${pid} -o comm=`, (error, stdout) => {
        resolve(error ? 'unknown' : stdout.trim());
      });
    }
  });
}

/**
 * Kill process by PID
 */
async function killProcess(pid) {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32'
      ? `taskkill /PID ${pid} /F`
      : `kill -9 ${pid}`;
    
    exec(cmd, (error) => {
      resolve(!error);
    });
  });
}

/**
 * Main function
 */
async function main() {
  // Display ASCII art header
  const asciiArt = `
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║    ██╗  ██╗██╗██╗     ██╗         ██████╗ ███████╗██╗   ██╗  ║
║    ██║ ██╔╝██║██║     ██║         ██╔══██╗██╔════╝██║   ██║  ║
║    █████╔╝ ██║██║     ██║         ██║  ██║█████╗  ██║   ██║  ║
║    ██╔═██╗ ██║██║     ██║         ██║  ██║██╔══╝  ╚██╗ ██╔╝  ║
║    ██║  ██╗██║███████╗███████╗    ██████╔╝███████╗ ╚████╔╝   ║
║    ╚═╝  ╚═╝╚═╝╚══════╝╚══════╝    ╚═════╝ ╚══════╝  ╚═══╝    ║
║                                                               ║
║             Kill Dev - 🎯 v1.0.0 - by @remcostoeten        ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`;
  console.log(chalk.gray(asciiArt));

  const args = process.argv.slice(2);
  const ports = parsePortsFromArgs(args);

  const spinner = ora({
    text: `Scanning for processes on ports: ${ports.join(', ')}...`,
    spinner: 'dots12'
  }).start();

  // Find processes on all ports
  const processesPromises = ports.map(findProcessesByPort);
  const results = await Promise.all(processesPromises);
  spinner.stop();

  // Flatten and filter results
  const allProcesses = results
    .filter(result => result !== null)
    .flat();

  if (allProcesses.length === 0) {
    console.log(`\n${chalk.gray('▪')} No active processes found on the specified ports.`);
    console.log(`${chalk.gray('▪')} All ports appear to be free.\n`);
    return;
  }

  // Display found processes in a monochrome table
  const table = new Table({
    head: [chalk.bold('PORT'), chalk.bold('PID'), chalk.bold('PROCESS NAME')],
    style: { 
      head: [], 
      border: ['gray'],
      'padding-left': 2,
      'padding-right': 2
    },
    colWidths: [10, 12, 35],
    chars: {
      'top': '═',
      'top-mid': '╤',
      'top-left': '╔',
      'top-right': '╗',
      'bottom': '═',
      'bottom-mid': '╧',
      'bottom-left': '╚',
      'bottom-right': '╝',
      'left': '║',
      'left-mid': '╟',
      'mid': '─',
      'mid-mid': '┼',
      'right': '║',
      'right-mid': '╢',
      'middle': '│'
    }
  });

  allProcesses.forEach((proc, index) => {
    const rowColor = index % 2 === 0 ? chalk.white : chalk.gray;
    table.push([
      rowColor(proc.port.toString()),
      rowColor(proc.pid.toString()),
      rowColor(proc.name)
    ]);
  });

  console.log(`\n${chalk.bold('◆')} Found ${chalk.bold(allProcesses.length)} active process(es):\n`);
  console.log(table.toString());

  try {
    // Prompt user to select processes
    const { selectedProcesses } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selectedProcesses',
      message: 'Select processes to kill:',
      choices: allProcesses.map(proc => ({
        name: `Port ${proc.port} (${proc.name})`,
        value: proc
      })),
      pageSize: Math.min(allProcesses.length, 15)
    }]);

    if (selectedProcesses.length === 0) {
      console.log('No processes selected. Exiting.');
      return;
    }

    console.log('\nAttempting to terminate selected processes...\n');
    let successCount = 0;

    for (const proc of selectedProcesses) {
      const termSpinner = ora(`Terminating process on port ${proc.port} (PID: ${proc.pid})...`).start();
      const success = await killProcess(proc.pid);
      termSpinner.stop();

      if (success) {
        console.log(`Successfully terminated process (PID: ${proc.pid}) on port ${proc.port}`);
        successCount++;
      } else {
        console.log(`Failed to terminate process (PID: ${proc.pid}) on port ${proc.port}`);
      }
    }

    // Final summary
    const summaryContent = [
      'Termination Summary',
      '',
      `${successCount} process(es) were successfully terminated.`,
      selectedProcesses.length > successCount ? `${selectedProcesses.length - successCount} process(es) could not be terminated.` : ''
    ].filter(Boolean).join('\n');

    console.log('\n' + summaryContent);

    if (successCount < selectedProcesses.length) {
      console.log('\nYou may need to run this command with elevated privileges (sudo).\n');
    }
  } catch (error) {
    console.error('An error occurred:', error.message);
  }
}

main().catch(error => {
  console.error(chalk.red("A critical error occurred:"), error);
  process.exit(1);
});