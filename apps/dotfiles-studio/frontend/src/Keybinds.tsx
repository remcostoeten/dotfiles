import { useEffect, useRef, useState } from "react";
import {
  keydApplyProfile,
  keydDeleteProfile,
  keydListKeys,
  keydListProfiles,
  keydSaveProfile,
  keydStartCapture,
  keydStatus as fetchKeydStatus,
  keydStopCapture,
  keydValidate,
  newKeydBinding,
  newKeydProfile,
  onKeydKey,
  type KeydBinding,
  type KeydProfile,
  type KeydStatus,
} from "./lib/api";

type RecordTarget = { row: number; field: "key" | "action" } | null;

type ActionPreset = {
  id: string;
  label: string;
  hint: string;
  build: (key: string) => string;
};

const ACTION_PRESETS: ActionPreset[] = [
  { id: "remap", label: "Remap to key", hint: "capslock = esc", build: (key) => key },
  {
    id: "overload",
    label: "Tap key, hold ctrl",
    hint: "capslock = overload(control, esc)",
    build: (key) => `overload(control, ${key})`,
  },
  {
    id: "overload-shift",
    label: "Tap key, hold shift",
    hint: "capslock = overload(shift, esc)",
    build: (key) => `overload(shift, ${key})`,
  },
  { id: "layer", label: "Hold for layer", hint: "rightalt = layer(nav)", build: (key) => `layer(${key})` },
  { id: "raw", label: "Raw keyd expression", hint: "anything keyd accepts", build: (key) => key },
];

export function Keybinds() {
  const [status, setStatus] = useState<KeydStatus | null>(null);
  const [profiles, setProfiles] = useState<KeydProfile[]>([]);
  const [selected, setSelected] = useState("");
  const [bindings, setBindings] = useState<KeydBinding[]>([]);
  const [validKeys, setValidKeys] = useState<string[]>([]);
  const [recording, setRecording] = useState<RecordTarget>(null);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [dirty, setDirty] = useState(false);

  const recordingRef = useRef<RecordTarget>(null);
  recordingRef.current = recording;

  useEffect(() => {
    void refresh();
    void keydListKeys().then(setValidKeys);
  }, []);

  useEffect(() => {
    const off = onKeydKey((e) => {
      const target = recordingRef.current;
      if (!target) return;
      setBindings((prev) =>
        prev.map((b, i) => (i === target.row ? { ...b, [target.field]: e.key } : b)),
      );
      setDirty(true);
      setRecording(null);
      void keydStopCapture();
      report(
        e.remapped
          ? `Recorded ${e.key} — the live profile already remaps it to ${e.raw}.`
          : `Recorded ${e.key}.`,
        false,
      );
    });
    return () => {
      off();
      void keydStopCapture();
    };
  }, []);

  async function refresh() {
    const [next, list] = await Promise.all([fetchKeydStatus(), keydListProfiles()]);
    setStatus(next);
    setProfiles(list);

    const preferred = list.find((p) => p.active) ?? list[0];
    if (preferred) {
      setSelected(preferred.name);
      setBindings(preferred.bindings.length ? preferred.bindings : [newKeydBinding()]);
      setDirty(false);
    }
  }

  function selectProfile(name: string) {
    const profile = profiles.find((p) => p.name === name);
    if (!profile) return;
    setSelected(name);
    setBindings(profile.bindings.length ? profile.bindings : [newKeydBinding()]);
    setDirty(false);
    setMessage("");
    setFailed(false);
  }

  function newProfile() {
    const name = window.prompt("Profile name (letters, digits, dash, underscore)");
    if (!name) return;
    setProfiles((prev) => [...prev, newKeydProfile(name)]);
    setSelected(name);
    setBindings([newKeydBinding()]);
    setDirty(true);
    setMessage("");
  }

  function updateBinding(row: number, patch: Partial<KeydBinding>) {
    setBindings((prev) => prev.map((b, i) => (i === row ? { ...b, ...patch } : b)));
    setDirty(true);
  }

  function removeBinding(row: number) {
    setBindings((prev) => prev.filter((_, i) => i !== row));
    setDirty(true);
  }

  async function startRecording(row: number, field: "key" | "action") {
    const result = await keydStartCapture();
    if (!result.ok) {
      report(result.output, true);
      return;
    }
    setRecording({ row, field });
  }

  function cancelRecording() {
    setRecording(null);
    void keydStopCapture();
  }

  function report(text: string, isError: boolean) {
    setMessage(text);
    setFailed(isError);
  }

  const usable = bindings.filter((b) => b.key.trim() && b.action.trim());

  // A half-filled row used to be dropped silently, so validating a config with
  // nothing bound reported success. Refuse instead of quietly writing nothing.
  function incompleteRows(): string {
    const bad = bindings
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => (b.key.trim() === "") !== (b.action.trim() === ""))
      .map(({ b, i }) =>
        b.key.trim()
          ? `row ${i + 1}: "${b.key}" has no action`
          : `row ${i + 1}: action "${b.action}" has no key`,
      );
    return bad.join("; ");
  }

  function blocked(): boolean {
    const incomplete = incompleteRows();
    if (incomplete) {
      report(`Nothing was written — ${incomplete}.`, true);
      return true;
    }
    if (usable.length === 0) {
      report("Nothing was written — this profile has no bindings.", true);
      return true;
    }
    return false;
  }

  async function validate() {
    if (blocked()) return;
    const result = await keydValidate(usable);
    report(
      result.ok ? `Config is valid — ${usable.length} binding(s).` : result.output,
      !result.ok,
    );
  }

  async function save() {
    if (blocked()) return;
    const result = await keydSaveProfile(selected, usable);
    if (!result.ok) {
      report(result.output, true);
      return;
    }
    setDirty(false);
    report(`Saved to ${result.output}`, false);
    await refresh();
  }

  async function apply() {
    if (blocked()) return;
    if (dirty) {
      const saved = await keydSaveProfile(selected, usable);
      if (!saved.ok) {
        report(saved.output, true);
        return;
      }
      setDirty(false);
    }
    const result = await keydApplyProfile(selected);
    report(result.ok ? `"${selected}" is now live.` : result.output, !result.ok);
    await refresh();
  }

  async function remove() {
    if (!window.confirm(`Delete profile "${selected}"?`)) return;
    const result = await keydDeleteProfile(selected);
    if (!result.ok) {
      report(result.output, true);
      return;
    }
    await refresh();
  }

  return (
    <section className="keybinds">
      <div className="section-head">
        <h2>Keybinds</h2>
        <span className="head-cursor" />
        <span className="section-sub">keyd · kernel-level remaps, active in every app and the TTY</span>
      </div>

      <KeydHealth status={status} />

      <div className="profile-bar">
        <span className="profile-label">Profile</span>
        <select
          className="select"
          value={selected}
          onChange={(e) => selectProfile(e.target.value)}
        >
          {profiles.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
              {p.active ? " · live" : ""}
            </option>
          ))}
        </select>
        {dirty ? <span className="tag tag-warn">unsaved</span> : null}
        <span className="leader" />
        <button className="btn btn-sm" onClick={newProfile}>
          New
        </button>
        <button className="btn btn-sm btn-danger" disabled={!selected} onClick={() => void remove()}>
          Delete
        </button>
      </div>

      <div className="bind-table">
        <div className="bind-head">
          <span>Layer</span>
          <span>Physical key</span>
          <span>Does what</span>
          <span />
        </div>

        {bindings.map((binding, row) => (
          <BindingRow
            key={row}
            binding={binding}
            validKeys={validKeys}
            recording={recording?.row === row ? recording.field : null}
            onChange={(patch) => updateBinding(row, patch)}
            onRecord={(field) => void startRecording(row, field)}
            onCancelRecord={cancelRecording}
            onRemove={() => removeBinding(row)}
          />
        ))}

        <button className="btn btn-sm add-bind" onClick={() => setBindings((p) => [...p, newKeydBinding()])}>
          + Add binding
        </button>
      </div>

      <div className="bind-actions">
        <button className="btn" onClick={() => void validate()}>
          Validate
        </button>
        <button className="btn" disabled={!dirty} onClick={() => void save()}>
          Save
        </button>
        <button className="btn btn-primary" onClick={() => void apply()}>
          Apply &amp; reload
        </button>
        <span className="hint">Apply writes /etc/keyd/default.conf — polkit will ask for your password.</span>
      </div>

      {message ? <div className={`banner ${failed ? "" : "banner-ok"}`}>{message}</div> : null}

      {recording ? (
        <div className="capture-overlay" onClick={cancelRecording}>
          <div className="capture-card">
            <span className="capture-pulse" />
            <h3>Press a key…</h3>
            <p>
              Keys only — mouse buttons are ignored. If the key is already remapped by the live
              profile, it still records as the key you physically pressed.
            </p>
            <button className="btn btn-sm">Cancel</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function KeydHealth({ status }: { status: KeydStatus | null }) {
  if (!status) return <div className="muted">Probing keyd…</div>;

  if (!status.installed) {
    return <div className="banner">keyd is not installed. Install it from the Catalog, then reopen this tab.</div>;
  }

  return (
    <div className="keyd-health">
      <span className={`dot ${status.daemonActive ? "dot-on" : ""}`} />
      <span className="item-name">keyd daemon</span>
      <span className="tag">{status.daemonActive ? "running" : "stopped"}</span>
      <span className="leader" />
      {status.activeProfile ? (
        <span className="tag tag-ok">live: {status.activeProfile}</span>
      ) : status.systemDirty ? (
        <span className="tag tag-warn">/etc/keyd/default.conf matches no profile</span>
      ) : null}
      {status.error ? <span className="item-reason">{status.error}</span> : null}
    </div>
  );
}

function BindingRow({
  binding,
  validKeys,
  recording,
  onChange,
  onRecord,
  onCancelRecord,
  onRemove,
}: {
  binding: KeydBinding;
  validKeys: string[];
  recording: "key" | "action" | null;
  onChange: (patch: Partial<KeydBinding>) => void;
  onRecord: (field: "key" | "action") => void;
  onCancelRecord: () => void;
  onRemove: () => void;
}) {
  const preset = presetFor(binding.action);
  const unknownKey = binding.key.trim() !== "" && validKeys.length > 0 && !validKeys.includes(binding.key);

  return (
    <div className="bind-row">
      <input
        className="input input-layer"
        value={binding.layer}
        placeholder="main"
        onChange={(e) => onChange({ layer: e.target.value })}
      />

      <div className="bind-key">
        <input
          className={`input ${unknownKey ? "input-bad" : ""}`}
          value={binding.key}
          placeholder="capslock"
          onChange={(e) => onChange({ key: e.target.value })}
        />
        <button
          className={`btn btn-sm ${recording === "key" ? "btn-danger" : ""}`}
          onClick={() => (recording === "key" ? onCancelRecord() : onRecord("key"))}
        >
          {recording === "key" ? "…" : "Record"}
        </button>
      </div>

      <div className="bind-action">
        <select
          className="select"
          value={preset}
          onChange={(e) => onChange({ action: rebuildAction(e.target.value, binding.action) })}
        >
          {ACTION_PRESETS.map((p) => (
            <option key={p.id} value={p.id} title={p.hint}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          className="input"
          value={binding.action}
          placeholder="esc"
          onChange={(e) => onChange({ action: e.target.value })}
        />
        <button
          className={`btn btn-sm ${recording === "action" ? "btn-danger" : ""}`}
          onClick={() => (recording === "action" ? onCancelRecord() : onRecord("action"))}
        >
          {recording === "action" ? "…" : "Record"}
        </button>
      </div>

      <button className="btn btn-sm btn-danger" onClick={onRemove}>
        ×
      </button>
    </div>
  );
}

function presetFor(action: string): string {
  if (action.startsWith("overload(control,")) return "overload";
  if (action.startsWith("overload(shift,")) return "overload-shift";
  if (action.startsWith("layer(")) return "layer";
  if (action.includes("(")) return "raw";
  return "remap";
}

function rebuildAction(presetId: string, current: string): string {
  const inner = current.match(/\(([^,]+,\s*)?([^)]+)\)/)?.[2]?.trim() ?? current.trim();
  const preset = ACTION_PRESETS.find((p) => p.id === presetId);
  if (!preset || presetId === "raw") return current;
  return preset.build(inner);
}
