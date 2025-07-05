import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';

interface Command {
  id: string;
  title: string;
  description?: string;
  href: string;
  section: string;
  keywords: string[];
}

const commands: Command[] = [
  {
    id: 'home',
    title: 'Documentation Home',
    description: 'Main documentation page with overview',
    href: '/',
    section: 'Navigation',
    keywords: ['home', 'main', 'overview', 'start'],
  },
  {
    id: 'setup',
    title: 'Setup Guide',
    description: 'Installation and configuration instructions',
    href: '/setup',
    section: 'Getting Started',
    keywords: ['setup', 'install', 'configuration', 'getting started'],
  },
  {
    id: 'modules',
    title: 'Modules Overview',
    description: 'Understanding the modular architecture',
    href: '/modules',
    section: 'Architecture',
    keywords: ['modules', 'architecture', 'structure', 'organization'],
  },
  {
    id: 'dev-tools',
    title: 'Development Tools',
    description: 'Available utilities and scripts',
    href: '/dev-tools',
    section: 'Tools',
    keywords: ['tools', 'utilities', 'scripts', 'development', 'commands'],
  },
  {
    id: 'shell',
    title: 'Shell Configuration',
    description: 'Fish shell setup and customization',
    href: '/shell',
    section: 'Configuration',
    keywords: ['shell', 'fish', 'configuration', 'terminal'],
  },
  {
    id: 'environment',
    title: 'Environment Management',
    description: 'Cross-platform environment handling',
    href: '/environment',
    section: 'Configuration',
    keywords: ['environment', 'variables', 'platform', 'cross-platform'],
  },
];

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const filteredCommands = useMemo(() => {
    if (!query) return commands;
    
    const searchQuery = query.toLowerCase();
    return commands.filter(command => 
      command.title.toLowerCase().includes(searchQuery) ||
      command.description?.toLowerCase().includes(searchQuery) ||
      command.keywords.some(keyword => keyword.includes(searchQuery))
    );
  }, [query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            navigate(filteredCommands[selectedIndex].href);
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, navigate, onClose]);

  if (!isOpen) return null;

  const handleCommandClick = (href: string) => {
    navigate(href);
    onClose();
  };

  return (
    <>
      <div className="command-palette-backdrop" onClick={onClose} />
      <div className="command-palette">
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-3">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search documentation..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
              autoFocus
            />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">ESC</kbd>
            </div>
          </div>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No results found for "{query}"
            </div>
          ) : (
            <div className="p-2">
              {filteredCommands.map((command, index) => (
                <button
                  key={command.id}
                  onClick={() => handleCommandClick(command.href)}
                  className={`w-full text-left p-3 rounded-md transition-colors ${
                    index === selectedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {command.title}
                      </div>
                      {command.description && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {command.description}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground ml-3">
                      {command.section}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="border-t border-border p-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded">↑↓</kbd>
                <span>Navigate</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded">↵</kbd>
                <span>Select</span>
              </div>
            </div>
            <div className="text-muted-foreground/60">
              {filteredCommands.length} result{filteredCommands.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
