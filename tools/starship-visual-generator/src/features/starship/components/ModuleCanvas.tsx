import { 
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers';
import { SortableModuleCard } from './SortableModuleCard';
import { useStore } from '../store';
import type { DragEndEvent } from '@dnd-kit/core';

export function ModuleCanvas() {
  const { promptState, reorderModules, selectedModule, selectModule } = useStore();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const enabledModules = promptState.modules
    .filter(module => module.enabled)
    .sort((a, b) => a.order - b.order);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = enabledModules.findIndex(m => m.id === active.id);
      const newIndex = enabledModules.findIndex(m => m.id === over.id);
      
      const newOrder = arrayMove(enabledModules, oldIndex, newIndex);
      reorderModules(newOrder.map(m => m.id));
    }
  }

  return (
    <div className="module-canvas bg-white dark:bg-haptic.surface border dark:border-haptic.border">
      <div className="canvas-header">
        <h2>Prompt Structure</h2>
        <p>Drag modules to reorder them in your prompt</p>
      </div>
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <SortableContext 
          items={enabledModules.map(m => m.id)} 
          strategy={verticalListSortingStrategy}
        >
          <div className="module-list">
            {enabledModules.map(module => (
              <SortableModuleCard
                key={module.id}
                module={module}
                isSelected={selectedModule === module.id}
                onSelect={() => selectModule(
                  selectedModule === module.id ? null : module.id
                )}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      
      {enabledModules.length === 0 && (
        <div className="empty-state">
          <p>No modules enabled. Add modules from the sidebar to get started.</p>
        </div>
      )}
    </div>
  );
}
