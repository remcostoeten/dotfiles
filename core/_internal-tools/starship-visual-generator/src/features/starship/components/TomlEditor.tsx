import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

let monaco: any = null;
let tomlLanguageRegistered = false;

function loadMonaco(): Promise<any> {
  return import('monaco-editor');
}

function registerTomlLanguage(monaco: any): void {
  if (tomlLanguageRegistered) return;
  
  // Register TOML language
  monaco.languages.register({ id: 'toml' });
  
  // Define TOML syntax highlighting
  monaco.languages.setMonarchTokensProvider('toml', {
    tokenizer: {
      root: [
        [/^\s*\[.*\]\s*$/, 'keyword'], // Section headers
        [/^\s*[a-zA-Z_][a-zA-Z0-9_.-]*\s*=/, 'variable.name'], // Keys
        [/".*?"/, 'string'], // Double quoted strings
        [/'.*?'/, 'string'], // Single quoted strings
        [/\btrue\b|\bfalse\b/, 'number'], // Booleans
        [/\b\d+\b/, 'number'], // Numbers
        [/#.*$/, 'comment'], // Comments
      ]
    }
  });
  
  // Define theme for TOML
  monaco.editor.defineTheme('toml-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'ff6b6b' },
      { token: 'variable.name', foreground: '4ecdc4' },
      { token: 'string', foreground: 'ffe066' },
      { token: 'number', foreground: 'a8e6cf' },
      { token: 'comment', foreground: '888888', fontStyle: 'italic' }
    ],
    colors: {
      'editor.background': '#1e1e1e'
    }
  });
  
  tomlLanguageRegistered = true;
}

type TProps = {
  open: boolean;
  onClose: () => void;
};

export function TomlEditor({ open, onClose }: TProps) {
  const { exportToToml, importFromToml } = useStore();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<any>(null);
  const [value, setValue] = useState<string>('');
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  const updateFromStore = useCallback(function updateFromStore() {
    const newValue = exportToToml();
    setValue(newValue);
    if (editorRef.current && editorRef.current.getValue() !== newValue) {
      editorRef.current.setValue(newValue);
      setHasChanges(false);
    }
  }, [exportToToml]);

  useEffect(function init() {
    if (open) {
      updateFromStore();
    }
  }, [open, updateFromStore]);

  useEffect(function mount() {
    let disposed = false;
    let debounceTimer: number | undefined = undefined;
    
    async function setup() {
      if (!open) return;
      if (!monaco) monaco = await loadMonaco();
      if (disposed) return;
      
      registerTomlLanguage(monaco);
      
      if (containerRef.current && !editorRef.current) {
        editorRef.current = monaco.editor.create(containerRef.current, {
          value: value,
          language: 'toml',
          theme: 'toml-dark',
          minimap: { enabled: false },
          automaticLayout: true,
          fontSize: 14,
          wordWrap: 'on',
          lineNumbers: 'on',
          folding: true,
          bracketMatching: 'always',
          matchBrackets: 'always',
          insertSpaces: true,
          tabSize: 2,
          scrollBeyondLastLine: false,
          contextmenu: true,
          mouseWheelZoom: true
        });
        
        // Add debounced change listener
        editorRef.current.onDidChangeModelContent(function onChange() {
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }
          
          debounceTimer = window.setTimeout(function onDebounce() {
            const currentValue = editorRef.current?.getValue() || '';
            if (currentValue !== value) {
              setValue(currentValue);
              setHasChanges(true);
              // Auto-apply changes after 2 seconds of no changes
              setTimeout(function autoApply() {
                if (editorRef.current && editorRef.current.getValue() === currentValue) {
                  try {
                    importFromToml(currentValue);
                    setHasChanges(false);
                  } catch {
                    // Invalid TOML, don't auto-apply
                  }
                }
              }, 2000);
            }
          }, 250) as unknown as number;
        });
      }
      
      if (editorRef.current) {
        editorRef.current.setValue(value);
      }
    }
    
    setup();
    
    return function cleanup() {
      disposed = true;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, [open, value, importFromToml]);

  function handleApply(): void {
    const text = editorRef.current ? String(editorRef.current.getValue()) : value;
    importFromToml(text);
    onClose();
  }

  function handleClose(): void {
    onClose();
  }
  
  // Handle keyboard shortcuts
  useEffect(function keyboardShortcuts() {
    if (!open) return;
    
    function handleKeyDown(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleApply();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    }
    
    document.addEventListener('keydown', handleKeyDown);
    return function cleanup() {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-haptic.surface dark:text-haptic.text rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 dark:border-haptic.border">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold">Edit starship.toml</h2>
            {hasChanges && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                Unsaved changes
              </span>
            )}
          </div>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>
        <div className="mb-4 h-96 border border-gray-300 dark:border-haptic.border rounded-lg overflow-hidden bg-white dark:bg-haptic.bg">
          <div ref={containerRef} className="w-full h-full" />
        </div>
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-500 dark:text-haptic.subtext">
            <span className="inline-flex items-center space-x-2">
              <span>⌘/Ctrl+S to apply</span>
              <span>•</span>
              <span>ESC to close</span>
              <span>•</span>
              <span>Auto-saves after 2s of inactivity</span>
            </span>
          </div>
          <div className="flex space-x-3">
            <button onClick={handleApply} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Apply Changes</button>
            <button onClick={handleClose} className="px-4 py-2 border border-gray-300 dark:border-haptic.border rounded-lg hover:bg-gray-50 dark:hover:bg-haptic.muted dark:text-haptic.text transition-colors">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
