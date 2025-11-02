import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useState, useEffect } from "react";
import { useSetup } from "../context/SetupContext";
import { previewInstallation, calculateTotalStats } from "../services/dryRun";
import type { DryRunResult } from "../services/dryRun";

type Props = {
  onBack: () => void;
  onInstall: () => void;
};

export function DryRun({ onBack, onInstall }: Props) {
  const { packages, selected } = useSetup();
  const [results, setResults] = useState<DryRunResult[]>([]);
  const [loading, setLoading] = useState(true);

  useKeyboard((key) => {
    if (key.name === "escape") {
      onBack();
    }
    if (key.name === "return" && !loading) {
      onInstall();
    }
  });

  useEffect(() => {
    async function preview() {
      const selectedPkgs = packages.filter(p => selected.has(p.id));
      const previewResults = await previewInstallation(selectedPkgs);
      setResults(previewResults);
      setLoading(false);
    }
    preview();
  }, [packages, selected]);

  if (loading) {
    return (
      <box style={{ flexDirection: "column" }}>
        <text fg="#FFFF00" attributes={TextAttributes.BOLD}>
          Dry Run - Analyzing...
        </text>
        <text attributes={TextAttributes.DIM}>
          Checking package status...
        </text>
      </box>
    );
  }

  const stats = calculateTotalStats(results);

  return (
    <box style={{ flexDirection: "column", gap: 1 }}>
      <text fg="#FFFF00" attributes={TextAttributes.BOLD}>
        Dry Run Preview
      </text>
      <text attributes={TextAttributes.DIM}>
        Preview of what would be installed
      </text>

      <box style={{ flexDirection: "column", marginTop: 1, marginBottom: 1 }}>
        <text>
          <span fg="cyan">Total packages:</span> {stats.total}
        </text>
        <text>
          <span fg="green">To install:</span> {stats.toInstall}
        </text>
        <text>
          <span fg="yellow">Already installed:</span> {stats.alreadyInstalled}
        </text>
      </box>

      <scrollbox style={{ height: 15 }}>
        {results.map((result) => (
          <box key={result.package} style={{ flexDirection: "row", gap: 1 }}>
            <text fg={result.alreadyInstalled ? "yellow" : "green"}>
              {result.alreadyInstalled ? "✓" : "→"}
            </text>
            <text>
              {result.name}
              <span attributes={TextAttributes.DIM}> ({result.method})</span>
            </text>
            {!result.alreadyInstalled && result.estimatedSize && (
              <text attributes={TextAttributes.DIM}>
                ~{result.estimatedSize}
              </text>
            )}
          </box>
        ))}
      </scrollbox>

      <box style={{ marginTop: 2, flexDirection: "column", gap: 1 }}>
        <text attributes={TextAttributes.BOLD}>Actions:</text>
        <text>
          <span fg="green">[Enter]</span> Proceed with installation
        </text>
        <text>
          <span fg="yellow">[ESC]</span> Go back
        </text>
      </box>
    </box>
  );
}
