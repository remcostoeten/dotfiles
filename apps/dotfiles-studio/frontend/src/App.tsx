import { useEffect, useMemo, useRef, useState } from "react";
import { Intro } from "./Intro";
import {
  catalog as fetchCatalog,
  checkPresence,
  specRows,
  systemInfo as fetchSystemInfo,
  runInstall,
  cancelInstall,
  onInstallStart,
  onInstallLine,
  onInstallExit,
  type CatalogCategory,
  type CatalogItem,
  type InstallExit,
  type InstallStart,
  type SystemInfo,
} from "./lib/api";

type Running = InstallStart | null;

function App() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [presence, setPresence] = useState<Record<string, boolean>>({});
  const [dryRun, setDryRun] = useState(false);
  const [running, setRunning] = useState<Running>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [exit, setExit] = useState<InstallExit | null>(null);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [error, setError] = useState("");
  const [introDone, setIntroDone] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);

  // Initial load: machine + catalog, then presence for every checkable binary.
  useEffect(() => {
    void (async () => {
      try {
        const [machine, cats] = await Promise.all([fetchSystemInfo(), fetchCatalog()]);
        setInfo(machine);
        setCategories(cats);
        await refreshPresence(cats);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load machine state");
      }
    })();
  }, []);

  // Stream install lifecycle from the Go backend.
  useEffect(() => {
    const offStart = onInstallStart((e) => {
      setRunning(e);
      setExit(null);
      setLines([]);
      setConsoleOpen(true);
    });
    const offLine = onInstallLine((line) => setLines((prev) => [...prev, line]));
    const offExit = onInstallExit((e) => {
      setExit(e);
      setRunning(null);
      void refreshPresence(categories);
    });
    return () => {
      offStart();
      offLine();
      offExit();
    };
    // categories captured for the presence refresh on exit
  }, [categories]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  async function refreshPresence(cats: CatalogCategory[]) {
    const checks = Array.from(
      new Set(cats.flatMap((c) => c.items.map((i) => presenceKey(i)).filter(Boolean))),
    );
    if (checks.length === 0) return;
    try {
      setPresence(await checkPresence(checks));
    } catch {
      /* presence is best-effort */
    }
  }

  async function start(kind: "all" | "category" | "package", id: string) {
    if (running) return;
    setError("");
    try {
      const result = await runInstall(kind, id, dryRun);
      if (result) setLines((prev) => [...prev, `! ${result}`]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Install failed to start");
    }
  }

  const busy = running !== null;

  return (
    <div className={`app ${introDone ? "revealed" : ""}`}>
      {!introDone ? <Intro info={info} onDone={() => setIntroDone(true)} /> : null}

      <header className="topbar">
        <div className="wordmark">
          <span className="logo">DOTFILES</span>
          <span className="logo-sub">STUDIO</span>
        </div>
        <div className="topbar-actions">
          <label className={`toggle ${dryRun ? "on" : ""}`}>
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            <span>Dry run</span>
          </label>
          <button className="btn btn-primary" disabled={busy} onClick={() => start("all", "")}>
            Run full setup
          </button>
        </div>
      </header>

      <main className="content">
        {error ? <div className="banner">{error}</div> : null}

        <SystemPanel info={info} />

        {!info?.setupScriptFound ? (
          <div className="banner">
            setup.sh was not found under the detected workspace. Install actions are disabled.
          </div>
        ) : null}

        <section className="catalog">
          <div className="section-head">
            <h2>Catalog</h2>
            <span className="head-cursor" />
            <span className="section-sub">
              {categories.length} categories · install whole groups or single packages
            </span>
          </div>

          <div className="cat-list">
            {categories.map((cat) => (
              <CategoryCard
                key={cat.id}
                cat={cat}
                presence={presence}
                busy={busy}
                runningId={running?.id ?? null}
                onInstallCategory={() => start("category", cat.id)}
                onInstallItem={(item) => start("package", item.id)}
              />
            ))}
          </div>
        </section>
      </main>

      <LogConsole
        open={consoleOpen}
        running={running}
        lines={lines}
        exit={exit}
        logRef={logRef}
        dryRun={dryRun}
        onToggle={() => setConsoleOpen((v) => !v)}
        onCancel={() => void cancelInstall()}
      />
    </div>
  );
}

function SystemPanel({ info }: { info: SystemInfo | null }) {
  const rows = info ? specRows(info) : [];

  return (
    <section className="system">
      <div className="section-head">
        <h2>This machine</h2>
        <span className="head-cursor" />
        <span className="section-sub">Detected on launch · read only</span>
      </div>
      {info ? (
        <div className="kv-list">
          {rows.map(([label, value]) => (
            <div className="kv" key={label}>
              <span className="kv-label">{label}</span>
              <span className="kv-leader" />
              <span className="kv-value">{value || "unknown"}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="muted">Probing system…</div>
      )}
    </section>
  );
}

function categoryButtonLabel(kind: string): string {
  switch (kind) {
    case "drivers":
      return "Install drivers";
    case "fonts":
      return "Install fonts";
    case "desktop":
      return "Apply desktop";
    default:
      return "Install all";
  }
}

function CategoryCard({
  cat,
  presence,
  busy,
  runningId,
  onInstallCategory,
  onInstallItem,
}: {
  cat: CatalogCategory;
  presence: Record<string, boolean>;
  busy: boolean;
  runningId: string | null;
  onInstallCategory: () => void;
  onInstallItem: (item: CatalogItem) => void;
}) {
  const checkable = cat.items.filter((i) => i.check);
  const installedCount = checkable.filter((i) => presence[presenceKey(i)]).length;
  const allInstalled = checkable.length > 0 && installedCount === checkable.length;

  return (
    <div className="cat">
      <div className="cat-head">
        <div className="cat-title-wrap">
          <h3 className="cat-title">{cat.name}</h3>
          <p className="cat-desc">{cat.description}</p>
        </div>
        <div className="cat-head-right">
          {checkable.length > 0 ? (
            <span className={`count ${allInstalled ? "count-ok" : ""}`}>
              {installedCount}/{checkable.length}
            </span>
          ) : null}
          <button
            className="btn"
            disabled={busy || !cat.available}
            data-active={runningId === cat.id}
            title={cat.availabilityReason || cat.command}
            onClick={onInstallCategory}
          >
            {categoryButtonLabel(cat.kind)}
          </button>
        </div>
      </div>
      <div className="script-line">
        <span>section</span>
        <code>{cat.command}</code>
      </div>
      {!cat.available && cat.availabilityReason ? (
        <div className="notice-line">{cat.availabilityReason}</div>
      ) : null}

      {cat.items.length > 0 ? (
        <ul className="items">
          {cat.items.map((item) => {
            const key = presenceKey(item);
            const present = item.check ? presence[key] : false;
            return (
              <li className={`item ${!item.available ? "item-muted" : ""}`} key={item.id}>
                <div className="item-main">
                  <span className={`dot ${present ? "dot-on" : ""}`} />
                  <span className="item-name">{item.name}</span>
                  <span className="item-id">{item.packageName || item.id}</span>
                  <span className="leader" />
                  {item.method ? <span className="tag">{item.method}</span> : null}
                  {present ? <span className="tag tag-ok">installed</span> : null}
                  {!item.available ? <span className="tag tag-warn">skipped</span> : null}
                  {item.installable ? (
                    <button
                      className="btn btn-sm"
                      disabled={busy || !item.available}
                      data-active={runningId === item.id}
                      title={item.availabilityReason || item.command}
                      onClick={() => onInstallItem(item)}
                    >
                      {present ? "Reinstall" : "Install"}
                    </button>
                  ) : (
                    <span className="tag">via category</span>
                  )}
                </div>
                <div className="item-script">
                  <code>{item.command || `setup.sh --package ${item.id}`}</code>
                </div>
                {!item.available && item.availabilityReason ? (
                  <div className="item-reason">{item.availabilityReason}</div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function presenceKey(item: CatalogItem): string {
  const checks = item.checks?.length ? item.checks : item.check ? [item.check] : [];
  return checks.join("|");
}

function LogConsole({
  open,
  running,
  lines,
  exit,
  logRef,
  dryRun,
  onToggle,
  onCancel,
}: {
  open: boolean;
  running: Running;
  lines: string[];
  exit: InstallExit | null;
  logRef: React.RefObject<HTMLDivElement>;
  dryRun: boolean;
  onToggle: () => void;
  onCancel: () => void;
}) {
  const status = useMemo(() => {
    if (running) return running.command;
    if (exit) return exit.ok ? "done" : `exited with code ${exit.code}`;
    return "idle";
  }, [running, exit]);

  return (
    <div className={`console ${open ? "open" : ""}`}>
      <div className="console-bar" onClick={onToggle}>
        <span className={`pulse ${running ? "live" : exit?.ok ? "ok" : exit ? "fail" : ""}`} />
        <span className="console-title">Console</span>
        <span className="console-status">{status}</span>
        {dryRun ? <span className="tag">dry run</span> : null}
        <span className="console-spacer" />
        {running ? (
          <button
            className="btn btn-sm btn-danger"
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
          >
            Cancel
          </button>
        ) : null}
        <span className="chevron">{open ? "▾" : "▴"}</span>
      </div>
      {open ? (
        <div className="console-body" ref={logRef}>
          {lines.length === 0 ? (
            <div className="muted">No output yet. Run an install to stream logs here.</div>
          ) : (
            lines.map((line, i) => (
              <div className="log-line" key={i}>
                {line}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export default App;
