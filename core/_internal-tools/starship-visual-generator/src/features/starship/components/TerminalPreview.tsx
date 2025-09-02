import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useStore, defaultScenarios } from '../store';
import type { TScenario } from '../types/starship';
import AnsiToHtml from 'ansi-to-html';
import TOML from '@iarna/toml';

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
  const [isLoading, setIsLoading] = useState(false);
  const [skipCustom, setSkipCustom] = useState(false);
  const converter = useMemo(createAnsiConverter, []);
  const scenario = useMemo(function pick() { return selectScenario(defaultScenarios, activeScenario); }, [activeScenario]);

  function renderFallback(): void {
    setHtml('');
  }

  function sanitizeTomlForPreview(raw: string, skip: boolean): string {
    if (!skip) return raw;
    try {
      const obj = TOML.parse(raw) as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(obj)) {
        if (k === 'format') continue;
        if (k === 'palette' || k === 'palettes') { out[k] = (obj as any)[k]; continue; }
        if (k.startsWith('custom.')) continue;
        out[k] = (obj as any)[k];
      }
      const fmt = typeof (obj as any).format === 'string' ? String((obj as any).format) : '';
      const cleaned = fmt.split('\n').filter(function keep(line){ return line.indexOf('$custom.') === -1; }).join('\n');
      out.format = cleaned;
      return TOML.stringify(out as any);
    } catch {
      return raw;
    }
  }

  async function fetchPreview(): Promise<void> {
    if (isLoading) return; // Prevent concurrent requests
    
    setIsLoading(true);
    setServerError(null);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const resp = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          toml: sanitizeTomlForPreview(useStore.getState().exportToToml(), skipCustom), 
          cwd: scenario.context.directory 
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        setServerError(`Server error (${resp.status}): ${errorData.error || 'Unknown error'}`);
        renderFallback();
        return;
      }
      
      const data = await resp.json();
      if (data?.ok && data?.output) {
        const h = converter.toHtml(data.output as string);
        setHtml(h);
        setServerError(null);
      } else {
        setServerError(data?.error || 'No output received from starship');
        renderFallback();
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setServerError('Request timed out - starship may be taking too long to respond');
      } else {
        setServerError(`Network error: ${err.message || 'Failed to connect to preview server'}`);
      }
      renderFallback();
    } finally {
      setIsLoading(false);
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
      <div className="flex items-center justify-between mb-2">
        <TerminalHeader name={scenario.name} />
        <label className="text-xs text-gray-300 inline-flex items-center space-x-2">
          <input type="checkbox" checked={skipCustom} onChange={function onChange(e){ setSkipCustom(e.target.checked); }} />
          <span>Skip custom.* modules</span>
        </label>
      </div>
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
              {isLoading ? (
                <span className="px-2 py-1 text-sm bg-gray-600 text-gray-300 animate-pulse rounded">
                  Generating preview...
                </span>
              ) : import.meta.env.DEV && html ? (
                <span className="px-2 py-1 text-sm" style={{ background: `linear-gradient(90deg, ${promptState.palette.colors.color_orange || '#d65d0e'}, ${promptState.palette.colors.color_blue || '#458588'}, ${promptState.palette.colors.color_purple || '#b16286'})`, color: promptState.palette.colors.color_fg0 || '#fbf1c7' }} dangerouslySetInnerHTML={{ __html: html }} />
              ) : (
                <span className="px-2 py-1 text-sm" style={{ background: `linear-gradient(90deg, ${promptState.palette.colors.color_orange || '#d65d0e'}, ${promptState.palette.colors.color_blue || '#458588'}, ${promptState.palette.colors.color_purple || '#b16286'})`, color: promptState.palette.colors.color_fg0 || '#fbf1c7' }}>
                  {serverError ? 'Preview unavailable' : 'Preview disabled'}
                </span>
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
