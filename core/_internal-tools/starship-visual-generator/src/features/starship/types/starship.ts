export type TStarshipModule = {
  id: string;
  name: string;
  displayName: string;
  category: 'prompt' | 'directory' | 'git' | 'language' | 'environment' | 'custom' | 'system';
  enabled: boolean;
  config: Record<string, unknown>;
  order: number;
};

export type TColorPalette = {
  name: string;
  colors: Record<string, string>;
};

export type TPromptState = {
  format: string;
  modules: TStarshipModule[];
  palette: TColorPalette;
  customCommands: Record<string, string>;
};

export type TScenario = {
  id: string;
  name: string;
  description: string;
  context: {
    directory: string;
    gitStatus?: 'clean' | 'dirty' | 'detached' | 'ahead' | 'behind';
    hasNodeProject?: boolean;
    hasRustProject?: boolean;
    hasGoProject?: boolean;
    hasPythonProject?: boolean;
    dockerContext?: string;
    kubernetesContext?: string;
  };
};

export type TBuiltinModules = {
  [key: string]: {
    displayName: string;
    category: TStarshipModule['category'];
    defaultConfig: Record<string, unknown>;
    icon: string;
    description: string;
  };
};

export type TAppState = {
  promptState: TPromptState;
  selectedModule: string | null;
  activeScenario: string;
  ui: {
    sidebarOpen: boolean;
    previewMode: 'live' | 'scenarios';
  };
};
