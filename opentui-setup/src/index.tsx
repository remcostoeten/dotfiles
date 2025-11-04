#!/usr/bin/env bun
import { render, useKeyboard } from "@opentui/react";
import { useCallback, useEffect, useState } from "react";
import { TextAttributes } from "@opentui/core";

type SetupStep = {
  id: string;
  name: string;
  description: string;
  command?: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
};

type SetupCategory = {
  name: string;
  steps: SetupStep[];
};

function App() {
  const [currentCategory, setCurrentCategory] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedSteps, setSelectedSteps] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"select" | "running" | "complete">("select");

  const categories: SetupCategory[] = [
    {
      name: "System Dependencies",
      steps: [
        {
          id: "update-apt",
          name: "Update APT packages",
          description: "Update package lists from repositories",
          command: "sudo apt update",
          status: "pending",
        },
        {
          id: "install-build-tools",
          name: "Install build essentials",
          description: "Install GCC, G++, Make and other build tools",
          command: "sudo apt install -y build-essential",
          status: "pending",
        },
        {
          id: "install-git",
          name: "Install Git",
          description: "Install Git version control system",
          command: "sudo apt install -y git",
          status: "pending",
        },
        {
          id: "install-curl",
          name: "Install cURL",
          description: "Install command-line tool for transferring data",
          command: "sudo apt install -y curl",
          status: "pending",
        },
      ],
    },
    {
      name: "Development Tools",
      steps: [
        {
          id: "install-nodejs",
          name: "Install Node.js",
          description: "Install Node.js runtime (LTS version)",
          command: "curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt install -y nodejs",
          status: "pending",
        },
        {
          id: "install-bun",
          name: "Install Bun",
          description: "Install Bun JavaScript runtime",
          command: "curl -fsSL https://bun.sh/install | bash",
          status: "pending",
        },
        {
          id: "install-docker",
          name: "Install Docker",
          description: "Install Docker container platform",
          command: "curl -fsSL https://get.docker.com | sh",
          status: "pending",
        },
        {
          id: "install-vscode",
          name: "Install VS Code",
          description: "Install Visual Studio Code editor",
          command: "sudo snap install code --classic",
          status: "pending",
        },
      ],
    },
    {
      name: "Programming Languages",
      steps: [
        {
          id: "install-python",
          name: "Install Python 3",
          description: "Install Python 3 and pip",
          command: "sudo apt install -y python3 python3-pip",
          status: "pending",
        },
        {
          id: "install-rust",
          name: "Install Rust",
          description: "Install Rust programming language",
          command: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y",
          status: "pending",
        },
        {
          id: "install-go",
          name: "Install Go",
          description: "Install Go programming language",
          command: "sudo snap install go --classic",
          status: "pending",
        },
      ],
    },
    {
      name: "Configuration",
      steps: [
        {
          id: "setup-git",
          name: "Configure Git",
          description: "Set up Git user name and email",
          command: "git config --global user.name 'Your Name' && git config --global user.email 'your.email@example.com'",
          status: "pending",
        },
        {
          id: "setup-ssh",
          name: "Generate SSH key",
          description: "Generate SSH key for Git authentication",
          command: "ssh-keygen -t ed25519 -C 'your.email@example.com' -f ~/.ssh/id_ed25519 -N ''",
          status: "pending",
        },
        {
          id: "setup-zsh",
          name: "Install Oh My Zsh",
          description: "Install Oh My Zsh shell framework",
          command: "sh -c \"$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)\" \"\" --unattended",
          status: "pending",
        },
      ],
    },
  ];

  const [setupCategories, setSetupCategories] = useState(categories);

  useKeyboard((key) => {
    if (mode === "select") {
      if (key.name === "down" || key.name === "j") {
        setCurrentStep((prev) => {
          const maxSteps = setupCategories[currentCategory].steps.length;
          return prev < maxSteps - 1 ? prev + 1 : prev;
        });
      } else if (key.name === "up" || key.name === "k") {
        setCurrentStep((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (key.name === "right" || key.name === "l") {
        setCurrentCategory((prev) => {
          const next = prev < setupCategories.length - 1 ? prev + 1 : prev;
          setCurrentStep(0);
          return next;
        });
      } else if (key.name === "left" || key.name === "h") {
        setCurrentCategory((prev) => {
          const next = prev > 0 ? prev - 1 : prev;
          setCurrentStep(0);
          return next;
        });
      } else if (key.name === "space") {
        const stepId = setupCategories[currentCategory].steps[currentStep].id;
        setSelectedSteps((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(stepId)) {
            newSet.delete(stepId);
          } else {
            newSet.add(stepId);
          }
          return newSet;
        });
      } else if (key.name === "a") {
        // Select all in current category
        const allStepIds = setupCategories[currentCategory].steps.map((s) => s.id);
        setSelectedSteps((prev) => {
          const newSet = new Set(prev);
          allStepIds.forEach((id) => newSet.add(id));
          return newSet;
        });
      } else if (key.name === "return") {
        if (selectedSteps.size > 0) {
          setMode("running");
          runSetup();
        }
      }
    } else if (mode === "complete") {
      if (key.name === "q" || key.name === "escape") {
        process.exit(0);
      }
    }
  });

  const runSetup = async () => {
    setIsRunning(true);
    setLogs([]);

    for (const category of setupCategories) {
      for (const step of category.steps) {
        if (selectedSteps.has(step.id)) {
          // Update step status to running
          setSetupCategories((prev) =>
            prev.map((cat) =>
              cat.name === category.name
                ? {
                    ...cat,
                    steps: cat.steps.map((s) =>
                      s.id === step.id ? { ...s, status: "running" } : s
                    ),
                  }
                : cat
            )
          );

          setLogs((prev) => [...prev, `▶ Running: ${step.name}`]);

          try {
            // Simulate command execution (in real scenario, use Bun.spawn or similar)
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Update step status to completed
            setSetupCategories((prev) =>
              prev.map((cat) =>
                cat.name === category.name
                  ? {
                      ...cat,
                      steps: cat.steps.map((s) =>
                        s.id === step.id ? { ...s, status: "completed" } : s
                      ),
                    }
                  : cat
              )
            );

            setLogs((prev) => [...prev, `✓ Completed: ${step.name}`]);
          } catch (error) {
            // Update step status to failed
            setSetupCategories((prev) =>
              prev.map((cat) =>
                cat.name === category.name
                  ? {
                      ...cat,
                      steps: cat.steps.map((s) =>
                        s.id === step.id ? { ...s, status: "failed" } : s
                      ),
                    }
                  : cat
              )
            );

            setLogs((prev) => [...prev, `✗ Failed: ${step.name}`]);
          }
        } else {
          // Mark as skipped
          setSetupCategories((prev) =>
            prev.map((cat) =>
              cat.name === category.name
                ? {
                    ...cat,
                    steps: cat.steps.map((s) =>
                      s.id === step.id ? { ...s, status: "skipped" } : s
                    ),
                  }
                : cat
            )
          );
        }
      }
    }

    setIsRunning(false);
    setMode("complete");
  };

  const getStatusIcon = (status: SetupStep["status"]) => {
    switch (status) {
      case "completed":
        return "✓";
      case "running":
        return "▶";
      case "failed":
        return "✗";
      case "skipped":
        return "○";
      default:
        return "□";
    }
  };

  const getStatusColor = (status: SetupStep["status"]) => {
    switch (status) {
      case "completed":
        return "#00FF00";
      case "running":
        return "#FFFF00";
      case "failed":
        return "#FF0000";
      case "skipped":
        return "#666666";
      default:
        return "#FFFFFF";
    }
  };

  if (mode === "select") {
    return (
      <box
        style={{
          flexDirection: "column",
          padding: 2,
          gap: 1,
        }}
      >
        <box
          style={{
            border: true,
            borderStyle: "double",
            borderColor: "#00FFFF",
            padding: 1,
            marginBottom: 1,
          }}
        >
          <text fg="#00FFFF" attributes={TextAttributes.BOLD}>
            ╔═══════════════════════════════════════════════════════════╗
          </text>
          <text fg="#00FFFF" attributes={TextAttributes.BOLD}>
            ║          MODERN SYSTEM SETUP - OpenTUI Edition          ║
          </text>
          <text fg="#00FFFF" attributes={TextAttributes.BOLD}>
            ╚═══════════════════════════════════════════════════════════╝
          </text>
        </box>

        <box style={{ flexDirection: "row", gap: 2 }}>
          {setupCategories.map((category, catIndex) => (
            <box
              key={category.name}
              style={{
                border: true,
                borderColor: catIndex === currentCategory ? "#00FF00" : "#666666",
                padding: 1,
                width: 30,
                flexDirection: "column",
              }}
            >
              <text
                fg={catIndex === currentCategory ? "#00FF00" : "#FFFFFF"}
                attributes={
                  catIndex === currentCategory ? TextAttributes.BOLD : undefined
                }
              >
                {category.name}
              </text>
              <text fg="#666666">─────────────────</text>

              {catIndex === currentCategory &&
                category.steps.map((step, stepIndex) => {
                  const isSelected = selectedSteps.has(step.id);
                  const isCurrent = stepIndex === currentStep;

                  return (
                    <box key={step.id} style={{ flexDirection: "column" }}>
                      <text
                        fg={
                          isCurrent
                            ? "#FFFF00"
                            : isSelected
                            ? "#00FF00"
                            : "#FFFFFF"
                        }
                        attributes={isCurrent ? TextAttributes.BOLD : undefined}
                      >
                        {isCurrent ? "► " : "  "}
                        {isSelected ? "[✓] " : "[ ] "}
                        {step.name}
                      </text>
                    </box>
                  );
                })}
            </box>
          ))}
        </box>

        <box
          style={{
            border: true,
            borderColor: "#666666",
            padding: 1,
            marginTop: 1,
          }}
        >
          <text fg="#CCCCCC">
            {setupCategories[currentCategory].steps[currentStep].description}
          </text>
        </box>

        <box style={{ flexDirection: "column", gap: 0, marginTop: 1 }}>
          <text fg="#00FFFF">Controls:</text>
          <text fg="#CCCCCC">  ↑/k ↓/j - Navigate steps</text>
          <text fg="#CCCCCC">  ←/h →/l - Switch categories</text>
          <text fg="#CCCCCC">  SPACE   - Toggle selection</text>
          <text fg="#CCCCCC">  a       - Select all in category</text>
          <text fg="#CCCCCC">  ENTER   - Start setup</text>
        </box>

        <box style={{ marginTop: 1 }}>
          <text fg="#FFFF00">
            Selected: {selectedSteps.size} step(s)
          </text>
        </box>
      </box>
    );
  }

  if (mode === "running" || mode === "complete") {
    const totalSteps = Array.from(selectedSteps).length;
    const completedSteps = setupCategories
      .flatMap((cat) => cat.steps)
      .filter((s) => selectedSteps.has(s.id) && s.status === "completed").length;
    const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

    return (
      <box
        style={{
          flexDirection: "column",
          padding: 2,
          gap: 1,
        }}
      >
        <box
          style={{
            border: true,
            borderStyle: "double",
            borderColor: mode === "complete" ? "#00FF00" : "#FFFF00",
            padding: 1,
          }}
        >
          <text
            fg={mode === "complete" ? "#00FF00" : "#FFFF00"}
            attributes={TextAttributes.BOLD}
          >
            {mode === "complete" ? "✓ Setup Complete!" : "⚙ Running Setup..."}
          </text>
        </box>

        <box style={{ flexDirection: "column" }}>
          <text fg="#CCCCCC">
            Progress: {completedSteps}/{totalSteps} ({Math.round(progress)}%)
          </text>
          <box
            style={{
              border: true,
              borderColor: "#666666",
              width: 60,
              height: 3,
            }}
          >
            <box
              style={{
                width: `${progress}%`,
                height: 1,
                backgroundColor: mode === "complete" ? "#00FF00" : "#FFFF00",
              }}
            />
          </box>
        </box>

        <box
          style={{
            border: true,
            borderColor: "#666666",
            padding: 1,
            flexDirection: "column",
            height: 20,
          }}
        >
          <text fg="#00FFFF" attributes={TextAttributes.BOLD}>
            Execution Log:
          </text>
          <text fg="#666666">─────────────────────────────────────</text>
          {logs.slice(-15).map((log, index) => (
            <text key={index} fg="#CCCCCC">
              {log}
            </text>
          ))}
        </box>

        {mode === "complete" && (
          <box style={{ marginTop: 1 }}>
            <text fg="#00FF00">Press 'q' or ESC to exit</text>
          </box>
        )}
      </box>
    );
  }

  return null;
}

render(<App />);
