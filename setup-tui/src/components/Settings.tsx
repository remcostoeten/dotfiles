import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useState } from "react";
import { useSetup } from "../context/SetupContext";

type Props = {
  onBack: () => void;
};

export function Settings({ onBack }: Props) {
  const { config, updateConfig } = useSetup();
  const [selected, setSelected] = useState(0);

  const options = [
    { key: "verbose", label: "Verbose Output", value: config.verbose },
    { key: "skipSystemUpdate", label: "Skip System Update", value: config.skipSystemUpdate },
    { key: "parallelInstalls", label: "Parallel Installs", value: config.parallelInstalls },
  ];

  useKeyboard((key) => {
    if (key.name === "escape") {
      onBack();
    }
    if (key.name === "up" || key.name === "k") {
      setSelected((prev) => (prev > 0 ? prev - 1 : options.length - 1));
    }
    if (key.name === "down" || key.name === "j") {
      setSelected((prev) => (prev < options.length - 1 ? prev + 1 : 0));
    }
    if (key.name === "space" || key.name === "return") {
      const option = options[selected];
      if (!option) return;
      
      if (option.key === "parallelInstalls") {
        const current = config.parallelInstalls;
        updateConfig({ parallelInstalls: current >= 5 ? 1 : current + 1 });
      } else {
        updateConfig({ [option.key]: !option.value });
      }
    }
  });

  return (
    <box style={{ flexDirection: "column", gap: 1 }}>
      <text fg="#FFFF00" attributes={TextAttributes.BOLD}>
        Settings
      </text>
      <text attributes={TextAttributes.DIM} style={{ marginBottom: 1 }}>
        Use arrow keys to navigate, Space/Enter to toggle, ESC to go back
      </text>

      {options.map((option, index) => (
        <box
          key={option.key}
          style={{
            padding: 1,
            backgroundColor: selected === index ? "#333333" : "transparent",
            border: selected === index,
            borderColor: "#6a5acd",
          }}
        >
          <box style={{ flexDirection: "row", justifyContent: "space-between", width: 50 }}>
            <text fg={selected === index ? "#FFFF00" : "#FFFFFF"}>
              {selected === index ? "▶ " : "  "}
              {option.label}
            </text>
            {option.key === "parallelInstalls" ? (
              <text fg="cyan">{option.value}</text>
            ) : (
              <text fg={option.value ? "green" : "red"}>
                {option.value ? "[ON]" : "[OFF]"}
              </text>
            )}
          </box>
        </box>
      ))}

      <box style={{ marginTop: 2, flexDirection: "column", gap: 1 }}>
        <text attributes={TextAttributes.BOLD}>Configuration Details:</text>
        <text attributes={TextAttributes.DIM}>
          • Verbose: Show detailed installation output
        </text>
        <text attributes={TextAttributes.DIM}>
          • Skip System Update: Skip apt update/upgrade
        </text>
        <text attributes={TextAttributes.DIM}>
          • Parallel Installs: Number of concurrent installations (1-5)
        </text>
      </box>
    </box>
  );
}
