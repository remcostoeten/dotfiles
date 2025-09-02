import { useEffect, useState } from 'react';
import { useStore } from '../store';

type TTemplate = { name: string; path: string; toml: string };

type TProps = {
  open: boolean;
  onClose: () => void;
};

export function TemplatesModal({ open, onClose }: TProps) {
  const { importFromToml } = useStore();
  const [templates, setTemplates] = useState<TTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadTemplates(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/templates');
      if (!resp.ok) { setError('Failed to load templates'); setLoading(false); return; }
      const data = await resp.json();
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
    } catch {
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }

  useEffect(function onOpen(){ if (open) { loadTemplates(); } }, [open]);

  function handleApply(t: TTemplate): void {
    importFromToml(t.toml);
    onClose();
  }

  function handleEdit(t: TTemplate): void {
    importFromToml(t.toml);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-haptic.surface dark:text-haptic.text rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 dark:border-haptic.border">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Templates</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-haptic.subtext dark:hover:text-haptic.text">×</button>
        </div>
        {loading && <div className="text-sm">Loading…</div>}
        {error && <div className="text-sm text-red-500">{error}</div>}
        <div className="space-y-3">
          {templates.map(function render(t){
            return (
              <div key={t.path} className="p-3 rounded border border-gray-200 dark:border-haptic.border bg-white dark:bg-haptic.surface">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-gray-500 dark:text-haptic.subtext">{t.path}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={function on(){ handleApply(t); }} className="px-3 py-1 rounded bg-blue-600 text-white text-sm">Load</button>
                    <button onClick={function on(){ handleEdit(t); }} className="px-3 py-1 rounded border border-gray-300 dark:border-haptic.border text-sm bg-white dark:bg-haptic.muted dark:text-haptic.text dark:hover:bg-haptic.surface">Edit</button>
                  </div>
                </div>
              </div>
            ) as any;
          })}
        </div>
      </div>
    </div>
  );
}
