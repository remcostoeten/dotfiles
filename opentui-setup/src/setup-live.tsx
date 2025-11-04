#!/usr/bin/env bun
/**
 * Modern Setup Script with LIVE command execution
 * This version actually executes the commands on your system
 * USE WITH CAUTION - Review all commands before running!
 */

import { render, useKeyboard } from "@opentui/react";
import { useCallback, useState } from "react";
import { TextAttributes } from "@opentui/core";
import { executeCommand, type CommandResult } from "./executor";

type SetupStep = {
  id: string;
  name: string;
  description: string;
  command?: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  output?: string;
  error?: string;
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
  const [mode, setMode] = useState<"select" | "confirm" | "running" | "complete">("select");
  const [showOutput, setShowOutput] = useState(false);
  const [currentOutput, setCurrentOutput] = useState("");

  const categories: SetupCategory[] = [
    {
      name: "System Check",
      steps: [
        {
          id: "check-os",
          name: "Check OS Version",
          description: "Display current operating system information",
          command: "uname -a && lsb_release -a 2>/dev/null || cat /etc/os-release",
          status: "pending",
        },
        {
          id: "check-disk",
          name: "Check Disk Space",
          description: "Display available disk space",
          command: "df -h /",
          status: "pending",
        },
        {
          id: "check-memory",
          name: "Check Memory",
          description: "Display memory information",
          command: "free -h",
          status: "pending",
        },
      ],
    },
    {
      name: "Package Management",
      steps: [
        {
          id: "update-apt",
          name: "Update APT packages",
          description: "Update package lists from repositories (requires sudo)",
          command: "sudo apt update",
          status: "pending",
        },
        {
          id: "upgrade-apt",
          name: "Upgrade packages",
          description: "Upgrade all installed packages (requires sudo)",
          command: "sudo apt upgrade -y",
          status: "pending",
        },
      ],
    },
    {
      name: "Development Tools",
      steps: [
        {
          id: "check-git",
          name: "Check Git",
          description: "Check if Git is installed",
          command: "git --version",
          status: "pending",
        },
        {
          id: "check-node",
          name: "Check Node.js",
          description: "Check if Node.js is installed",
          command: "node --version",
          status: "pending",
        },
        {
          id: "check-bun",
          name: "Check Bun",
          description: "Check if Bun is installed",
          command: "bun --version",
          status: "pending",
        },
        {
          id: "check-docker",
          name: "Check Docker",
          description: "Check if Docker is installed",
          command: "docker --version",
          status: "pending",
        },
      ],
    },
    {
      name: "User Configuration",
      steps: [
        {
          id: "show-git-config",
          name: "Show Git Config",
          description: "Display current Git configuration",
          command: "git config --list | grep user",
          status: "pending",
        },
        {
          id: "show-ssh-keys",
          name: "List SSH Keys",
          description: "List existing SSH keys",
          command: "ls -la ~/.ssh/*.pub 2>/dev/null || echo 'No SSH keys found'",
          status: "pending",
        },
        {
          id: "show-shell",
          name: "Show Current Shell",
          description: "Display current shell",
          command: "echo $SHELL",
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
        const allStepIds = setupCategories[currentCategory].steps.map((s) => s.id);
        setSelectedSteps((prev) => {
          const newSet = new Set(prev);
          allStepIds.forEach((id) => newSet.add(id));
          return newSet;
        });
      } else if (key.name === "return") {
        if (selectedSteps.size > 0) {
          setMode("confirm");
        }
      } else if (key.name === "v") {
        const step = setupCategories[currentCategory].steps[currentStep];
        if (step.command) {
          setCurrentOutput(step.command);
          setShowOutput(true);
        }
      }
    } else if (mode === "confirm") {
      if (key.name === "y") {
        setMode("running");
        runSetup();
      } else if (key.name === "n" || key.name === "escape") {
        setMode("select");
      }
    } else if (mode === "running") {
      if (key.name === "o") {
        setShowOutput(!showOutput);
      }
    } else if (mode === "complete") {
      if (key.name === "q" || key.name === "escape") {
        process.exit(0);
      } else if (key.name === "o") {
        setShowOutput(!showOutput);
      }
    }

    if (showOutput && (key.name === "escape" || key.name === "o")) {
      setShowOutput(false);
    }
  });

  const runSetup = async () => {
    setIsRunning(true);
    setLogs([]);

    for (const category of setupCategories) {
      for (const step of category.steps) {
        if (selectedSteps.has(step.id) && step.command) {
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
          setCurrentOutput(`Executing: ${step.command}\n\nPlease wait...`);

          try {
            const result: CommandResult = await executeCommand(step.command);

            if (result.success) {
              setSetupCategories((prev) =>
                prev.map((cat) =>
                  cat.name === category.name
                    ? {
                        ...cat,
                        steps: cat.steps.map((s) =>
                          s.id === step.id
                            ? { ...s, status: "completed", output: result.output }
                            : s
                        ),
                      }
                    : cat
                )
              );

              setLogs((prev) => [
                ...prev,
                `✓ Completed: ${step.name}`,
                result.output ? `  Output: ${result.output.substring(0, 100)}...` : "",
              ]);
              setCurrentOutput(result.output || "Command completed successfully");
            } else {
              setSetupCategories((prev) =>
                prev.map((cat) =>
                  cat.name === category.name
                    ? {
                        ...cat,
                        steps: cat.steps.map((s) =>
                          s.id === step.id
                            ? { ...s, status: "failed", error: result.error }
                            : s
                        ),
                      }
                    : cat
                )
              );

              setLogs((prev) => [
                ...prev,
                `✗ Failed: ${step.name}`,
                result.error ? `  Error: ${result.error}` : "",
              ]);
              setCurrentOutput(result.error || "Command failed");
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            setSetupCategories((prev) =>
              prev.map((cat) =>
                cat.name === category.name
                  ? {
                      ...cat,
                      steps: cat.steps.map((s) =>
                        s.id === step.id ? { ...s, status: "failed", error: errorMsg } : s
                      ),
                    }
                  : cat
              )
            );

            setLogs((prev) => [...prev, `✗ Failed: ${step.name}`, `  Error: ${errorMsg}`]);
            setCurrentOutput(errorMsg);
          }
        } else if (!selectedSteps.has(step.id)) {
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

  if (showOutput) {
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
          }}
        >
          <text fg="#00FFFF" attributes={TextAttributes.BOLD}>
            Command Output
          </text>
        </box>

        <box
          style={{
            border: true,
            borderColor: "#666666",
            padding: 1,
            flexDirection: "column",
            height: 25,
          }}
        >
          {currentOutput.split("\n").map((line, index) => (
            <text key={index} fg="#CCCCCC">
              {line}
            </text>
          ))}
        </box>

        <box>
          <text fg="#FFFF00">Press 'o' or ESC to close</text>
        </box>
      </box>
    );
  }

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
            ║       LIVE SYSTEM SETUP - OpenTUI Edition (LIVE)        ║
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
          <text fg="#666666" attributes={TextAttributes.DIM}>
            Command: {setupCategories[currentCategory].steps[currentStep].command}
          </text>
        </box>

        <box style={{ flexDirection: "column", gap: 0, marginTop: 1 }}>
          <text fg="#00FFFF">Controls:</text>
          <text fg="#CCCCCC">  ↑/k ↓/j - Navigate steps</text>
          <text fg="#CCCCCC">  ←/h →/l - Switch categories</text>
          <text fg="#CCCCCC">  SPACE   - Toggle selection</text>
          <text fg="#CCCCCC">  a       - Select all in category</text>
          <text fg="#CCCCCC">  v       - View command</text>
          <text fg="#CCCCCC">  ENTER   - Start setup</text>
        </box>

        <box style={{ marginTop: 1 }}>
          <text fg="#FFFF00">Selected: {selectedSteps.size} step(s)</text>
        </box>

        <box
          style={{
            border: true,
            borderColor: "#FF0000",
            padding: 1,
            marginTop: 1,
          }}
        >
          <text fg="#FF0000" attributes={TextAttributes.BOLD}>
            ⚠ WARNING: This will execute REAL commands on your system!
          </text>
        </box>
      </box>
    );
  }

  if (mode === "confirm") {
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
            borderColor: "#FFFF00",
            padding: 1,
          }}
        >
          <text fg="#FFFF00" attributes={TextAttributes.BOLD}>
            ⚠ CONFIRMATION REQUIRED
          </text>
        </box>

        <box style={{ flexDirection: "column", gap: 1 }}>
          <text fg="#FFFFFF">You are about to execute {selectedSteps.size} commands:</text>
          {Array.from(selectedSteps)
            .slice(0, 10)
            .map((stepId) => {
              const step = setupCategories
                .flatMap((cat) => cat.steps)
                .find((s) => s.id === stepId);
              return (
                <text key={stepId} fg="#CCCCCC">
                  • {step?.name}
                </text>
              );
            })}
          {selectedSteps.size > 10 && (
            <text fg="#666666">... and {selectedSteps.size - 10} more</text>
          )}
        </box>

        <box
          style={{
            border: true,
            borderColor: "#FF0000",
            padding: 1,
            marginTop: 1,
          }}
        >
          <text fg="#FF0000" attributes={TextAttributes.BOLD}>
            These commands will be executed on your system!
          </text>
          <text fg="#FFFF00">Make sure you have reviewed them carefully.</text>
        </box>

        <box style={{ marginTop: 1 }}>
          <text fg="#00FF00">Press 'y' to continue, 'n' or ESC to cancel</text>
        </box>
      </box>
    );
  }

  if (mode === "running" || mode === "complete") {
    const totalSteps = Array.from(selectedSteps).length;
    const completedSteps = setupCategories
      .flatMap((cat) => cat.steps)
      .filter((s) => selectedSteps.has(s.id) && s.status === "completed").length;
    const failedSteps = setupCategories
      .flatMap((cat) => cat.steps)
      .filter((s) => selectedSteps.has(s.id) && s.status === "failed").length;
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
            borderColor:
              mode === "complete"
                ? failedSteps > 0
                  ? "#FFFF00"
                  : "#00FF00"
                : "#FFFF00",
            padding: 1,
          }}
        >
          <text
            fg={
              mode === "complete"
                ? failedSteps > 0
                  ? "#FFFF00"
                  : "#00FF00"
                : "#FFFF00"
            }
            attributes={TextAttributes.BOLD}
          >
            {mode === "complete"
              ? failedSteps > 0
                ? `⚠ Setup Complete with ${failedSteps} error(s)`
                : "✓ Setup Complete!"
              : "⚙ Running Setup..."}
          </text>
        </box>

        <box style={{ flexDirection: "column" }}>
          <text fg="#CCCCCC">
            Progress: {completedSteps}/{totalSteps} ({Math.round(progress)}%)
            {failedSteps > 0 && ` - ${failedSteps} failed`}
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
                backgroundColor:
                  mode === "complete"
                    ? failedSteps > 0
                      ? "#FFFF00"
                      : "#00FF00"
                    : "#FFFF00",
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

        <box style={{ marginTop: 1 }}>
          {mode === "complete" ? (
            <>
              <text fg="#00FF00">Press 'q' or ESC to exit</text>
              <text fg="#CCCCCC"> | Press 'o' to view output</text>
            </>
          ) : (
            <text fg="#CCCCCC">Press 'o' to toggle output view</text>
          )}
        </box>
      </box>
    );
  }

  return null;
}

render(<App />);
