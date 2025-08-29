import { useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../store';
import type { TStarshipModule } from '../types/starship';

type TAvailableModule = {
  name: string;
  displayName: string;
  category: TStarshipModule['category'];
  icon: string;
  description: string;
  defaultConfig: Record<string, unknown>;
};

const availableModules: TAvailableModule[] = [
  {
    name: 'aws',
    displayName: 'AWS',
    category: 'environment',
    icon: '☁️',
    description: 'Show AWS profile and region',
    defaultConfig: {
      format: '[ $profile($region) ]($style)',
      style: 'bold yellow'
    }
  },
  {
    name: 'battery',
    displayName: 'Battery',
    category: 'system',
    icon: '🔋',
    description: 'Show battery level and status',
    defaultConfig: {
      full_symbol: '🔋',
      charging_symbol: '⚡',
      discharging_symbol: '💀'
    }
  },
  {
    name: 'cmd_duration',
    displayName: 'Command Duration',
    category: 'prompt',
    icon: '⏱️',
    description: 'Show how long the last command took',
    defaultConfig: {
      min_time: 2000,
      format: '[ $duration ]($style)',
      style: 'yellow bold'
    }
  },
  {
    name: 'conda',
    displayName: 'Conda',
    category: 'language',
    icon: '🐍',
    description: 'Show active conda environment',
    defaultConfig: {
      format: '[ $environment ]($style)',
      style: 'green bold'
    }
  },
  {
    name: 'deno',
    displayName: 'Deno',
    category: 'language',
    icon: '🦕',
    description: 'Show Deno version',
    defaultConfig: {
      format: '[ $version ]($style)',
      style: 'green bold'
    }
  },
  {
    name: 'python',
    displayName: 'Python',
    category: 'language',
    icon: '🐍',
    description: 'Show Python version',
    defaultConfig: {
      format: '[ $version( $virtualenv) ]($style)',
      style: 'blue bold'
    }
  },
  {
    name: 'java',
    displayName: 'Java',
    category: 'language',
    icon: '☕',
    description: 'Show Java version',
    defaultConfig: {
      format: '[ $version ]($style)',
      style: 'red bold'
    }
  },
  {
    name: 'kubernetes',
    displayName: 'Kubernetes',
    category: 'environment',
    icon: '⎈',
    description: 'Show Kubernetes context',
    defaultConfig: {
      format: '[ $context( $namespace) ]($style)',
      style: 'blue bold'
    }
  },
  {
    name: 'memory_usage',
    displayName: 'Memory Usage',
    category: 'system',
    icon: '🧠',
    description: 'Show current memory usage',
    defaultConfig: {
      disabled: false,
      threshold: 75,
      format: '[ $ram( $swap) ]($style)',
      style: 'bold white'
    }
  },
  {
    name: 'package',
    displayName: 'Package',
    category: 'language',
    icon: '📦',
    description: 'Show package version from package.json',
    defaultConfig: {
      format: '[ $version ]($style)',
      style: 'green bold'
    }
  },
  {
    name: 'status',
    displayName: 'Status',
    category: 'prompt',
    icon: '💥',
    description: 'Show exit code of last command',
    defaultConfig: {
      format: '[ $status ]($style)',
      style: 'red bold',
      disabled: false
    }
  },
  {
    name: 'terraform',
    displayName: 'Terraform',
    category: 'environment',
    icon: '💠',
    description: 'Show Terraform workspace',
    defaultConfig: {
      format: '[ $workspace ]($style)',
      style: 'purple bold'
    }
  }
];

export function ModuleLibrary() {
  const { promptState, addModule, ui } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', 'system', 'git', 'language', 'environment', 'custom', 'prompt'];
  const categoryStyles: Record<string, string> = {
    system: 'bg-blue-100 text-blue-800 border-blue-200',
    git: 'bg-orange-100 text-orange-800 border-orange-200',
    language: 'bg-green-100 text-green-800 border-green-200',
    environment: 'bg-purple-100 text-purple-800 border-purple-200',
    custom: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    prompt: 'bg-gray-100 text-gray-800 border-gray-200'
  };
  
  const existingModuleNames = new Set(promptState.modules.map(m => m.name));
  
  const filteredModules = availableModules.filter(module => {
    const matchesSearch = module.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         module.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || module.category === selectedCategory;
    const notAlreadyAdded = !existingModuleNames.has(module.name);
    
    return matchesSearch && matchesCategory && notAlreadyAdded;
  });

  function handleAddModule(availableModule: TAvailableModule) {
    const newModule: TStarshipModule = {
      id: `${availableModule.name}-${Date.now()}`,
      name: availableModule.name,
      displayName: availableModule.displayName,
      category: availableModule.category,
      enabled: true,
      order: promptState.modules.length,
      config: availableModule.defaultConfig
    };
    
    addModule(newModule);
  }

  if (!ui.sidebarOpen) {
    return null;
  }

  return (
    <div className="module-library bg-white dark:bg-haptic.surface border-r border-gray-200 dark:border-haptic.border w-80 h-full overflow-hidden flex flex-col text-gray-900 dark:text-haptic.text">
      <div className="library-header p-4 border-b border-gray-200 dark:border-haptic.border">
        <h2 className="font-semibold text-gray-900 mb-4">Module Library</h2>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search modules..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-haptic.border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-haptic.muted text-gray-900 dark:text-haptic.text"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
        
        <div className="category-filter">
          <div className="flex flex-wrap gap-1">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={clsx(
                  'px-3 py-1 text-xs rounded-full border',
                  selectedCategory === category 
                    ? 'bg-blue-100 text-blue-800 border-blue-200' 
                    : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="library-content flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {filteredModules.map(module => (
            <div
              key={module.name}
              className="module-item bg-gray-50 dark:bg-haptic.muted border border-gray-200 dark:border-haptic.border rounded-lg p-3 hover:bg-gray-100 dark:hover:bg-haptic.surface transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-lg">{module.icon}</span>
                    <h3 className="font-medium text-gray-900">{module.displayName}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{module.description}</p>
                  <div className="flex items-center space-x-2">
                    <span className={clsx(
                      'text-xs px-2 py-1 rounded border',
                      categoryStyles[module.category] || categoryStyles.prompt
                    )}>
                      {module.category}
                    </span>
                    <code className="text-xs bg-white px-2 py-1 rounded border">
                      ${module.name}
                    </code>
                  </div>
                </div>
                
                <button
                  onClick={() => handleAddModule(module)}
                  className="ml-3 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  title={`Add ${module.displayName} module`}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
        
        {filteredModules.length === 0 && (
          <div className="empty-state text-center py-8">
            <div className="text-gray-400 mb-2">
              <Search size={48} className="mx-auto" />
            </div>
            <p className="text-gray-600">No modules found</p>
            {searchTerm && (
              <p className="text-sm text-gray-500 mt-1">
                Try adjusting your search or category filter
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
