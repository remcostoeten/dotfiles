import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useState } from "react";

type MenuOption = {
  id: string;
  title: string;
  description: string;
};

const options: MenuOption[] = [
  {
    id: "packages",
    title: "Install Packages",
    description: "Select and install system packages",
  },
  {
    id: "quick",
    title: "Quick Install (All)",
    description: "Install all packages without prompts",
  },
  {
    id: "dry-run",
    title: "Dry Run",
    description: "Preview what would be installed",
  },
  {
    id: "exit",
    title: "Exit",
    description: "Exit the installer",
  },
];

interface MainMenuProps {
  onSelect: (screen: string) => void;
}

export function MainMenu({ onSelect }: MainMenuProps) {
  const [selected, setSelected] = useState(0);

  useKeyboard((key) => {
    if (key.name === "up" || key.name === "k") {
      setSelected((prev) => (prev > 0 ? prev - 1 : options.length - 1));
    }
    if (key.name === "down" || key.name === "j") {
      setSelected((prev) => (prev < options.length - 1 ? prev + 1 : 0));
    }
    if (key.name === "return") {
      const option = options[selected];
      if (option.id === "exit") {
        process.exit(0);
      }
      onSelect(option.id);
    }
  });

  return (
    <box style={{ flexDirection: "column", gap: 1 }}>
      <text fg="#FFFF00" attributes={TextAttributes.BOLD}>
        Main Menu
      </text>
      <text attributes={TextAttributes.DIM} style={{ marginBottom: 1 }}>
        Use arrow keys or j/k to navigate, Enter to select
      </text>

      {options.map((option, index) => (
        <box
          key={option.id}
          style={{
            padding: 1,
            backgroundColor: selected === index ? "#333333" : "transparent",
            border: selected === index,
            borderColor: "#6a5acd",
          }}
        >
          <box style={{ flexDirection: "column" }}>
            <text
              fg={selected === index ? "#FFFF00" : "#FFFFFF"}
              attributes={
                selected === index ? TextAttributes.BOLD : TextAttributes.NONE
              }
            >
              {selected === index ? "▶ " : "  "}
              {option.title}
            </text>
            <text
              attributes={TextAttributes.DIM}
              style={{ marginLeft: 3 }}
            >
              {option.description}
            </text>
          </box>
        </box>
      ))}
    </box>
  );
}
