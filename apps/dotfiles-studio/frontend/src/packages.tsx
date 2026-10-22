import { useEffect, useMemo, useState } from "react";
import {
  onInstallExit,
  packagesCheckSource,
  packagesImport,
  packagesInstall,
  packagesInstallAURHelper,
  packagesLoad,
  packagesPickFile,
  packagesRun,
  packagesSave,
  packagesUninstall,
  packagesVerify,
  PACKAGE_METHODS,
  type ImportResult,
  type InstallStart,
  type PackageCategory,
  type PackageEntry,
  type PackageManifest,
  type PackageMethod,
  type PackageSource,
  type PackagesState,
  type ResolvedPackage,
  type VerifyResult,
} from "./lib/api";
import {
  installLabels,
  MorphButton,
  UninstallButton,
  VERIFY_LABELS,
  type MorphLabel,
  type Outcome,
  type Verdict,
} from "./ui/morph";

const SOURCE_LABELS: MorphLabel[] = [
  { key: "idle", text: "Test source" },
  { key: "running", text: "Testing", icon: "spinner", tone: "busy" },
  { key: "ok", text: "Source ok", icon: "check", tone: "ok" },
  { key: "fail", text: "Source broken", icon: "cross", tone: "fail" },
];

const PACKAGE_HINTS: Record<PackageMethod, string> = {
  pacman: "repo package names, space separated",
  aur: "AUR package, e.g. visual-studio-code-bin",
  apt: "apt package names, space separated",
  dnf: "dnf package names, space separated",
  flatpak: "flathub app id, e.g. com.spotify.Client",
  snap: "snap name",
  npm: "npm package, e.g. @google/gemini-cli",
  cargo: "crate name",
  pipx: "PyPI package",
  curl: "https://…/install.sh",
  github: "owner/repo — latest release binary into ~/.local/bin",
  shell: "",
};

const AUR_PREFS = ["auto", "paru", "yay", "none"];

type Check = { kind: "verify" | "source"; id: string };

export function Packages({
  dryRun,
  running,
  outcomes,
  onReport,
  onError,
}: {
  dryRun: boolean;
  running: InstallStart | null;
  outcomes: Record<string, Outcome>;
  onReport: (result: VerifyResult) => void;
  onError: (message: string) => void;
}) {
  const [st, setSt] = useState<PackagesState | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ entry: PackageEntry; originalId: string | null } | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [checking, setChecking] = useState<Check | null>(null);
  const [saveError, setSaveError] = useState("");
  const [importing, setImporting] = useState(false);

  const busy = running !== null;

  useEffect(() => {
    void reload();
    return onInstallExit(() => void reload());
  }, []);

  async function reload() {
    try {
      setSt(await packagesLoad());
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to load packages");
    }
  }

  async function save(manifest: PackageManifest): Promise<boolean> {
    const next = await packagesSave(manifest);
    setSt(next);
    setSaveError(next.error);
    return next.error === "";
  }

  function patchEntry(id: string, patch: Partial<PackageEntry>) {
    if (!st) return;
    void save({
      ...st.manifest,
      packages: st.manifest.packages.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  }

  async function saveEntry(entry: PackageEntry, originalId: string | null, newCategory?: PackageCategory) {
    if (!st) return;
    const categories = newCategory ? [...st.manifest.categories, newCategory] : st.manifest.categories;
    const packages =
      originalId === null
        ? [...st.manifest.packages, entry]
        : st.manifest.packages.map((p) => (p.id === originalId ? entry : p));
    if (await save({ ...st.manifest, categories, packages })) setEditing(null);
  }

  async function deleteEntry(id: string) {
    if (!st) return;
    const packages = st.manifest.packages.filter((p) => p.id !== id);
    if (await save({ ...st.manifest, packages })) setEditing(null);
  }

  async function startImport(pick: boolean) {
    let path = "";
    if (pick) {
      path = await packagesPickFile();
      if (!path) return;
    }
    setImporting(true);
    try {
      const result = await packagesImport(path);
      if (result.error) {
        onError(`import failed: ${result.error}`);
        return;
      }
      setPreview(result);
    } finally {
      setImporting(false);
    }
  }

  async function acceptImport() {
    if (!preview) return;
    if (await save(preview.manifest)) setPreview(null);
  }

  async function launch(action: () => Promise<string>) {
    if (busy) return;
    try {
      const result = await action();
      if (result) onError(result);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to start");
    }
  }

  async function runCheck(kind: Check["kind"], id: string) {
    if (busy || checking) return;
    setChecking({ kind, id });
    try {
      const result = kind === "verify" ? await packagesVerify(id) : await packagesCheckSource(id);
      onReport(result);
      setVerdicts((prev) => ({ ...prev, [`${kind}:${id}`]: result.ok ? "ok" : "fail" }));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Check failed");
    } finally {
      setChecking(null);
    }
  }

  const grouped = useMemo(() => {
    if (!st) return [];
    const q = query.trim().toLowerCase();
    const match = (p: PackageEntry) =>
      !q ||
      [p.id, p.name, p.category, ...p.sources.map((s) => `${s.method} ${s.package ?? ""}`)]
        .join(" ")
        .toLowerCase()
        .includes(q);
    return st.manifest.categories
      .map((cat) => ({ cat, entries: st.manifest.packages.filter((p) => p.category === cat.id && match(p)) }))
      .filter((g) => g.entries.length > 0 || (!q && st.manifest.packages.length === 0));
  }, [st, query]);

  if (!st) return <div className="muted">Loading packages…</div>;

  const enabledCount = st.manifest.packages.filter((p) => !p.disabled).length;
  const empty = st.manifest.packages.length === 0;

  return (
    <section className="packages">
      <div className="section-head">
        <h2>Packages</h2>
        <span className="head-cursor" />
        <span className="section-sub">
          {st.manifest.packages.length} packages · {enabledCount} enabled · <code>{st.path}</code>
        </span>
      </div>

      {st.error || saveError ? <div className="banner">{saveError || st.error}</div> : null}

      <MachineLine st={st} />

      {st.env.packageManager === "pacman" ? (
        <AurPanel
          st={st}
          busy={busy}
          dryRun={dryRun}
          onPref={(aurHelper) => void save({ ...st.manifest, aurHelper })}
          onInstall={(name) => void launch(() => packagesInstallAURHelper(name, dryRun))}
        />
      ) : null}

      <div className="pkg-toolbar">
        <input
          className="input pkg-search"
          placeholder="Filter by name, id, category or method"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="pkg-spacer" />
        <button className="btn btn-sm" onClick={() => setEditing({ entry: blankEntry(st), originalId: null })}>
          Add package
        </button>
        <button
          className="btn btn-sm"
          disabled={!st.setupScript || importing}
          title={st.setupScript || "no setup/setup.sh in the workspace"}
          onClick={() => void startImport(false)}
        >
          {importing ? "Importing…" : "Import setup.sh"}
        </button>
        <button className="btn btn-sm" disabled={importing} onClick={() => void startImport(true)}>
          Import file…
        </button>
        <button
          className="btn btn-sm btn-primary"
          disabled={busy || enabledCount === 0}
          data-active={running?.id === "pkg:all"}
          onClick={() => void launch(() => packagesRun("", dryRun))}
        >
          Run enabled ({enabledCount})
        </button>
      </div>

      {empty ? (
        <div className="pkg-empty">
          <p>
            No packages yet. This list is the studio&apos;s own source of truth, saved to{" "}
            <code>{st.path}</code>. Seed it from <code>setup.sh</code> or add entries by hand.
          </p>
        </div>
      ) : null}

      <div className="cat-list">
        {grouped.map(({ cat, entries }) => (
          <CategoryBlock
            key={cat.id}
            cat={cat}
            entries={entries}
            resolved={st.resolved}
            busy={busy}
            dryRun={dryRun}
            running={running}
            outcomes={outcomes}
            verdicts={verdicts}
            checking={checking}
            onRunCategory={() => void launch(() => packagesRun(cat.id, dryRun))}
            onToggle={(p) => patchEntry(p.id, { disabled: !p.disabled })}
            onInstall={(p) => void launch(() => packagesInstall(p.id, dryRun))}
            onUninstall={(p) => void launch(() => packagesUninstall(p.id, dryRun))}
            onCheck={(kind, p) => void runCheck(kind, p.id)}
            onEdit={(p) => setEditing({ entry: JSON.parse(JSON.stringify(p)) as PackageEntry, originalId: p.id })}
          />
        ))}
      </div>

      {preview ? (
        <ImportPreview result={preview} onAccept={() => void acceptImport()} onCancel={() => setPreview(null)} />
      ) : null}

      {editing ? (
        <EntryEditor
          initial={editing.entry}
          isNew={editing.originalId === null}
          categories={st.manifest.categories}
          takenIds={st.manifest.packages.map((p) => p.id).filter((id) => id !== editing.originalId)}
          error={saveError}
          onSave={(entry, newCategory) => void saveEntry(entry, editing.originalId, newCategory)}
          onDelete={() => editing.originalId && void deleteEntry(editing.originalId)}
          onCancel={() => {
            setEditing(null);
            setSaveError("");
          }}
        />
      ) : null}
    </section>
  );
}

function blankEntry(st: PackagesState): PackageEntry {
  const pm = st.env.packageManager;
  const method: PackageMethod = PACKAGE_METHODS.includes(pm as PackageMethod) ? (pm as PackageMethod) : "shell";
  return {
    id: "",
    name: "",
    category: st.manifest.categories[0]?.id ?? "misc",
    checks: [],
    sources: [{ method, package: "" }],
  };
}

function MachineLine({ st }: { st: PackagesState }) {
  return (
    <div className="pkg-machine">
      <span className="profile-label">Methods here</span>
      {PACKAGE_METHODS.map((m) => (
        <span key={m} className={`tag ${st.env.methods[m] ? "tag-ok" : "tag-off"}`}>
          {m}
        </span>
      ))}
      <span className="leader" />
      <span className="hint">{st.env.hasSudo ? "passwordless sudo" : "root steps ask via polkit"}</span>
    </div>
  );
}

function AurPanel({
  st,
  busy,
  dryRun,
  onPref,
  onInstall,
}: {
  st: PackagesState;
  busy: boolean;
  dryRun: boolean;
  onPref: (pref: string) => void;
  onInstall: (name: string) => void;
}) {
  const missing = ["paru", "yay"].filter((h) => !st.env.aurHelpers.includes(h));
  return (
    <div className="pkg-aur">
      <span className="profile-label">AUR helper</span>
      <select className="select" value={st.manifest.aurHelper || "auto"} onChange={(e) => onPref(e.target.value)}>
        {AUR_PREFS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      {st.env.aurHelper ? (
        <span className="tag tag-ok">using {st.env.aurHelper}</span>
      ) : (
        <span className="tag tag-warn">aur sources inactive</span>
      )}
      {st.env.aurHelpers.map((h) => (
        <span key={h} className="tag">
          {h} installed
        </span>
      ))}
      <span className="leader" />
      {missing.map((h) => (
        <button key={h} className="btn btn-sm" disabled={busy} onClick={() => onInstall(h)}>
          {dryRun ? `Dry run: install ${h}` : `Install ${h}`}
        </button>
      ))}
    </div>
  );
}

function CategoryBlock({
  cat,
  entries,
  resolved,
  busy,
  dryRun,
  running,
  outcomes,
  verdicts,
  checking,
  onRunCategory,
  onToggle,
  onInstall,
  onUninstall,
  onCheck,
  onEdit,
}: {
  cat: PackageCategory;
  entries: PackageEntry[];
  resolved: Record<string, ResolvedPackage>;
  busy: boolean;
  dryRun: boolean;
  running: InstallStart | null;
  outcomes: Record<string, Outcome>;
  verdicts: Record<string, Verdict>;
  checking: Check | null;
  onRunCategory: () => void;
  onToggle: (p: PackageEntry) => void;
  onInstall: (p: PackageEntry) => void;
  onUninstall: (p: PackageEntry) => void;
  onCheck: (kind: Check["kind"], p: PackageEntry) => void;
  onEdit: (p: PackageEntry) => void;
}) {
  const enabled = entries.filter((p) => !p.disabled);
  const installed = enabled.filter((p) => resolved[p.id]?.installed).length;

  return (
    <div className="cat">
      <div className="cat-head">
        <div className="cat-title-wrap">
          <h3 className="cat-title">{cat.name}</h3>
          {cat.description ? <p className="cat-desc">{cat.description}</p> : null}
        </div>
        <div className="cat-head-right">
          <span className={`count ${enabled.length > 0 && installed === enabled.length ? "count-ok" : ""}`}>
            {installed}/{enabled.length}
          </span>
          <button
            className="btn"
            disabled={busy || enabled.length === 0}
            data-active={running?.id === `pkg:cat:${cat.id}`}
            onClick={onRunCategory}
          >
            Run category
          </button>
        </div>
      </div>

      <ul className="items">
        {entries.map((p) => (
          <EntryRow
            key={p.id}
            entry={p}
            res={resolved[p.id]}
            busy={busy}
            dryRun={dryRun}
            running={running}
            outcome={outcomes[`pkg:${p.id}`]}
            verifyVerdict={verdicts[`verify:${p.id}`]}
            sourceVerdict={verdicts[`source:${p.id}`]}
            checking={checking}
            onToggle={() => onToggle(p)}
            onInstall={() => onInstall(p)}
            onUninstall={() => onUninstall(p)}
            onCheck={(kind) => onCheck(kind, p)}
            onEdit={() => onEdit(p)}
          />
        ))}
      </ul>
    </div>
  );
}

function EntryRow({
  entry,
  res,
  busy,
  dryRun,
  running,
  outcome,
  verifyVerdict,
  sourceVerdict,
  checking,
  onToggle,
  onInstall,
  onUninstall,
  onCheck,
  onEdit,
}: {
  entry: PackageEntry;
  res: ResolvedPackage | undefined;
  busy: boolean;
  dryRun: boolean;
  running: InstallStart | null;
  outcome: Outcome | undefined;
  verifyVerdict: Verdict | undefined;
  sourceVerdict: Verdict | undefined;
  checking: Check | null;
  onToggle: () => void;
  onInstall: () => void;
  onUninstall: () => void;
  onCheck: (kind: Check["kind"]) => void;
  onEdit: () => void;
}) {
  const runningHere = running?.id === `pkg:${entry.id}`;
  const installing = runningHere && running?.kind === "pkg-install";
  const uninstalling = runningHere && running?.kind === "pkg-uninstall";
  const present = res?.installed ?? false;
  const resolvable = (res?.sourceIndex ?? -1) >= 0;
  const firstLine = res?.command.split("\n")[0] ?? "";
  const multiline = (res?.command.split("\n").length ?? 0) > 1;
  const checkingThis = (kind: Check["kind"]) => checking?.kind === kind && checking.id === entry.id;

  return (
    <li className={`item ${entry.disabled ? "item-muted" : ""}`}>
      <div className="item-main">
        <label className={`toggle toggle-sm ${entry.disabled ? "" : "on"}`} title="Include in Run enabled / Run category">
          <input type="checkbox" checked={!entry.disabled} onChange={onToggle} />
        </label>
        <span className={`dot ${present ? "dot-on" : ""}`} />
        <span className="item-name">{entry.name}</span>
        <span className="item-id">{entry.id}</span>
        <span className="leader" />
        {res?.method ? <span className="tag">{res.method}</span> : <span className="tag tag-warn">no source here</span>}
        {entry.sources.length > 1 ? <span className="tag tag-off">+{entry.sources.length - 1} fallback</span> : null}
        {present ? <span className="tag tag-ok tag-installed">installed</span> : null}
        <div className="item-actions">
          <MorphButton
            labels={installLabels(present, outcome?.dryRun ?? dryRun)}
            state={installing ? "running" : outcome?.action === "install" ? (outcome.ok ? "ok" : "fail") : "idle"}
            disabled={busy || !resolvable}
            active={installing}
            title={res?.reason || res?.command}
            onClick={onInstall}
          />
          <MorphButton
            labels={VERIFY_LABELS}
            state={checkingThis("verify") ? "running" : verifyVerdict ?? "idle"}
            disabled={busy || checking !== null}
            title="Check binaries resolve and run, and the package manager has it registered"
            onClick={() => onCheck("verify")}
          />
          <MorphButton
            labels={SOURCE_LABELS}
            state={checkingThis("source") ? "running" : sourceVerdict ?? "idle"}
            disabled={busy || checking !== null}
            title="Test every source without installing: repo/registry lookup, URL reachability, script syntax"
            onClick={() => onCheck("source")}
          />
          {(present || outcome?.action === "uninstall" || uninstalling) && res?.uninstallCommand ? (
            <UninstallButton
              command={res.uninstallCommand}
              dryRun={dryRun}
              outcome={outcome}
              disabled={busy}
              running={uninstalling}
              onConfirm={onUninstall}
            />
          ) : null}
          <button className="btn btn-sm" onClick={onEdit}>
            Edit
          </button>
        </div>
      </div>
      {firstLine ? (
        <div className="item-script">
          <code>
            {firstLine}
            {multiline ? " …" : ""}
          </code>
        </div>
      ) : null}
      {!resolvable && res?.reason ? <div className="item-reason">{res.reason}</div> : null}
    </li>
  );
}

function ImportPreview({
  result,
  onAccept,
  onCancel,
}: {
  result: ImportResult;
  onAccept: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="capture-overlay" onClick={onCancel}>
      <div className="pkg-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Import {result.source.split("/").pop()}</h3>
        <p className="hint">{result.source}</p>
        <div className="pkg-import-stats">
          <span className="tag tag-ok">{result.added.length} new packages</span>
          <span className="tag">{result.categories.length} new categories</span>
          <span className="tag tag-off">{result.skipped.length} already in your list</span>
        </div>
        {result.added.length > 0 ? (
          <p className="pkg-import-ids">
            <code>{result.added.join(" · ")}</code>
          </p>
        ) : null}
        {result.notes.length > 0 ? (
          <ul className="pkg-notes">
            {result.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
        <p className="hint">
          Existing entries are never overwritten. Calls to custom setup functions become shell sources that load
          setup/lib, so review those before relying on them.
        </p>
        <div className="pkg-modal-actions">
          <button className="btn btn-sm" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-sm btn-primary" disabled={result.added.length === 0} onClick={onAccept}>
            Add {result.added.length} to my list
          </button>
        </div>
      </div>
    </div>
  );
}

const NEW_CATEGORY = "__new__";

function EntryEditor({
  initial,
  isNew,
  categories,
  takenIds,
  error,
  onSave,
  onDelete,
  onCancel,
}: {
  initial: PackageEntry;
  isNew: boolean;
  categories: PackageCategory[];
  takenIds: string[];
  error: string;
  onSave: (entry: PackageEntry, newCategory?: PackageCategory) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [entry, setEntry] = useState<PackageEntry>(initial);
  const [checksText, setChecksText] = useState((initial.checks ?? []).join(", "));
  const knownCategory = categories.some((c) => c.id === initial.category);
  const [category, setCategory] = useState(knownCategory ? initial.category : NEW_CATEGORY);
  const [newCategoryName, setNewCategoryName] = useState(knownCategory ? "" : initial.category);
  const [armedDelete, setArmedDelete] = useState(false);

  const idTaken = takenIds.includes(entry.id);
  const idValid = /^[a-z0-9][a-z0-9._+-]*$/.test(entry.id);
  const newCategoryId = slugify(newCategoryName);
  const categoryValid = category !== NEW_CATEGORY || newCategoryId !== "";

  function setSource(index: number, patch: Partial<PackageSource>) {
    setEntry((e) => ({ ...e, sources: e.sources.map((s, i) => (i === index ? { ...s, ...patch } : s)) }));
  }

  function moveSource(index: number, delta: number) {
    setEntry((e) => {
      const sources = [...e.sources];
      const target = index + delta;
      if (target < 0 || target >= sources.length) return e;
      [sources[index], sources[target]] = [sources[target], sources[index]];
      return { ...e, sources };
    });
  }

  function submit() {
    const checks = checksText
      .split(/[,\s]+/)
      .map((c) => c.trim())
      .filter(Boolean);
    const isNewCategory = category === NEW_CATEGORY;
    const categoryId = isNewCategory ? newCategoryId : category;
    onSave(
      { ...entry, name: entry.name.trim() || entry.id, category: categoryId, checks },
      isNewCategory ? { id: categoryId, name: newCategoryName.trim() } : undefined,
    );
  }

  return (
    <div className="capture-overlay" onClick={onCancel}>
      <div className="pkg-modal pkg-editor" onClick={(e) => e.stopPropagation()}>
        <h3>{isNew ? "Add package" : `Edit ${initial.name}`}</h3>

        <div className="pkg-grid">
          <label className="pkg-field">
            <span>ID</span>
            <input
              className={`input ${entry.id && (!idValid || idTaken) ? "input-bad" : ""}`}
              value={entry.id}
              placeholder="ripgrep"
              onChange={(e) => setEntry({ ...entry, id: e.target.value.trim() })}
            />
          </label>
          <label className="pkg-field">
            <span>Name</span>
            <input
              className="input"
              value={entry.name}
              placeholder="ripgrep"
              onChange={(e) => setEntry({ ...entry, name: e.target.value })}
            />
          </label>
          <label className="pkg-field">
            <span>Category</span>
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={NEW_CATEGORY}>New category…</option>
            </select>
          </label>
          {category === NEW_CATEGORY ? (
            <label className="pkg-field">
              <span>New category name</span>
              <input
                className="input"
                value={newCategoryName}
                placeholder="Dev tools"
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
            </label>
          ) : null}
          <label className="pkg-field pkg-wide">
            <span>Check binaries (any one on PATH means installed)</span>
            <input
              className="input"
              value={checksText}
              placeholder="rg"
              onChange={(e) => setChecksText(e.target.value)}
            />
          </label>
          <label className="pkg-field pkg-wide">
            <span>Description</span>
            <input
              className="input"
              value={entry.description ?? ""}
              onChange={(e) => setEntry({ ...entry, description: e.target.value })}
            />
          </label>
        </div>

        <div className="pkg-sources-head">
          <span className="profile-label">Sources · first one that works on the machine wins</span>
          <span className="leader" />
          <button
            className="btn btn-sm"
            onClick={() => setEntry({ ...entry, sources: [...entry.sources, { method: "pacman", package: "" }] })}
          >
            Add source
          </button>
        </div>

        {entry.sources.map((s, i) => (
          <SourceEditor
            key={i}
            source={s}
            index={i}
            count={entry.sources.length}
            onChange={(patch) => setSource(i, patch)}
            onMove={(delta) => moveSource(i, delta)}
            onRemove={() => setEntry({ ...entry, sources: entry.sources.filter((_, j) => j !== i) })}
          />
        ))}

        {idTaken ? <div className="item-reason">id “{entry.id}” is already used</div> : null}
        {error ? <div className="banner">{error}</div> : null}

        <div className="pkg-modal-actions">
          {!isNew ? (
            <button
              className="btn btn-sm btn-danger"
              onClick={() => (armedDelete ? onDelete() : setArmedDelete(true))}
              onBlur={() => setArmedDelete(false)}
            >
              {armedDelete ? "Confirm remove from list" : "Remove from list"}
            </button>
          ) : null}
          <span className="pkg-spacer" />
          <button className="btn btn-sm" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn-sm btn-primary"
            disabled={!idValid || idTaken || !categoryValid}
            onClick={submit}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function SourceEditor({
  source,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  source: PackageSource;
  index: number;
  count: number;
  onChange: (patch: Partial<PackageSource>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const m = source.method;
  return (
    <div className="pkg-source">
      <div className="pkg-source-row">
        <span className="pkg-source-index">{index + 1}</span>
        <select className="select" value={m} onChange={(e) => onChange({ method: e.target.value as PackageMethod })}>
          {PACKAGE_METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
        {m !== "shell" ? (
          <input
            className="input pkg-grow"
            value={source.package ?? ""}
            placeholder={PACKAGE_HINTS[m]}
            onChange={(e) => onChange({ package: e.target.value })}
          />
        ) : (
          <span className="pkg-grow hint">runs with bash from the dotfiles root</span>
        )}
        {m === "curl" ? (
          <select className="select" value={source.shell || "sh"} onChange={(e) => onChange({ shell: e.target.value })}>
            <option value="sh">sh</option>
            <option value="bash">bash</option>
          </select>
        ) : null}
        {m === "curl" || m === "snap" ? (
          <input
            className="input pkg-args"
            value={source.args ?? ""}
            placeholder={m === "snap" ? "--classic" : "installer args"}
            onChange={(e) => onChange({ args: e.target.value })}
          />
        ) : null}
        <button className="btn btn-sm" disabled={index === 0} onClick={() => onMove(-1)} title="Prefer this source">
          ↑
        </button>
        <button className="btn btn-sm" disabled={index === count - 1} onClick={() => onMove(1)}>
          ↓
        </button>
        <button className="btn btn-sm btn-danger" onClick={onRemove}>
          ✕
        </button>
      </div>
      {m === "shell" ? (
        <textarea
          className="input pkg-script"
          rows={Math.min(12, Math.max(3, (source.script ?? "").split("\n").length))}
          value={source.script ?? ""}
          placeholder="curl -fsSL https://example.com/install.sh | sh"
          onChange={(e) => onChange({ script: e.target.value })}
        />
      ) : null}
      <input
        className="input pkg-uninstall"
        value={source.uninstall ?? ""}
        placeholder="uninstall override (optional; default is derived from the method)"
        onChange={(e) => onChange({ uninstall: e.target.value })}
      />
    </div>
  );
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
