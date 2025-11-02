import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useState, useEffect } from "react";
import * as Progress from "../services/progress";
import type { ProgressState } from "../services/progress";

type Props = {
  onBack: () => void;
  onResume: (packageIds: string[]) => void;
};

export function Resume({ onBack, onResume }: Props) {
  const [progress, setProgress] = useState<ProgressState | null>(null);

  useKeyboard((key) => {
    if (key.name === "escape") {
      onBack();
    }
    if (key.name === "return" && progress) {
      const pending = Object.entries(progress.packages)
        .filter(([_, status]) => status === "pending" || status === "installing")
        .map(([id]) => id);
      onResume(pending);
    }
    if (key.name === "c" && progress) {
      Progress.clear();
      onBack();
    }
  });

  useEffect(() => {
    const state = Progress.load();
    setProgress(state);
  }, []);

  if (!progress) {
    return (
      <box style={{ flexDirection: "column" }}>
        <text fg="red" attributes={TextAttributes.BOLD}>
          No Previous Installation Found
        </text>
        <text attributes={TextAttributes.DIM} style={{ marginTop: 1 }}>
          Press ESC to go back
        </text>
      </box>
    );
  }

  const pending = Object.entries(progress.packages).filter(
    ([_, status]) => status === "pending" || status === "installing"
  );
  const completed = progress.completed.length;
  const failed = progress.failed.length;

  return (
    <box style={{ flexDirection: "column", gap: 1 }}>
      <text fg="#FFFF00" attributes={TextAttributes.BOLD}>
        Resume Previous Installation
      </text>
      <text attributes={TextAttributes.DIM}>
        Found interrupted installation from {new Date(progress.timestamp).toLocaleString()}
      </text>

      <box style={{ flexDirection: "column", marginTop: 1, marginBottom: 1 }}>
        <text>
          <span fg="green">Completed:</span> {completed}
        </text>
        <text>
          <span fg="red">Failed:</span> {failed}
        </text>
        <text>
          <span fg="yellow">Pending:</span> {pending.length}
        </text>
      </box>

      {pending.length > 0 && (
        <>
          <text attributes={TextAttributes.BOLD}>Pending packages:</text>
          <scrollbox style={{ height: 10 }}>
            {pending.map(([id]) => (
              <text key={id}>• {id}</text>
            ))}
          </scrollbox>
        </>
      )}

      <box style={{ marginTop: 2, flexDirection: "column", gap: 1 }}>
        <text attributes={TextAttributes.BOLD}>Actions:</text>
        <text>
          <span fg="green">[Enter]</span> Resume installation
        </text>
        <text>
          <span fg="red">[C]</span> Clear progress and start fresh
        </text>
        <text>
          <span fg="yellow">[ESC]</span> Go back
        </text>
      </box>
    </box>
  );
}
