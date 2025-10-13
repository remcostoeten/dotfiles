import { ISetupModule, TInstallResult } from './types.js';
import { log } from '../utils/system.js';

export abstract class BaseModule implements ISetupModule {
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly isOptional: boolean = false,
    public readonly dependencies: string[] = []
  ) {}

  protected async handleResult(result: TInstallResult, context: string): Promise<boolean> {
    if (result.success) {
      log(`${context}: ${result.message}`, 'success');
      return true;
    } else {
      log(`${context} failed: ${result.message}`, 'error');
      if (result.error) {
        log(`Error details: ${result.error.message}`, 'error');
      }
      return false;
    }
  }

  abstract check(): Promise<boolean>;
  abstract install(): Promise<boolean>;
  abstract configure(): Promise<boolean>;
}