import clsx from 'clsx';

type TProps = {
  active: 'starship' | 'ascii' | 'explorer' | 'aliases';
  onSelect: (key: 'starship' | 'ascii' | 'explorer' | 'aliases') => void;
};

export function FeatureSidebar({ active, onSelect }: TProps) {
  const items: Array<{ key: 'starship' | 'ascii' | 'explorer' | 'aliases'; label: string }> = [
    { key: 'starship', label: 'Starship' },
    { key: 'ascii', label: 'ASCII Intro' },
    { key: 'explorer', label: 'Dotfiles Explorer' },
    { key: 'aliases', label: 'Alias Builder' },
  ];
  
  function handleClick(k: 'starship' | 'ascii' | 'explorer' | 'aliases') {
    onSelect(k);
  }
  
  return (
    <aside className="w-56 border-r border-gray-200 dark:border-haptic.border bg-white dark:bg-haptic.surface flex-shrink-0">
      <div className="p-4">
        <div className="text-xs uppercase text-gray-500 dark:text-haptic.subtext font-semibold mb-2">Features</div>
        <div className="space-y-1">
          {items.map(function item(i){
            const isActive = i.key === active;
            return (
              <button
                key={i.key}
                onClick={function click(){ handleClick(i.key); }}
                className={clsx(
                  'w-full text-left px-3 py-2 rounded-lg border transition-colors',
                  isActive ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-haptic.muted dark:text-haptic.text dark:border-haptic.border' : 'bg-white dark:bg-transparent text-gray-700 dark:text-haptic.text border-gray-200 dark:border-haptic.border hover:bg-gray-50 dark:hover:bg-haptic.muted'
                )}
              >
                {i.label}
              </button>
            ) as any;
          })}
        </div>
      </div>
    </aside>
  );
}

