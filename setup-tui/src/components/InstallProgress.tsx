import { TextAttributes } from "@opentui/core";
import { useEffect, useState } from "react";

interface InstallProgressProps {
  packages: string[];
  onComplete: () => void;
}

export function InstallProgress({ packages, onComplete }: InstallProgressProps) {
  const [current, setCurrent] = useState(0);
  const [status, setStatus] = useState<Record<string, "pending" | "installing" | "success" | "error">>({});

  useEffect(() => {
    // Simulate installation
    const installNext = async () => {
      if (current >= packages.length) {
        setTimeout(onComplete, 1000);
        return;
      }

      const pkg = packages[current];
      setStatus((prev) => ({ ...prev, [pkg]: "installing" }));

      // Simulate installation time
      await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));

      setStatus((prev) => ({ ...prev, [pkg]: "success" }));
      setCurrent((prev) => prev + 1);
    };

    installNext();
  }, [current, packages, onComplete]);

  const progress = packages.length > 0 ? Math.round((current / packages.length) * 100) : 0;

  return (
    <box style={{ flexDirection: "column", gap: 1 }}>
      <text fg="#FFFF00" attributes={TextAttributes.BOLD}>
        Installing Packages
      </text>
      <text attributes={TextAttributes.DIM}>
        Progress: {current}/{packages.length} ({progress}%)
      </text>

      {/* Progress bar */}
      <box style={{ width: 50, height: 1, backgroundColor: "#333333", marginTop: 1, marginBottom: 1 }}>
        <box style={{ width: `${progress}%`, height: 1, backgroundColor: "green" }} />
      </box>

      {/* Package list */}
      <scrollbox style={{ height: 15 }}>
        {packages.map((pkg) => {
          const pkgStatus = status[pkg] || "pending";
          return (
            <box key={pkg} style={{ flexDirection: "row", gap: 1 }}>
              <text>
                {pkgStatus === "pending" && "⏳"}
                {pkgStatus === "installing" && "⚙️ "}
                {pkgStatus === "success" && "✓"}
                {pkgStatus === "error" && "✗"}
              </text>
              <text
                fg={
                  pkgStatus === "success"
                    ? "green"
                    : pkgStatus === "error"
                    ? "red"
                    : pkgStatus === "installing"
                    ? "yellow"
                    : "#999"
                }
              >
                {pkg}
              </text>
            </box>
          );
        })}
      </scrollbox>
    </box>
  );
}
