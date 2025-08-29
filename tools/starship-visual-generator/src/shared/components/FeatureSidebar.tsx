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
    <aside className="w-56 border-r border-gray-200 bg-white flex-shrink-0">
      <div className="p-4">
        <div className="text-xs uppercase text-gray-500 font-semibold mb-2">Features</div>
        <div className="space-y-1">
          {items.map(function item(i){
            const isActive = i.key === active;
            return (
              <button
                key={i.key}
                onClick={function click(){ handleClick(i.key); }}
                className={clsx(
                  'w-full text-left px-3 py-2 rounded-lg border transition-colors',
                  isActive ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
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

