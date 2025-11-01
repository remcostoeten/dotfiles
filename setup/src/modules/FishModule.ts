import { BaseModule } from '../core/BaseModule.js';
import { checkCommand, runCommand, createSymlink } from '../utils/system.js';
import { homedir } from 'os';
import { join } from 'path';

export class FishModule extends BaseModule {
  private readonly symlinks = [
    {
      source: join(process.cwd(), 'cfg'),
      target: join(homedir(), '.config', 'fish', 'config.fish'),
      description: 'Fish config'
    }
  ];

  // Note: This assumes the setup script is run from the dotfiles root directory
  // The 'cfg' file should be in the dotfiles root

  constructor() {
    super(
      'fish',
      'Fish shell configuration',
      false, // not optional
      ['curl'] // dependencies
    );
  }

  async check(): Promise<boolean> {
    return await checkCommand('fish');
  }

  async install(): Promise<boolean> {
    // Install Fish shell if not present
    if (!(await this.check())) {
      const result = await runCommand('apt-get', ['install', '-y', 'fish'], { sudo: true });
      if (!result.success) return this.handleResult(result, 'Fish installation');
    }
    return true;
  }

  async configure(): Promise<boolean> {
    // Create symlinks
    for (const link of this.symlinks) {
      const result = await createSymlink(link.source, link.target);
      if (!result.success) {
        return this.handleResult(result, `Symlinking ${link.description}`);
      }
    }

    // Set as default shell if requested
    // This could be made interactive with inquirer
    const currentShell = process.env.SHELL;
    if (!currentShell?.includes('fish')) {
      const result = await runCommand('chsh', ['-s', '/usr/bin/fish'], { sudo: true });
      return this.handleResult(result, 'Setting Fish as default shell');
    }

    return true;
  }
}