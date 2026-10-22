import { useEffect, useState } from "react";

export type Verdict = "ok" | "fail";
export type Outcome = { action: "install" | "uninstall"; ok: boolean; dryRun: boolean };

export type MorphIcon = "spinner" | "check" | "cross";
export type MorphTone = "busy" | "ok" | "fail" | "danger";
export type MorphLabel = { key: string; text: string; icon?: MorphIcon; tone?: MorphTone };

export const VERIFY_LABELS: MorphLabel[] = [
  { key: "idle", text: "Verify" },
  { key: "running", text: "Checking", icon: "spinner", tone: "busy" },
  { key: "ok", text: "Verified", icon: "check", tone: "ok" },
  { key: "fail", text: "Broken", icon: "cross", tone: "fail" },
];

export function installLabels(present: boolean, dryRun: boolean): MorphLabel[] {
  return [
    { key: "idle", text: present ? "Reinstall" : "Install" },
    { key: "running", text: "Installing", icon: "spinner", tone: "busy" },
    { key: "ok", text: dryRun ? "Dry run ok" : "Installed", icon: "check", tone: "ok" },
    { key: "fail", text: "Failed", icon: "cross", tone: "fail" },
  ];
}

function uninstallLabels(dryRun: boolean): MorphLabel[] {
  return [
    { key: "idle", text: "Uninstall", tone: "danger" },
    { key: "armed", text: "Confirm?", tone: "danger" },
    { key: "running", text: "Removing", icon: "spinner", tone: "busy" },
    { key: "ok", text: dryRun ? "Dry run ok" : "Removed", icon: "check", tone: "ok" },
    { key: "fail", text: "Failed", icon: "cross", tone: "fail" },
  ];
}

function MorphIconGlyph({ icon }: { icon: MorphIcon }) {
  if (icon === "spinner") return <span className="morph-spinner" />;
  return (
    <svg className="morph-icon" viewBox="0 0 12 12" aria-hidden="true">
      <path d={icon === "check" ? "M2.5 6.4 5 8.8 9.6 3.4" : "M3.2 3.2 8.8 8.8M8.8 3.2 3.2 8.8"} />
    </svg>
  );
}

export function MorphButton({
  labels,
  state,
  disabled,
  active,
  title,
  onClick,
}: {
  labels: MorphLabel[];
  state: string;
  disabled: boolean;
  active?: boolean;
  title?: string;
  onClick: () => void;
}) {
  const index = Math.max(
    0,
    labels.findIndex((label) => label.key === state),
  );
  const current = labels[index];

  return (
    <button
      className="btn btn-sm morph"
      data-tone={current.tone}
      data-active={active}
      disabled={disabled}
      aria-busy={current.icon === "spinner"}
      aria-label={current.text}
      title={title}
      onClick={onClick}
    >
      {labels.map((label, i) => (
        <span
          key={label.key}
          className="morph-label"
          data-phase={i === index ? "on" : i < index ? "before" : "after"}
          aria-hidden="true"
        >
          {label.icon ? <MorphIconGlyph icon={label.icon} /> : null}
          {label.text}
        </span>
      ))}
    </button>
  );
}

export function UninstallButton({
  command,
  dryRun,
  outcome,
  disabled,
  running,
  onConfirm,
}: {
  command: string;
  dryRun: boolean;
  outcome: Outcome | undefined;
  disabled: boolean;
  running: boolean;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  const settled = outcome?.action === "uninstall" ? (outcome.ok ? "ok" : "fail") : null;
  const state = running ? "running" : settled ?? (armed ? "armed" : "idle");

  return (
    <MorphButton
      labels={uninstallLabels(outcome?.dryRun ?? dryRun)}
      state={state}
      disabled={disabled || settled !== null}
      title={command}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
    />
  );
}
