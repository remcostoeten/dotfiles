import { useEffect, useMemo, useRef, useState } from "react";
import { Intro } from "./intro";
import { useZoom } from "./lib/zoom";
import { Packages } from "./packages";
import {
  installLabels,
  MorphButton,
  UninstallButton,
  VERIFY_LABELS,
  type Outcome,
  type Verdict,
} from "./ui/morph";
import {
  catalog as fetchCatalog,
  checkPresence,
  specRows,
  systemInfo as fetchSystemInfo,
  runInstall,
  runUninstall,
  verifyInstall,
  cancelInstall,
  onInstallStart,
  onInstallLine,
  onInstallExit,
  type CatalogCategory,
  type CatalogItem,
  type InstallExit,
  type InstallStart,
  type SystemInfo,
  type VerifyResult,
} from "./lib/api";

type Running = InstallStart | null;

const MIN_VERIFY_MS = 420;

const OUTCOME_ACTIONS: Record<string, Outcome["action"]> = {
  package: "install",
  uninstall: "uninstall",
  "pkg-install": "install",
  "pkg-uninstall": "uninstall",
};
const OUTCOME_HOLD_MS = 2400;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
type View = "setup" | "packages";

function App() {
  const [view, setView] = useState<View>("setup");
  const { zoom } = useZoom();
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
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const runDryRef = useRef(false);
  const runningRef = useRef<Running>(null);

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
      runningRef.current = e;
      setRunning(e);
      setExit(null);
      setLines([]);
      setConsoleOpen(true);
    });
    const offLine = onInstallLine((line) => setLines((prev) => [...prev, line]));
    const offExit = onInstallExit((e) => {
      setExit(e);
      if (runningRef.current) recordOutcome(runningRef.current, e.ok);
      runningRef.current = null;
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

  function recordOutcome(run: InstallStart, ok: boolean) {
    const action = OUTCOME_ACTIONS[run.kind];
    if (!action) return;
    const outcome: Outcome = {
      action,
      ok,
      dryRun: runDryRef.current,
    };
    setOutcomes((prev) => ({ ...prev, [run.id]: outcome }));
    setTimeout(() => {
      setOutcomes((prev) => {
        if (prev[run.id] !== outcome) return prev;
        const { [run.id]: _, ...rest } = prev;
        return rest;
      });
    }, OUTCOME_HOLD_MS);
  }

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
    runDryRef.current = dryRun;
    try {
      const result = await runInstall(kind, id, dryRun);
      if (result) setLines((prev) => [...prev, `! ${result}`]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Install failed to start");
    }
  }

  async function uninstall(item: CatalogItem) {
    if (running) return;
    setError("");
    runDryRef.current = dryRun;
    try {
      const result = await runUninstall(item.id, dryRun);
      if (result) {
        setLines((prev) => [...prev, `! ${result}`]);
        setConsoleOpen(true);
      }
      if (!dryRun) setVerdicts(({ [item.id]: _, ...rest }) => rest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uninstall failed to start");
    }
  }

  async function verify(item: CatalogItem) {
    if (running || verifyingId) return;
    setError("");
    setVerifyingId(item.id);
    try {
      const [result] = await Promise.all([verifyInstall(item.id), wait(MIN_VERIFY_MS)]);
      report(result);
      setVerdicts((prev) => ({ ...prev, [item.id]: result.ok ? "ok" : "fail" }));
      void refreshPresence(categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verify failed");
    } finally {
      setVerifyingId(null);
    }
  }

  const busy = running !== null;

  function report(result: VerifyResult) {
    setLines(result.lines);
    setExit({ code: result.ok ? 0 : 1, ok: result.ok });
    setConsoleOpen(true);
  }

  function reportError(message: string) {
    setLines((prev) => [...prev, `! ${message}`]);
    setConsoleOpen(true);
  }

  return (
    <div className={`app ${introDone ? "revealed" : ""}`}>
      {!introDone ? <Intro info={info} onDone={() => setIntroDone(true)} /> : null}

      <header className="topbar">
        <div className="wordmark">
          <span className="logo">DOTFILES</span>
          <span className="logo-sub">STUDIO</span>
        </div>
        {zoom !== 1 ? <span className="zoom-badge">{Math.round(zoom * 100)}%</span> : null}
        <nav className="tabs">
          <button
            className={`tab ${view === "setup" ? "tab-on" : ""}`}
            onClick={() => setView("setup")}
          >
            Setup
          </button>
          <button
            className={`tab ${view === "packages" ? "tab-on" : ""}`}
            onClick={() => setView("packages")}
          >
            Packages
          </button>
        </nav>
        <div className="topbar-actions">
          <label className={`toggle ${dryRun ? "on" : ""}`}>
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            <span>Dry run</span>
          </label>
          {view === "setup" ? (
            <button className="btn btn-primary" disabled={busy} onClick={() => start("all", "")}>
              Run full setup
            </button>
          ) : null}
        </div>
      </header>

      <main className="content">
        {error ? <div className="banner">{error}</div> : null}

        {view === "packages" ? (
          <Packages
            dryRun={dryRun}
            running={running}
            outcomes={outcomes}
            onReport={report}
            onError={reportError}
          />
        ) : (
          <>
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
                    verdicts={verdicts}
                    outcomes={outcomes}
                    dryRun={dryRun}
                    running={running}
                    busy={busy}
                    verifyingId={verifyingId}
                    runningId={running?.id ?? null}
                    onInstallCategory={() => start("category", cat.id)}
                    onInstallItem={(item) => start("package", item.id)}
                    onUninstallItem={(item) => void uninstall(item)}
                    onVerifyItem={(item) => void verify(item)}
                  />
                ))}
              </div>
            </section>
          </>
        )}
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
  verdicts,
  outcomes,
  dryRun,
  running,
  busy,
  verifyingId,
  runningId,
  onInstallCategory,
  onInstallItem,
  onUninstallItem,
  onVerifyItem,
}: {
  cat: CatalogCategory;
  presence: Record<string, boolean>;
  verdicts: Record<string, Verdict>;
  outcomes: Record<string, Outcome>;
  dryRun: boolean;
  running: Running;
  busy: boolean;
  verifyingId: string | null;
  runningId: string | null;
  onInstallCategory: () => void;
  onInstallItem: (item: CatalogItem) => void;
  onUninstallItem: (item: CatalogItem) => void;
  onVerifyItem: (item: CatalogItem) => void;
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
            const outcome = outcomes[item.id];
            const runningHere = running?.id === item.id;
            const installing = runningHere && running?.kind === "package";
            const uninstalling = runningHere && running?.kind === "uninstall";
            return (
              <li className={`item ${!item.available ? "item-muted" : ""}`} key={item.id}>
                <div className="item-main">
                  <span className={`dot ${present ? "dot-on" : ""}`} />
                  <span className="item-name">{item.name}</span>
                  <span className="item-id">{item.packageName || item.id}</span>
                  <span className="leader" />
                  {item.method ? <span className="tag">{item.method}</span> : null}
                  {present ? <span className="tag tag-ok tag-installed">installed</span> : null}
                  {!item.available ? <span className="tag tag-warn">skipped</span> : null}
                  <div className="item-actions">
                    {item.installable ? (
                      <MorphButton
                        labels={installLabels(present, outcome?.dryRun ?? dryRun)}
                        state={
                          installing
                            ? "running"
                            : outcome?.action === "install"
                              ? outcome.ok
                                ? "ok"
                                : "fail"
                              : "idle"
                        }
                        disabled={busy || !item.available}
                        active={installing}
                        title={item.availabilityReason || item.command}
                        onClick={() => onInstallItem(item)}
                      />
                    ) : (
                      <span className="tag">via category</span>
                    )}
                    {item.installable ? (
                      <MorphButton
                        labels={VERIFY_LABELS}
                        state={verifyingId === item.id ? "running" : verdicts[item.id] ?? "idle"}
                        disabled={busy || verifyingId !== null}
                        title="Check the binary resolves, runs, and is registered with its package manager"
                        onClick={() => onVerifyItem(item)}
                      />
                    ) : null}
                    {(present || outcome?.action === "uninstall" || uninstalling) &&
                    item.uninstallCommand ? (
                      <UninstallButton
                        command={item.uninstallCommand}
                        dryRun={dryRun}
                        outcome={outcome}
                        disabled={busy}
                        running={uninstalling}
                        onConfirm={() => onUninstallItem(item)}
                      />
                    ) : null}
                  </div>
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

  useEffect(() => {
    logRef.current?.toggleAttribute("inert", !open);
  }, [open, logRef]);

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
        <span className="chevron">▴</span>
      </div>
      <div className="console-body" ref={logRef} aria-hidden={!open}>
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
    </div>
  );
}

export default App;
