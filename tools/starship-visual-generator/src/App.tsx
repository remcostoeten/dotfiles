import { useRef, useState } from 'react';
import { Menu, Download, Upload, Save, Palette, Settings, Play, Pause, Edit3, CheckCircle } from 'lucide-react';
import clsx from 'clsx';
import { ModuleLibrary } from './features/starship/components/ModuleLibrary';
import { ModuleCanvas } from './features/starship/components/ModuleCanvas';
import { TerminalPreview } from './features/starship/components/TerminalPreview';
import { TomlEditor } from './features/starship/components/TomlEditor';
import { FeatureSidebar } from './shared/components/FeatureSidebar';
import { ThemeToggle } from './shared/components/ThemeToggle';
import { TemplatesModal } from './features/starship/components/TemplatesModal';
import { useStore, defaultPalettes, defaultScenarios } from './features/starship/store';
import './App.css';

type TFeatureKey = 'starship' | 'ascii' | 'explorer' | 'aliases';

export default function App() {
  const { 
    promptState, 
    activeScenario, 
    ui, 
    toggleSidebar, 
    setPalette, 
    setActiveScenario, 
    exportToToml, 
    importFromToml,
    setPreviewMode 
  } = useStore();
  const [showExportModal, setShowExportModal] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeFeature, setActiveFeature] = useState<TFeatureKey>('starship');
  const [currentVariant, setCurrentVariant] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyPath, setApplyPath] = useState('/home/remcostoeten/.config/dotfiles/configs/starship.toml');
  const [applyBackup, setApplyBackup] = useState(true);

  function handleExport(): void {
    const tomlContent = exportToToml();
    const blob = new Blob([tomlContent], { type: 'text/toml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'starship.toml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleCopyToClipboard(): void {
    const tomlContent = exportToToml();
    navigator.clipboard.writeText(tomlContent);
    alert('Configuration copied to clipboard!');
  }

  function handleOpenImport(): void {
    if (fileInputRef.current) fileInputRef.current.click();
  }

  function handleImportChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function onload() {
      const text = String(reader.result || '');
      importFromToml(text);
    };
    reader.readAsText(file);
    e.currentTarget.value = '';
  }

  async function handleApplySystem(): Promise<void> {
    try {
      const resp = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toml: exportToToml(), targetPath: applyPath, backup: applyBackup })
      });
      const data = await resp.json();
      if (resp.ok && data.ok) {
        alert('Written to ' + data.path);
        setApplyOpen(false);
      } else {
        alert('Failed to apply: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Apply failed');
    }
  }

  function fetchCurrentVariant(): void {
    fetch('/api/current-variant').then(function r(x){ return x.json(); }).then(function d(data){ setCurrentVariant(String(data?.variant || '')); }).catch(function(){ setCurrentVariant(''); });
  }

  return (
    <div className="app h-screen bg-gray-50 dark:bg-haptic.bg flex flex-col">
      <input ref={fileInputRef} type="file" accept=".toml" className="hidden" onChange={handleImportChange} />
      <header className="bg-white dark:bg-haptic.surface border-b border-gray-200 dark:border-haptic.border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={toggleSidebar} className="p-2 hover:bg-gray-100 rounded-lg"><Menu size={20} /></button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-haptic.text">Starship Visual Generator</h1>
              <p className="text-sm text-gray-600 dark:text-haptic.subtext">Design your perfect terminal prompt visually</p>
              {currentVariant && (
                <div className="mt-1 text-xs px-2 py-0.5 rounded inline-block bg-blue-100 dark:bg-haptic.muted text-blue-800 dark:text-haptic.text border dark:border-haptic.border">Current variant: {currentVariant}</div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <ThemeToggle onThemeChange={function(){}} />
            <div className="flex items-center space-x-2">
              <Palette size={16} className="text-gray-600" />
              <select value={promptState.palette.name} onChange={function onChange(e){ setPalette(defaultPalettes[e.target.value]); }} className="border border-gray-300 rounded px-3 py-1 text-sm">
                {Object.entries(defaultPalettes).map(function render([key, palette]){ return (<option key={key} value={key}>{palette.name.replace('_', ' ').toUpperCase()}</option>) as any; })}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <Settings size={16} className="text-gray-600" />
              <select value={activeScenario} onChange={function onChange(e){ setActiveScenario(e.target.value); }} className="border border-gray-300 rounded px-3 py-1 text-sm">
                {defaultScenarios.map(function option(s){ return (<option key={s.id} value={s.id}>{s.name}</option>) as any; })}
              </select>
            </div>
            <button onClick={function toggle(){ setPreviewMode(ui.previewMode === 'live' ? 'scenarios' : 'live'); }} className={clsx('px-3 py-1 text-sm rounded-lg border', ui.previewMode === 'live' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-blue-100 text-blue-800 border-blue-200')}>
              {ui.previewMode === 'live' ? (<><Play size={14} className="inline mr-1" />Live</>) : (<><Pause size={14} className="inline mr-1" />Static</>)}
            </button>
            <div className="flex items-center space-x-2">
              <button onClick={function open(){ setShowTemplates(true); fetchCurrentVariant(); }} className="px-4 py-2 border border-gray-300 dark:border-haptic.border rounded-lg hover:bg-gray-50 dark:hover:bg-haptic.muted transition-colors flex items-center space-x-2"><Edit3 size={16} /><span>Templates</span></button>
              <button onClick={function open(){ setShowEditor(true); }} className="px-4 py-2 border border-gray-300 dark:border-haptic.border rounded-lg hover:bg-gray-50 dark:hover:bg-haptic.muted transition-colors flex items-center space-x-2"><Edit3 size={16} /><span>Edit TOML</span></button>
              <button onClick={function open(){ setShowExportModal(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"><Download size={16} /><span>Export</span></button>
              <button onClick={handleOpenImport} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"><Upload size={16} /><span>Import</span></button>
              <button onClick={function open(){ setApplyOpen(true); }} className="px-4 py-2 border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors flex items-center space-x-2"><CheckCircle size={16} /><span>Apply to system</span></button>
            </div>
          </div>
        </div>
      </header>
      <div className="flex-1 flex overflow-hidden text-gray-900 dark:text-haptic.text">
        <FeatureSidebar active={activeFeature} onSelect={function onSelect(k){ setActiveFeature(k as TFeatureKey); }} />
        {activeFeature === 'starship' && (
          <>
            <ModuleLibrary />
            <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-haptic.bg">
                <ModuleCanvas />
              </div>
              <div className="w-1/2 border-l border-gray-200">
                <TerminalPreview />
              </div>
            </div>
          </>
        )}
        {activeFeature !== 'starship' && (
          <div className="flex-1 grid place-items-center text-gray-600">
            <div className="text-center">
              <div className="text-2xl font-semibold mb-2">Coming soon</div>
              <div className="text-sm">{activeFeature === 'ascii' ? 'ASCII Intro Designer' : activeFeature === 'explorer' ? 'Dotfiles Explorer' : 'Alias Builder'}</div>
            </div>
          </div>
        )}
      </div>
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">Export Configuration</h2><button onClick={function close(){ setShowExportModal(false); }} className="text-gray-500 hover:text-gray-700">×</button></div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">TOML Configuration</label>
                <textarea readOnly value={exportToToml()} className="w-full h-64 p-3 border border-gray-300 rounded-lg font-mono text-sm bg-gray-50" />
              </div>
              <div className="flex space-x-3">
                <button onClick={handleExport} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"><Download size={16} /><span>Download File</span></button>
                <button onClick={handleCopyToClipboard} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"><Save size={16} /><span>Copy to Clipboard</span></button>
              </div>
            </div>
          </div>
        </div>
      )}
      <TemplatesModal open={showTemplates} onClose={function close(){ setShowTemplates(false); }} />
      <TomlEditor open={showEditor} onClose={function close(){ setShowEditor(false); }} />
      {applyOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-xl w-full mx-4">
            <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">Apply to system</h2><button onClick={function close(){ setApplyOpen(false); }} className="text-gray-500 hover:text-gray-700">×</button></div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target path</label>
                <input type="text" value={applyPath} onChange={function onChange(e){ setApplyPath(e.target.value); }} className="w-full p-2 border border-gray-300 rounded" />
                <div className="text-xs text-gray-500 mt-1">Tip: use ~/.config/dotfiles/configs/starship.toml (managed) or ~/.config/starship.toml</div>
              </div>
              <label className="inline-flex items-center space-x-2 text-sm"><input type="checkbox" checked={applyBackup} onChange={function onChange(e){ setApplyBackup(e.target.checked); }} /><span>Create timestamped backup if file exists</span></label>
              <div className="flex space-x-3">
                <button onClick={handleApplySystem} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Write file</button>
                <button onClick={function close(){ setApplyOpen(false); }} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              </div>
              <div className="text-xs text-gray-600">
                In-app preview uses a temporary config and does not touch your active prompt. Applying will write the chosen file only.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
