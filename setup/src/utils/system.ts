import { execa } from 'execa';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import chalk from 'chalk';
import { TInstallResult } from '../core/types.js';

export async function checkCommand(command: string): Promise<boolean> {
  try {
    await execa('which', [command]);
    return true;
  } catch {
    return false;
  }
}

export async function runCommand(
  command: string,
  args: string[] = [],
  options: { sudo?: boolean; } = {}
): Promise<TInstallResult> {
  try {
    const finalCommand = options.sudo ? 'sudo' : command;
    const finalArgs = options.sudo ? [command, ...args] : args;
    
    const { stdout, stderr } = await execa(finalCommand, finalArgs);
    return {
      success: true,
      message: stdout || stderr
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to run command: ${command} ${args.join(' ')}`,
      error: error as Error
    };
  }
}

export async function createSymlink(source: string, target: string): Promise<TInstallResult> {
  try {
    if (!existsSync(source)) {
      return {
        success: false,
        message: `Source file does not exist: ${source}`
      };
    }

    const targetDir = dirname(target);
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    if (existsSync(target)) {
      await execa('rm', ['-f', target]);
    }

    await execa('ln', ['-s', source, target]);
    return {
      success: true,
      message: `Successfully created symlink from ${source} to ${target}`
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to create symlink from ${source} to ${target}`,
      error: error as Error
    };
  }
}

export function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info'): void {
  const colors = {
    info: chalk.blue,
    success: chalk.green,
    error: chalk.red,
    warning: chalk.yellow
  };

  console.log(colors[type](message));
}