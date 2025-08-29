import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

type TProps = {
  open: boolean;
  onClose: () => void;
};

export function TomlEditor({ open, onClose }: TProps) {
  const { exportToToml, importFromToml } = useStore();
  const [value, setValue] = useState<string>('');
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(function init() {
    if (open) {
      setValue(exportToToml());
    }
  }, [open, exportToToml]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>): void {
    setValue(e.target.value);
  }

  function handleApply(): void {
    importFromToml(value);
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
        <div className="mb-4">
          <textarea ref={textRef} value={value} onChange={handleChange} className="w-full h-96 p-3 border border-gray-300 rounded-lg font-mono text-sm" />
        </div>
        <div className="flex space-x-3">
          <button onClick={handleApply} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Apply</button>
          <button onClick={handleClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  );
}
