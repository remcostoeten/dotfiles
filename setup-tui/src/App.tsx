import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useState } from "react";
import { MainMenu } from "./components/MainMenu";
import { PackageSelection } from "./components/PackageSelection";
import { InstallProgress } from "./components/InstallProgress";

type Screen = "menu" | "packages" | "installing" | "complete";

export function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);

  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") {
      process.exit(0);
    }
  });

  return (
    <box
      style={{
        flexDirection: "column",
        padding: 2,
        height: "100%",
      }}
    >
      {/* Header */}
      <box
        style={{
          flexDirection: "column",
          marginBottom: 2,
          borderBottom: true,
          paddingBottom: 1,
        }}
      >
        <ascii-font font="tiny" text="Dotfiles Setup" />
        <text attributes={TextAttributes.DIM}>
          Interactive Terminal User Interface
        </text>
      </box>

      {/* Content */}
      <box style={{ flexGrow: 1 }}>
        {screen === "menu" && <MainMenu onSelect={setScreen} />}
        {screen === "packages" && (
          <PackageSelection
            onBack={() => setScreen("menu")}
            onInstall={(packages) => {
              setSelectedPackages(packages);
              setScreen("installing");
            }}
          />
        )}
        {screen === "installing" && (
          <InstallProgress
            packages={selectedPackages}
            onComplete={() => setScreen("complete")}
          />
        )}
        {screen === "complete" && (
          <box
            style={{
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flexGrow: 1,
            }}
          >
            <text fg="green" attributes={TextAttributes.BOLD}>
              ✓ Installation Complete!
            </text>
            <text attributes={TextAttributes.DIM} style={{ marginTop: 1 }}>
              Press Ctrl+C to exit
            </text>
          </box>
        )}
      </box>

      {/* Footer */}
      <box
        style={{
          borderTop: true,
          paddingTop: 1,
          marginTop: 1,
        }}
      >
        <text attributes={TextAttributes.DIM}>
          Press Ctrl+C to exit | Use arrow keys to navigate
        </text>
      </box>
    </box>
  );
}
