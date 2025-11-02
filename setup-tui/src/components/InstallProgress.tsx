import { TextAttributes } from "@opentui/core";
import { useEffect, useState } from "react";
import { packages as allPackages } from "../data/packages";
import { installBatch } from "../services/installer";
import * as Progress from "../services/progress";

type Props = {
  packages: string[];
  onComplete: () => void;
};

export function InstallProgress({ packages, onComplete }: Props) {
  const [status, setStatus] = useState<Record<string, "pending" | "installing" | "success" | "failed">>({});
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    async function runInstall() {
      const pkgsToInstall = allPackages.filter(p => packages.includes(p.id));
      
      const progressState = Progress.createInitial(packages);
      Progress.save(progressState);

      await installBatch(pkgsToInstall, {
        onProgress: (pkg, state) => {
          setStatus(prev => ({ ...prev, [pkg]: state }));
          if (state === "success") {
            setCurrent(prev => prev + 1);
          }
          
          const updated = Progress.load();
          if (updated) {
            updated.packages[pkg] = state;
            if (state === "success") {
              updated.completed.push(pkg);
            } else if (state === "failed") {
              updated.failed.push(pkg);
            }
            Progress.save(updated);
          }
        },
        onComplete: () => {
          Progress.clear();
          setTimeout(onComplete, 1000);
        },
      });
    }

    runInstall();
  }, [packages, onComplete]);

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
                {pkgStatus === "failed" && "✗"}
              </text>
              <text
                fg={
                  pkgStatus === "success"
                    ? "green"
                    : pkgStatus === "failed"
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
