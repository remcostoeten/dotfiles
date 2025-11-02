import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useState, useEffect } from "react";
import * as Progress from "../services/progress";

type MenuOption = {
  id: string;
  title: string;
  description: string;
};

type Props = {
  onSelect: (screen: string) => void;
};

function getOptions(hasProgress: boolean): MenuOption[] {
  const opts: MenuOption[] = [];
  
  if (hasProgress) {
    opts.push({
      id: "resume",
      title: "Resume Previous Installation",
      description: "Continue from where you left off",
    });
  }
  
  opts.push(
    {
      id: "packages",
      title: "Install Packages",
      description: "Select and install system packages",
    },
    {
      id: "dry-run",
      title: "Dry Run",
      description: "Preview what would be installed",
    },
    {
      id: "settings",
      title: "Settings",
      description: "Configure installation options",
    },
    {
      id: "exit",
      title: "Exit",
      description: "Exit the installer",
    }
  );
  
  return opts;
}

export function MainMenu({ onSelect }: Props) {
  const [selected, setSelected] = useState(0);
  const [hasProgress, setHasProgress] = useState(false);

  useEffect(() => {
    setHasProgress(Progress.canResume());
  }, []);

  const options = getOptions(hasProgress);

  useKeyboard((key) => {
    if (key.name === "up" || key.name === "k") {
      setSelected((prev) => (prev > 0 ? prev - 1 : options.length - 1));
    }
    if (key.name === "down" || key.name === "j") {
      setSelected((prev) => (prev < options.length - 1 ? prev + 1 : 0));
    }
    if (key.name === "return") {
      const option = options[selected];
      if (!option) return;
      
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
