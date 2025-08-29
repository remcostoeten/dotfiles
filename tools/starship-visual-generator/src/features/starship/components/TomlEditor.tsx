import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

let monaco: any = null;

function loadMonaco(): Promise<any> {
  return import('monaco-editor');
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

  useEffect(function init() {
    if (open) {
      setValue(exportToToml());
    }
  }, [open, exportToToml]);

  useEffect(function mount() {
    let disposed = false;
    async function setup() {
      if (!open) return;
      if (!monaco) monaco = await loadMonaco();
      if (disposed) return;
      if (containerRef.current && !editorRef.current) {
        editorRef.current = monaco.editor.create(containerRef.current, {
          value: value,
          language: 'ini',
          theme: 'vs-dark',
          minimap: { enabled: false },
          automaticLayout: true,
          fontSize: 14,
        });
      }
      if (editorRef.current) {
        editorRef.current.setValue(value);
      }
    }
    setup();
    return function cleanup() {
      disposed = true;
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, [open]);

  function handleApply(): void {
    const text = editorRef.current ? String(editorRef.current.getValue()) : value;
    importFromToml(text);
    onClose();
  }

  function handleClose(): void {
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Edit starship.toml</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">×</button>
        </div>
        <div className="mb-4 h-96 border border-gray-300 rounded-lg overflow-hidden">
          <div ref={containerRef} className="w-full h-full" />
        </div>
        <div className="flex space-x-3">
          <button onClick={handleApply} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Apply</button>
          <button onClick={handleClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  );
}
