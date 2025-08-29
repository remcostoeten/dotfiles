import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TAppState, TStarshipModule, TColorPalette, TScenario } from '../types/starship';
import { generateToml, parseTomlToState } from '../lib/toml-generator';

type TStoreActions = {
  // Module actions
  addModule: (module: TStarshipModule) => void;
  removeModule: (moduleId: string) => void;
  updateModule: (moduleId: string, updates: Partial<TStarshipModule>) => void;
  toggleModule: (moduleId: string) => void;
  reorderModules: (moduleIds: string[]) => void;
  
  // Selection actions  
  selectModule: (moduleId: string | null) => void;
  
  // Palette actions
  setPalette: (palette: TColorPalette) => void;
  updatePaletteColor: (colorKey: string, colorValue: string) => void;
  
  // Scenario actions
  setActiveScenario: (scenarioId: string) => void;
  
  // UI actions
  toggleSidebar: () => void;
  setPreviewMode: (mode: 'live' | 'scenarios') => void;
  
  // Import/Export actions
  importFromToml: (tomlContent: string) => void;
  exportToToml: () => string;
  resetState: () => void;
  loadPreset: (preset: Partial<TAppState>) => void;
};

// Default color palettes
const defaultPalettes: Record<string, TColorPalette> = {
  gruvbox_dark: {
    name: 'gruvbox_dark',
    colors: {
      color_fg0: '#fbf1c7',
      color_bg1: '#3c3836',
      color_bg3: '#665c54',
      color_blue: '#458588',
      color_aqua: '#689d6a',
      color_green: '#98971a',
      color_orange: '#d65d0e',
      color_purple: '#b16286',
      color_red: '#cc241d',
      color_yellow: '#d79921'
    }
  },
  fire: {
    name: 'fire',
    colors: {
      color_fg0: '#ffffff',
      color_bg1: '#1a0000',
      color_bg3: '#4d0000',
      color_blue: '#ff6b35',
      color_aqua: '#ff8c42',
      color_green: '#ffb347',
      color_orange: '#ff4500',
      color_purple: '#dc143c',
      color_red: '#ff0000',
      color_yellow: '#ffd700'
    }
  },
  ice: {
    name: 'ice',
    colors: {
      color_fg0: '#e6f3ff',
      color_bg1: '#0d1a26',
      color_bg3: '#1a334d',
      color_blue: '#4da6ff',
      color_aqua: '#66ccff',
      color_green: '#80dfff',
      color_orange: '#99e6ff',
      color_purple: '#b3f0ff',
      color_red: '#ff9999',
      color_yellow: '#ccf2ff'
    }
  }
};

// Default modules available
const defaultModules: TStarshipModule[] = [
  {
    id: 'os-1',
    name: 'os',
    displayName: 'Operating System',
    category: 'system',
    enabled: true,
    order: 0,
    config: {
      disabled: false,
      style: 'bg:color_orange fg:color_fg0',
      symbols: {
        Linux: '󰌽',
        Ubuntu: '󰕈',
        Arch: '󰣇',
        Fedora: '󰣛',
        Debian: '󰣚'
      }
    }
  },
  {
    id: 'username-1',
    name: 'username',
    displayName: 'Username',
    category: 'system',
    enabled: true,
    order: 1,
    config: {
      show_always: true,
      style_user: 'bg:color_yellow fg:color_fg0',
      style_root: 'bg:color_red fg:color_fg0',
      format: '[ $user ]($style)'
    }
  },
  {
    id: 'directory-1',
    name: 'directory',
    displayName: 'Directory',
    category: 'system',
    enabled: true,
    order: 3,
    config: {
      style: 'fg:color_fg0 bg:color_aqua',
      format: '[ $path ]($style)',
      truncation_length: 3,
      truncation_symbol: '…/',
      substitutions: {
        Documents: '󰈙 ',
        Downloads: ' ',
        Music: '󰝚 ',
        Pictures: ' '
      }
    }
  },
  {
    id: 'git_branch-1',
    name: 'git_branch',
    displayName: 'Git Branch',
    category: 'git',
    enabled: true,
    order: 4,
    config: {
      symbol: '',
      style: 'bg:color_blue',
      format: '[[ $symbol $branch ](fg:color_fg0 bg:color_blue)]($style)'
    }
  },
  {
    id: 'git_status-1',
    name: 'git_status',
    displayName: 'Git Status',
    category: 'git',
    enabled: true,
    order: 5,
    config: {
      style: 'bg:color_blue',
      format: '[[($all_status$ahead_behind )](fg:color_fg0 bg:color_blue)]($style)'
    }
  },
  {
    id: 'nodejs-1',
    name: 'nodejs',
    displayName: 'Node.js',
    category: 'language',
    enabled: false,
    order: 6,
    config: {
      symbol: '',
      style: 'bg:color_bg3',
      format: '[[ $symbol( $version) ](fg:color_fg0 bg:color_bg3)]($style)'
    }
  },
  {
    id: 'time-1',
    name: 'time',
    displayName: 'Time',
    category: 'prompt',
    enabled: true,
    order: 7,
    config: {
      disabled: false,
      time_format: '%R',
      style: 'bg:color_purple',
      format: '[[  $time ](fg:color_fg0 bg:color_purple)]($style)'
    }
  },
  {
    id: 'line_break-1',
    name: 'line_break',
    displayName: 'Line Break',
    category: 'prompt',
    enabled: true,
    order: 8,
    config: {
      disabled: false
    }
  },
  {
    id: 'character-1',
    name: 'character',
    displayName: 'Character',
    category: 'prompt',
    enabled: true,
    order: 9,
    config: {
      disabled: false,
      success_symbol: '[](bold fg:color_green)',
      error_symbol: '[](bold fg:color_red)',
      vimcmd_symbol: '[](bold fg:color_green)'
    }
  }
];

const defaultScenarios: TScenario[] = [
  {
    id: 'clean-repo',
    name: 'Clean Repository',
    description: 'Clean git repository with no changes',
    context: {
      directory: '/home/user/project',
      gitStatus: 'clean',
      hasNodeProject: true
    }
  },
  {
    id: 'dirty-repo',
    name: 'Dirty Repository',
    description: 'Git repository with uncommitted changes',
    context: {
      directory: '/home/user/project',
      gitStatus: 'dirty',
      hasNodeProject: true
    }
  },
  {
    id: 'deep-directory',
    name: 'Deep Directory',
    description: 'Very deep directory structure',
    context: {
      directory: '/home/user/very/deep/directory/structure/that/should/truncate'
    }
  }
];

const initialState: TAppState = {
  promptState: {
    format: '',
    modules: defaultModules,
    palette: defaultPalettes.gruvbox_dark,
    customCommands: {}
  },
  selectedModule: null,
  activeScenario: 'clean-repo',
  ui: {
    sidebarOpen: true,
    previewMode: 'live'
  }
};

export const useStore = create<TAppState & TStoreActions>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // Module actions
      addModule: (module) => set((state) => ({
        promptState: {
          ...state.promptState,
          modules: [...state.promptState.modules, module]
        }
      })),
      
      removeModule: (moduleId) => set((state) => ({
        promptState: {
          ...state.promptState,
          modules: state.promptState.modules.filter(m => m.id !== moduleId)
        },
        selectedModule: state.selectedModule === moduleId ? null : state.selectedModule
      })),
      
      updateModule: (moduleId, updates) => set((state) => ({
        promptState: {
          ...state.promptState,
          modules: state.promptState.modules.map(m => 
            m.id === moduleId ? { ...m, ...updates } : m
          )
        }
      })),
      
      toggleModule: (moduleId) => set((state) => ({
        promptState: {
          ...state.promptState,
          modules: state.promptState.modules.map(m => 
            m.id === moduleId ? { ...m, enabled: !m.enabled } : m
          )
        }
      })),
      
      reorderModules: (moduleIds) => set((state) => {
        const moduleMap = new Map(state.promptState.modules.map(m => [m.id, m]));
        const reorderedModules = moduleIds.map((id, index) => ({
          ...moduleMap.get(id)!,
          order: index
        }));
        
        return {
          promptState: {
            ...state.promptState,
            modules: reorderedModules
          }
        };
      }),
      
      // Selection actions
      selectModule: (moduleId) => set({ selectedModule: moduleId }),
      
      // Palette actions
      setPalette: (palette) => set((state) => ({
        promptState: {
          ...state.promptState,
          palette
        }
      })),
      
      updatePaletteColor: (colorKey, colorValue) => set((state) => ({
        promptState: {
          ...state.promptState,
          palette: {
            ...state.promptState.palette,
            colors: {
              ...state.promptState.palette.colors,
              [colorKey]: colorValue
            }
          }
        }
      })),
      
      // Scenario actions
      setActiveScenario: (scenarioId) => set({ activeScenario: scenarioId }),
      
      // UI actions
      toggleSidebar: () => set((state) => ({
        ui: {
          ...state.ui,
          sidebarOpen: !state.ui.sidebarOpen
        }
      })),
      
      setPreviewMode: (mode) => set((state) => ({
        ui: {
          ...state.ui,
          previewMode: mode
        }
      })),
      
      // Import/Export actions
      importFromToml: (tomlContent) => {
        const partial = parseTomlToState(tomlContent);
        set((state) => ({
          promptState: {
            format: partial.format ?? state.promptState.format,
            modules: partial.modules && partial.modules.length > 0 ? partial.modules : state.promptState.modules,
            palette: partial.palette ?? state.promptState.palette,
            customCommands: partial.customCommands ?? state.promptState.customCommands
          }
        }));
      },
      
      exportToToml: () => {
        const state = get();
        return generateToml(state.promptState);
      },
      
      resetState: () => set(initialState),
      
      loadPreset: (preset) => set((state) => ({
        ...state,
        ...preset
      }))
    }),
    {
      name: 'starship-generator-store',
      version: 1
    }
  )
);

export { defaultPalettes, defaultScenarios };
