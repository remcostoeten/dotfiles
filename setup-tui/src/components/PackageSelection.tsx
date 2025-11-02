import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useState } from "react";
import { packages } from "../data/packages";

interface PackageSelectionProps {
  onBack: () => void;
  onInstall: (packages: string[]) => void;
}

export function PackageSelection({ onBack, onInstall }: PackageSelectionProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(0);

  useKeyboard((key) => {
    if (key.name === "escape") {
      onBack();
    }
    if (key.name === "up" || key.name === "k") {
      setCursor((prev) => (prev > 0 ? prev - 1 : packages.length - 1));
    }
    if (key.name === "down" || key.name === "j") {
      setCursor((prev) => (prev < packages.length - 1 ? prev + 1 : 0));
    }
    if (key.name === "space") {
      const pkg = packages[cursor];
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(pkg.id)) {
          next.delete(pkg.id);
        } else {
          next.add(pkg.id);
        }
        return next;
      });
    }
    if (key.name === "return") {
      onInstall(Array.from(selected));
    }
  });

  return (
    <box style={{ flexDirection: "column", gap: 1 }}>
      <text fg="#FFFF00" attributes={TextAttributes.BOLD}>
        Select Packages
      </text>
      <text attributes={TextAttributes.DIM}>
        Space to select, Enter to install, ESC to go back
      </text>
      <text attributes={TextAttributes.DIM} style={{ marginBottom: 1 }}>
        Selected: {selected.size} packages
      </text>

      <scrollbox style={{ height: 20 }}>
        {packages.map((pkg, index) => (
          <box
            key={pkg.id}
            style={{
              padding: 1,
              backgroundColor: cursor === index ? "#333333" : "transparent",
              border: cursor === index,
              borderColor: "#6a5acd",
            }}
          >
            <text>
              {selected.has(pkg.id) ? "[✓] " : "[ ] "}
              {cursor === index ? "▶ " : "  "}
              <span fg={selected.has(pkg.id) ? "green" : "#FFFFFF"}>
                {pkg.name}
              </span>
              <span attributes={TextAttributes.DIM}> - {pkg.description}</span>
            </text>
          </box>
        ))}
      </scrollbox>
    </box>
  );
}
