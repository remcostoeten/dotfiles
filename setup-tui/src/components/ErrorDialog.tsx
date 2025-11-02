import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import type { InstallError } from "../services/errorHandler";

type Props = {
  errors: InstallError[];
  onRetry: (packageIds: string[]) => void;
  onSkip: () => void;
  onViewLogs: () => void;
};

export function ErrorDialog({ errors, onRetry, onSkip, onViewLogs }: Props) {
  const recoverableErrors = errors.filter(e => e.recoverable);
  const fatalErrors = errors.filter(e => !e.recoverable);

  useKeyboard((key) => {
    if (key.name === "r" && recoverableErrors.length > 0) {
      onRetry(recoverableErrors.map(e => e.package));
    }
    if (key.name === "s") {
      onSkip();
    }
    if (key.name === "l") {
      onViewLogs();
    }
  });

  return (
    <box
      style={{
        flexDirection: "column",
        border: true,
        borderColor: "red",
        padding: 2,
        gap: 1,
      }}
    >
      <text fg="red" attributes={TextAttributes.BOLD}>
        ⚠ Installation Errors ({errors.length})
      </text>

      {recoverableErrors.length > 0 && (
        <box style={{ flexDirection: "column", gap: 1, marginTop: 1 }}>
          <text fg="yellow" attributes={TextAttributes.BOLD}>
            Recoverable Errors ({recoverableErrors.length}):
          </text>
          {recoverableErrors.map((error) => (
            <box key={error.package} style={{ flexDirection: "column", marginLeft: 2 }}>
              <text>
                <span fg="yellow">•</span> {error.package}
              </text>
              <text attributes={TextAttributes.DIM} style={{ marginLeft: 2 }}>
                {error.error}
              </text>
              <box style={{ flexDirection: "column", marginLeft: 2 }}>
                {error.suggestions.slice(0, 2).map((suggestion, i) => (
                  <text key={i} fg="cyan" attributes={TextAttributes.DIM}>
                    → {suggestion}
                  </text>
                ))}
              </box>
            </box>
          ))}
        </box>
      )}

      {fatalErrors.length > 0 && (
        <box style={{ flexDirection: "column", gap: 1, marginTop: 1 }}>
          <text fg="red" attributes={TextAttributes.BOLD}>
            Fatal Errors ({fatalErrors.length}):
          </text>
          {fatalErrors.map((error) => (
            <box key={error.package} style={{ flexDirection: "column", marginLeft: 2 }}>
              <text>
                <span fg="red">✗</span> {error.package}
              </text>
              <text attributes={TextAttributes.DIM} style={{ marginLeft: 2 }}>
                {error.error}
              </text>
            </box>
          ))}
        </box>
      )}

      <box
        style={{
          flexDirection: "column",
          paddingTop: 1,
          marginTop: 1,
          gap: 1,
        }}
      >
        <text attributes={TextAttributes.BOLD}>Actions:</text>
        {recoverableErrors.length > 0 && (
          <text>
            <span fg="green">[R]</span> Retry recoverable errors
          </text>
        )}
        <text>
          <span fg="yellow">[S]</span> Skip and continue
        </text>
        <text>
          <span fg="cyan">[L]</span> View error logs
        </text>
      </box>
    </box>
  );
}
