import inquirer from 'inquirer';
import { ISetupModule } from './types.js';
import { log } from '../utils/system.js';

export class Setup {
  private modules: Map<string, ISetupModule> = new Map();
  private completed: Set<string> = new Set();

  constructor(modules: ISetupModule[]) {
    modules.forEach(module => this.modules.set(module.name, module));
  }

  private async confirmModule(module: ISetupModule): Promise<boolean> {
    if (!module.isOptional) return true;

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Do you want to install ${module.name}? (${module.description})`,
      default: true
    }]);

    return confirm;
  }

  private async installDependencies(module: ISetupModule): Promise<boolean> {
    for (const dep of module.dependencies) {
      const depModule = this.modules.get(dep);
      if (!depModule) {
        log(`Missing dependency: ${dep} for module ${module.name}`, 'error');
        return false;
      }

      if (!this.completed.has(dep)) {
        const success = await this.installModule(depModule);
        if (!success) return false;
      }
    }
    return true;
  }

  private async installModule(module: ISetupModule): Promise<boolean> {
    if (this.completed.has(module.name)) return true;

    log(`Processing ${module.name}...`, 'info');

    // Check dependencies
    const depsOk = await this.installDependencies(module);
    if (!depsOk) return false;

    // Check if already installed
    const isInstalled = await module.check();
    
    if (isInstalled) {
      const { reinstall } = await inquirer.prompt([{
        type: 'confirm',
        name: 'reinstall',
        message: `${module.name} is already installed. Reinstall?`,
        default: false
      }]);

      if (!reinstall) {
        log(`Skipping ${module.name} (already installed)`, 'info');
        this.completed.add(module.name);
        return true;
      }
    }

    // Install
    const installSuccess = await module.install();
    if (!installSuccess) return false;

    // Configure
    const configSuccess = await module.configure();
    if (!configSuccess) return false;

    this.completed.add(module.name);
    return true;
  }

  async run(): Promise<void> {
    log('Starting setup...', 'info');

    for (const [_, module] of this.modules) {
      if (await this.confirmModule(module)) {
        const success = await this.installModule(module);
        if (!success && !module.isOptional) {
          log(`Failed to install required module ${module.name}`, 'error');
          process.exit(1);
        }
      }
    }

    log('Setup completed successfully!', 'success');
  }
}