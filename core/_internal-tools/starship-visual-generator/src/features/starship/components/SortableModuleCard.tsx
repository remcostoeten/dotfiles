import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, Settings, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../store';
import type { TStarshipModule } from '../types/starship';

type TProps = {
  module: TStarshipModule;
  isSelected: boolean;
  onSelect: () => void;
};

export function SortableModuleCard({ module, isSelected, onSelect }: TProps) {
  const { toggleModule, removeModule } = useStore();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const categoryColors: Record<string, string> = {
    'system': 'bg-blue-100 text-blue-800 border-blue-200',
    'git': 'bg-orange-100 text-orange-800 border-orange-200',
    'language': 'bg-green-100 text-green-800 border-green-200',
    'environment': 'bg-purple-100 text-purple-800 border-purple-200',
    'custom': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'prompt': 'bg-gray-100 text-gray-800 border-gray-200'
  };

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    toggleModule(module.id);
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    removeModule(module.id);
  }

  function handleSettingsClick(e: React.MouseEvent) {
    e.stopPropagation();
    onSelect();
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'module-card',
'bg-white dark:bg-haptic.surface border-2 dark:border-haptic.border rounded-lg p-4 mb-3 shadow-sm dark:text-haptic.text',
        'transition-all duration-200 hover:shadow-md',
        isSelected && 'border-blue-500 shadow-md',
        isDragging && 'opacity-50 rotate-2 scale-105'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            className="drag-handle cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 dark:hover:bg-haptic.muted rounded"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={16} className="text-gray-400 dark:text-haptic.subtext" />
          </button>
          
          <div>
            <h3 className="font-medium text-gray-900 dark:text-haptic.text">{module.displayName}</h3>
            <div className="flex items-center space-x-2 mt-1">
              <span 
                className={clsx(
                  'text-xs px-2 py-1 rounded border dark:bg-haptic.muted dark:text-haptic.text dark:border-haptic.border',
                  categoryColors[module.category] || categoryColors.prompt
                )}
              >
                {module.category}
              </span>
              <code className="text-xs bg-gray-100 dark:bg-haptic.surface dark:text-haptic.text px-2 py-1 rounded border border-gray-200 dark:border-haptic.border">
                ${module.name}
              </code>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleToggle}
            className={clsx(
              'p-2 rounded hover:bg-gray-100 dark:hover:bg-haptic.muted',
              module.enabled ? 'text-green-600' : 'text-gray-400 dark:text-haptic.subtext'
            )}
            title={module.enabled ? 'Hide module' : 'Show module'}
          >
            {module.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          
          <button
            onClick={handleSettingsClick}
            className={clsx(
              'p-2 rounded hover:bg-gray-100 dark:hover:bg-haptic.muted',
              isSelected ? 'text-blue-600 bg-blue-50 dark:bg-haptic.muted dark:text-haptic.text' : 'text-gray-600 dark:text-haptic.subtext'
            )}
            title="Configure module"
          >
            <Settings size={16} />
          </button>
          
          <button
            onClick={handleRemove}
            className="p-2 rounded hover:bg-red-50 dark:hover:bg-haptic.muted text-red-600"
            title="Remove module"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      
      {Object.keys(module.config || {}).length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-haptic.border">
          <div className="text-xs text-gray-500 dark:text-haptic.subtext">
            {Object.keys(module.config).length} configuration option(s)
          </div>
        </div>
      )}
    </div>
  );
}
