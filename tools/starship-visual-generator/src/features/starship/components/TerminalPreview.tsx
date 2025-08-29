import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useStore, defaultScenarios } from '../store';
import type { TScenario } from '../types/starship';
import AnsiToHtml from 'ansi-to-html';

function createAnsiConverter(): AnsiToHtml {
  return new (AnsiToHtml as unknown as { new (opts?: any): AnsiToHtml })({
    fg: '#fbf1c7',
    bg: '#0f1419',
    newline: true,
    escapeXML: true
  });
}

function useDebouncedCallback(cb: () => void, delay: number): () => void {
  const timerRef = useRef<number | undefined>(undefined);
  function run(): void {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(function invoke() {
      cb();
    }, delay) as unknown as number;
  }
  return run;
}

function selectScenario(scenarios: TScenario[], id: string): TScenario {
  const found = scenarios.find(function byId(s) { return s.id === id; });
  return found || scenarios[0];
}

function TerminalHeader({ name }: { name: string }) {
  return (
    <div className="terminal-header mb-4">
      <div className="flex items-center space-x-2 mb-2">
        <div className="flex space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        </div>
        <span className="text-sm text-gray-400">Terminal Preview</span>
      </div>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Live Preview</h3>
        <div className="text-sm text-gray-400">Scenario: {name}</div>
      </div>
    </div>
  );
}

export function TerminalPreview() {
  const { promptState, activeScenario } = useStore();
  const [html, setHtml] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const converter = useMemo(createAnsiConverter, []);
  const scenario = useMemo(function pick() { return selectScenario(defaultScenarios, activeScenario); }, [activeScenario]);

  function renderFallback(): void {
    setHtml('');
  }

  async function fetchPreview(): Promise<void> {
    try {
      const resp = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toml: useStore.getState().exportToToml(), cwd: scenario.context.directory })
      });
      if (!resp.ok) {
        setServerError('Preview server not available or starship not found');
        renderFallback();
        return;
      }
      const data = await resp.json();
      if (data && data.output) {
        const h = converter.toHtml(data.output as string);
        setHtml(h);
        setServerError(null);
      } else {
        renderFallback();
      }
    } catch {
      setServerError('Failed to fetch preview');
      renderFallback();
    }
  }

  const run = useDebouncedCallback(fetchPreview, 250);

  useEffect(function onMount() {
    if (import.meta.env.DEV) {
      run();
    } else {
      renderFallback();
    }
  }, [promptState.modules, promptState.palette, promptState.format, scenario]);

  const hasLineBreak = promptState.modules.some(function has(m) { return m.name === 'line_break' && m.enabled; });
  const hasCharacter = promptState.modules.some(function has(m) { return m.name === 'character' && m.enabled; });

  return (
    <div className="terminal-preview flex-1 bg-gray-900 text-white p-6 font-mono">
      <TerminalHeader name={scenario.name} />
      <div className="terminal-content bg-black rounded-lg p-4 min-h-[200px]">
        <div className="space-y-2">
          <div className="text-gray-400"><span className="text-green-400">$</span> ls -la</div>
          <div className="text-gray-300 text-sm mb-4">
            <div>total 24</div>
            <div>drwxr-xr-x  3 user user 4096 Aug 29 01:15 .</div>
            <div>drwxr-xr-x 15 user user 4096 Aug 29 01:14 ..</div>
            <div>-rw-r--r--  1 user user  123 Aug 29 01:15 README.md</div>
            <div>drwxr-xr-x  2 user user 4096 Aug 29 01:15 src</div>
          </div>
          <div className={clsx("prompt-line flex items-center space-x-1", hasLineBreak ? "flex-col items-start space-x-0 space-y-1" : "")}> 
            <div className="prompt-modules flex items-center space-x-1 w-full">
              {import.meta.env.DEV && html ? (
                <span className="px-2 py-1 text-sm" style={{ background: `linear-gradient(90deg, ${promptState.palette.colors.color_orange || '#d65d0e'}, ${promptState.palette.colors.color_blue || '#458588'}, ${promptState.palette.colors.color_purple || '#b16286'})`, color: promptState.palette.colors.color_fg0 || '#fbf1c7' }} dangerouslySetInnerHTML={{ __html: html }} />
              ) : (
                <span className="px-2 py-1 text-sm" style={{ background: `linear-gradient(90deg, ${promptState.palette.colors.color_orange || '#d65d0e'}, ${promptState.palette.colors.color_blue || '#458588'}, ${promptState.palette.colors.color_purple || '#b16286'})`, color: promptState.palette.colors.color_fg0 || '#fbf1c7' }}>Preview disabled</span>
              )}
            </div>
            {hasCharacter && (<span className="character-indicator text-green-400 font-bold">❯</span>)}
          </div>
          {serverError && (<div className="text-xs text-red-400">{serverError}</div>)}
        </div>
      </div>
    </div>
  );
}
