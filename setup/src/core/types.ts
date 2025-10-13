export type TSymlink = {
  source: string;
  target: string;
  description: string;
};

export type TPackage = {
  name: string;
  description: string;
  skipIfInstalled?: boolean;
  // For packages that need special installation commands
  customInstall?: string;
};

export type TModuleConfig = {
  name: string;
  description: string;
  enabled: boolean;
  optional?: boolean;
  dependencies?: string[];
};

export interface ISetupModule {
  name: string;
  description: string;
  isOptional: boolean;
  dependencies: string[];
  check(): Promise<boolean>;
  install(): Promise<boolean>;
  configure(): Promise<boolean>;
}

export type TInstallResult = {
  success: boolean;
  message: string;
  error?: Error;
};