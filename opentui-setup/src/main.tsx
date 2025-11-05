#!/usr/bin/env bun
/**
 * Complete dotfiles setup system with interactive TUI
 */

import { render, useKeyboard } from "@opentui/react";
import { useState, useEffect } from "react";
import { TextAttributes } from "@opentui/core";
import { categories } from "./packages";
import { installPackage, updateApt, upgradeApt, executeCommand } from "./executor";
import { initDataDirectory, updatePackageProgress, isCompleted } from "./progress";
import type { Category, Package, AppMode, AppConfig } from "./types";

function App() {
  const [mode, setMode] = useState<AppMode>("menu");
  const [selectedMenu, setSelectedMenu] = useState(0);
  const [currentCategory, setCurrentCategory] = useState(0);
  const [currentPackage, setCurrentPackage] = useState(0);
  const [cats, setCats] = useState<Category[]>(categories);
  const [logs, setLogs] = useState<string[]>([]);
  const [config, setConfig] = useState<AppConfig>({
    dryRun: false,
    verbose: false,
    skipSystemUpdate: false,
    skipFonts: false,
  });
  const [isRunning, setIsRunning] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [currentOutput, setCurrentOutput] = useState("");

  // Initialize data directory on mount
  useEffect(() => {
    initDataDirectory();
    // Headless flags handling on start
    const args = process.argv.slice(2);
    const headless = args.includes("--all") || args.includes("--yes") || args.includes("-y");
    if (headless) {
      // Apply flags
      const dryRun = args.includes("--dry-run");
      const verbose = args.includes("--verbose");
      const skipFonts = args.includes("--skip-fonts");
      const skipSystemUpdate = args.includes("--skip-system-update");

      setConfig((prev) => ({
        ...prev,
        dryRun,
        verbose,
        skipFonts,
        skipSystemUpdate,
      }));

      // Select all categories
      setCats((prev) => prev.map((c) => ({ ...c, selected: true })));

      // Jump straight to running
      setMode("running");
      // Fire and forget
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      runSetup();
    }
  }, []);

  // Keyboard navigation
  useKeyboard((key) => {
    if (mode === "menu") {
      handleMenuKeys(key);
    } else if (mode === "select") {
      handleSelectKeys(key);
    } else if (mode === "confirm") {
      handleConfirmKeys(key);
    } else if (mode === "running" || mode === "complete") {
      handleRunningKeys(key);
    }
  });

  const handleMenuKeys = (key: any) => {
    if (key.name === "down" || key.name === "j") {
      setSelectedMenu((prev) => (prev < 7 ? prev + 1 : prev));
    } else if (key.name === "up" || key.name === "k") {
      setSelectedMenu((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (key.name === "return") {
      executeMenuAction(selectedMenu);
    } else if (key.name === "q" || key.name === "escape") {
      process.exit();
    } else if (key.name >= "1" && key.name <= "8") {
      const index = parseInt(key.name) - 1;
      executeMenuAction(index);
    }
  };

  const executeMenuAction = (index: number) => {
    switch (index) {
      case 0: // Full Interactive Setup
        setMode("select");
        break;
      case 1: // Quick Install (All)
        setCats((prev) => prev.map((c) => ({ ...c, selected: true })));
        setMode("confirm");
        break;
      case 2: // Custom Install
        setMode("select");
        break;
      case 3: // Dry Run
        setConfig((prev) => ({ ...prev, dryRun: true }));
        setMode("select");
        break;
      case 4: // List Packages
        // TODO: Show package list
        break;
      case 5: // Resume Previous
        setMode("select");
        break;
      case 6: // Help
        // TODO: Show help
        break;
      case 7: // Exit
        process.exit();
        break;
    }
  };

  const handleSelectKeys = (key: any) => {
    if (key.name === "down" || key.name === "j") {
      setCurrentPackage((prev) => {
        const maxPackages = cats[currentCategory].packages.length;
        return prev < maxPackages - 1 ? prev + 1 : prev;
      });
    } else if (key.name === "up" || key.name === "k") {
      setCurrentPackage((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (key.name === "right" || key.name === "l") {
      setCurrentCategory((prev) => {
        const next = prev < cats.length - 1 ? prev + 1 : prev;
        setCurrentPackage(0);
        return next;
      });
    } else if (key.name === "left" || key.name === "h") {
      setCurrentCategory((prev) => {
        const next = prev > 0 ? prev - 1 : prev;
        setCurrentPackage(0);
        return next;
      });
    } else if (key.name === "space") {
      setCats((prev) =>
        prev.map((cat, idx) =>
          idx === currentCategory
            ? { ...cat, selected: !cat.selected }
            : cat
        )
      );
    } else if (key.name === "a") {
      setCats((prev) =>
        prev.map((cat, idx) =>
          idx === currentCategory ? { ...cat, selected: true } : cat
        )
      );
    } else if (key.name === "return") {
      const hasSelected = cats.some((c) => c.selected);
      if (hasSelected) {
        setMode("confirm");
      }
    } else if (key.name === "escape" || key.name === "q") {
      setMode("menu");
    }
  };

  const handleConfirmKeys = (key: any) => {
    if (key.name === "y") {
      setMode("running");
      runSetup();
    } else if (key.name === "n" || key.name === "escape") {
      setMode("select");
    }
  };

  const handleRunningKeys = (key: any) => {
    if (key.name === "o") {
      setShowOutput(!showOutput);
    } else if (mode === "complete" && (key.name === "q" || key.name === "escape")) {
      process.exit();
    }
  };

  const runSetup = async () => {
    setIsRunning(true);
    setLogs([]);

    // Preflight: sudo cache + network
    if (!config.dryRun) {
      setLogs((prev) => [...prev, "\n▶ Preflight checks..."]);
      // Cache sudo credentials (non-blocking if passwordless or cached)
      await executeCommand("sudo -v || true", config.verbose);
      // Basic network check
      const net = await executeCommand("ping -c 1 -W 2 github.com >/dev/null 2>&1");
      if (!net.success) {
        setLogs((prev) => [...prev, "⚠ Network check to github.com failed; continuing, expect download errors."]);
      } else {
        setLogs((prev) => [...prev, "✓ Network reachable"]);
      }
    }

    // Dotfiles setup (FIRST - this is critical!)
    if (!config.dryRun) {
      setLogs((prev) => [...prev, "\n▶ Setting up dotfiles and Fish shell..."]);

      try {
        // 1. Shell setup (install Fish if needed)
        setLogs((prev) => [...prev, "▶ Setting up shell environment..."]);
        const { setupShell } = await import("./shell-setup");
        const shellResult = await setupShell(config.verbose);
        shellResult.steps.forEach((step) => {
          const icon = step.success ? "✓" : "✗";
          setLogs((prev) => [...prev, `  ${icon} ${step.name}: ${step.message}`]);
        });
        if (!shellResult.success) {
          setLogs((prev) => [...prev, "⚠ Shell setup encountered issues, continuing..."]);
        }

        // 2. Dotfiles & Fish setup
        setLogs((prev) => [...prev, "▶ Setting up dotfiles and Fish shell..."]);
        const { setupDotfiles } = await import("./dotfiles-setup");
        const dotfilesResult = await setupDotfiles();
        dotfilesResult.steps.forEach((step) => {
          const icon = step.success ? "✓" : "✗";
          setLogs((prev) => [...prev, `  ${icon} ${step.name}: ${step.message}`]);
        });
        if (!dotfilesResult.success) {
          setLogs((prev) => [...prev, "⚠ Some dotfiles setup steps failed, continuing..."]);
        }

        // 3. Terminal setup
        setLogs((prev) => [...prev, "▶ Setting up terminal emulator..."]);
        const { setupTerminal } = await import("./terminal-setup");
        const terminalResult = await setupTerminal(config.verbose);
        terminalResult.steps.forEach((step) => {
          const icon = step.success ? "✓" : "✗";
          setLogs((prev) => [...prev, `  ${icon} ${step.name}: ${step.message}`]);
        });
        if (!terminalResult.success) {
          setLogs((prev) => [...prev, "⚠ Terminal setup encountered issues, continuing..."]);
          setLogs((prev) => [...prev, "⚠ Dotfiles setup completed with some warnings"]);
        }

        // 4. Ensure scripts are executable
        setLogs((prev) => [...prev, "▶ Ensuring dotfiles scripts are executable..."]);
        const { makeScriptsExecutable, verifyScriptsExecutable } = await import("./scripts-executable");
        const execResult = await makeScriptsExecutable(config.verbose);
        execResult.steps.forEach((step) => {
          const icon = step.success ? "✓" : "✗";
          setLogs((prev) => [...prev, `  ${icon} ${step.name}: ${step.message}`]);
        });
        const verifyExec = await verifyScriptsExecutable(config.verbose);
        verifyExec.steps.forEach((step) => {
          const icon = step.success ? "✓" : "✗";
          setLogs((prev) => [...prev, `  ${icon} ${step.name}: ${step.message}`]);
        });

        // 5. System configuration: Brave as default browser
        setLogs((prev) => [...prev, "▶ Setting Brave as default browser..."]);
        const { setBraveAsDefaultBrowser } = await import("./system-config");
        const braveResult = await setBraveAsDefaultBrowser(config.verbose);
        braveResult.steps.forEach((step) => {
          const icon = step.success ? "✓" : "✗";
          setLogs((prev) => [...prev, `  ${icon} ${step.name}: ${step.message}`]);
        });
        if (!braveResult.success) {
          setLogs((prev) => [...prev, "⚠ Brave default browser setup encountered issues"]);
        }

        // 6. Set wallpaper from dotfiles/assets/wallpaper.png
        setLogs((prev) => [...prev, "▶ Setting wallpaper..."]);
        const { setWallpaper } = await import("./system-config");
        const wallpaperResult = await setWallpaper(config.verbose);
        wallpaperResult.steps.forEach((step) => {
          const icon = step.success ? "✓" : "✗";
          setLogs((prev) => [...prev, `  ${icon} ${step.name}: ${step.message}`]);
        });
        if (!wallpaperResult.success) {
          setLogs((prev) => [...prev, "⚠ Wallpaper setup encountered issues"]);
        }

        // 7. Install Blur My Shell GNOME extension
        setLogs((prev) => [...prev, "▶ Installing Blur My Shell GNOME extension..."]);
        const { installBlurMyShell } = await import("./system-config");
        const blurResult = await installBlurMyShell(config.verbose);
        blurResult.steps.forEach((step) => {
          const icon = step.success ? "✓" : "✗";
          setLogs((prev) => [...prev, `  ${icon} ${step.name}: ${step.message}`]);
        });
        if (!blurResult.success) {
          setLogs((prev) => [...prev, "⚠ Blur My Shell installation encountered issues"]);
        }

        // 8. Configure sudo NOPASSWD
        setLogs((prev) => [...prev, "▶ Configuring sudo passwordless access..."]);
        const { configureSudoNoPassword } = await import("./system-config");
        const sudoResult = await configureSudoNoPassword(config.verbose);
        sudoResult.steps.forEach((step) => {
          const icon = step.success ? "✓" : "✗";
          setLogs((prev) => [...prev, `  ${icon} ${step.name}: ${step.message}`]);
        });
        if (!sudoResult.success) {
          setLogs((prev) => [...prev, "⚠ Sudo NOPASSWD configuration encountered issues"]);
        }

        // 9. Configure GNOME desktop (hide icons, dock, hot corner)
        setLogs((prev) => [...prev, "▶ Configuring GNOME desktop..."]);
        const { configureGnomeDesktop } = await import("./system-config");
        const gnomeResult = await configureGnomeDesktop(config.verbose);
        gnomeResult.steps.forEach((step) => {
          const icon = step.success ? "✓" : "✗";
          setLogs((prev) => [...prev, `  ${icon} ${step.name}: ${step.message}`]);
        });
        if (!gnomeResult.success) {
          setLogs((prev) => [...prev, "⚠ GNOME desktop configuration encountered issues"]);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setLogs((prev) => [...prev, `✗ Failed to setup dotfiles: ${errorMsg}`]);
      }
    }

    // System update
    if (!config.skipSystemUpdate && !config.dryRun) {
      setLogs((prev) => [...prev, "\n▶ Updating system packages..."]);
      const updateResult = await updateApt(config.verbose);
      if (updateResult.success) {
        setLogs((prev) => [...prev, "✓ apt update completed"]);
      } else {
        setLogs((prev) => [...prev, "✗ Failed to update system packages"]);
      }

      const upgradeResult = await upgradeApt(config.verbose);
      if (upgradeResult.success) {
        setLogs((prev) => [...prev, "✓ apt upgrade completed"]);
      } else {
        setLogs((prev) => [...prev, "⚠ apt upgrade failed or skipped"]);
      }
    }

    // Install selected packages
    for (const category of cats) {
      if (!category.selected) continue;

      setLogs((prev) => [...prev, `\n▶ Installing ${category.name}...`]);

      for (const pkg of category.packages) {
        // Update package status to running
        setCats((prev) =>
          prev.map((cat) =>
            cat.id === category.id
              ? {
                  ...cat,
                  packages: cat.packages.map((p) =>
                    p.id === pkg.id ? { ...p, status: "running" } : p
                  ),
                }
              : cat
          )
        );

        setLogs((prev) => [...prev, `  ▶ Installing ${pkg.displayName}...`]);
        setCurrentOutput(`Installing ${pkg.displayName}...\n\nPlease wait...`);

        if (config.dryRun) {
          // Simulate installation
          await new Promise((resolve) => setTimeout(resolve, 500));
          setLogs((prev) => [...prev, `  ✓ [DRY RUN] Would install ${pkg.displayName}`]);

          setCats((prev) =>
            prev.map((cat) =>
              cat.id === category.id
                ? {
                    ...cat,
                    packages: cat.packages.map((p) =>
                      p.id === pkg.id ? { ...p, status: "completed" } : p
                    ),
                  }
                : cat
            )
          );
        } else {
          // Check if already completed
          const completed = await isCompleted("packages", pkg.id);
          if (completed) {
            setLogs((prev) => [...prev, `  ✓ ${pkg.displayName} already installed (skipped)`]);
            setCats((prev) =>
              prev.map((cat) =>
                cat.id === category.id
                  ? {
                      ...cat,
                      packages: cat.packages.map((p) =>
                        p.id === pkg.id ? { ...p, status: "completed" } : p
                      ),
                    }
                  : cat
              )
            );
            continue;
          }

          // Actually install with advanced features (retry, dependency checking, rollback)
          try {
            const { installPackageAdvanced } = await import("./install-manager");

            const result = await installPackageAdvanced(pkg, {
              maxRetries: 3,
              retryDelay: 2000,
              verbose: config.verbose,
              enableRollback: true,
            });

            if (result.success) {
              const attemptsMsg = result.attempts > 1 ? ` (succeeded on attempt ${result.attempts})` : "";
              setLogs((prev) => [...prev, `  ✓ ${pkg.displayName} installed successfully${attemptsMsg}`]);
              setCurrentOutput("Installation completed");

              setCats((prev) =>
                prev.map((cat) =>
                  cat.id === category.id
                    ? {
                        ...cat,
                        packages: cat.packages.map((p) =>
                          p.id === pkg.id
                            ? { ...p, status: "completed" }
                            : p
                        ),
                      }
                    : cat
                )
              );
            } else {
              const retryMsg = result.attempts > 1 ? ` (failed after ${result.attempts} attempts)` : "";
              const rollbackMsg = result.rolledBack ? " - rolled back changes" : "";

              setLogs((prev) => [...prev, `  ✗ Failed to install ${pkg.displayName}${retryMsg}${rollbackMsg}`]);
              if (result.error) {
                setLogs((prev) => [...prev, `    Error: ${result.error}`]);
              }
              setCurrentOutput(result.error || "Installation failed");

              setCats((prev) =>
                prev.map((cat) =>
                  cat.id === category.id
                    ? {
                        ...cat,
                        packages: cat.packages.map((p) =>
                          p.id === pkg.id
                            ? { ...p, status: "failed", error: result.error }
                            : p
                        ),
                      }
                    : cat
                )
              );
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            setLogs((prev) => [...prev, `  ✗ Error installing ${pkg.displayName}: ${errorMsg}`]);
            setCurrentOutput(errorMsg);

            setCats((prev) =>
              prev.map((cat) =>
                cat.id === category.id
                  ? {
                      ...cat,
                      packages: cat.packages.map((p) =>
                        p.id === pkg.id ? { ...p, status: "failed", error: errorMsg } : p
                      ),
                    }
                  : cat
              )
            );

            await updatePackageProgress("packages", pkg.id, "failed");
          }
        }
      }
    }

    // Docker post-install configuration (if docker was selected)
    const dockerPkg = cats.flatMap((c) => c.packages).find((p) => p.id === "docker.io");
    if (dockerPkg && dockerPkg.status === "completed" && !config.dryRun) {
      setLogs((prev) => [...prev, "\n▶ Configuring Docker post-install..."]);
      try {
        const { dockerPostInstall } = await import("./system-config");
        const dockerResult = await dockerPostInstall(config.verbose);
        dockerResult.steps.forEach((step) => {
          const icon = step.success ? "✓" : "✗";
          setLogs((prev) => [...prev, `  ${icon} ${step.name}: ${step.message}`]);
        });
        if (!dockerResult.success) {
          setLogs((prev) => [...prev, "⚠ Docker post-install had issues; you may need to re-login for group changes"]);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setLogs((prev) => [...prev, `✗ Docker post-install failed: ${errorMsg}`]);
      }
    }

    // Nerd Fonts installation
    if (!config.dryRun && !config.skipFonts) {
      setLogs((prev) => [...prev, "\n▶ Installing Nerd Fonts..."]);

      try {
        const { installNerdFonts } = await import("./nerd-fonts");
        const fontsResult = await installNerdFonts();

        if (fontsResult.success) {
          setLogs((prev) => [...prev, `✓ ${fontsResult.message}`]);
        } else {
          setLogs((prev) => [...prev, `⚠ ${fontsResult.message}`]);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setLogs((prev) => [...prev, `✗ Failed to install Nerd Fonts: ${errorMsg}`]);
      }
    }

    // Set Fish as default shell
    if (!config.dryRun) {
      setLogs((prev) => [...prev, "\n▶ Setting Fish as default shell..."]);

      try {
        const { setFishAsDefault } = await import("./nerd-fonts");
        const fishResult = await setFishAsDefault();

        if (fishResult.success) {
          setLogs((prev) => [...prev, `✓ ${fishResult.message}`]);
        } else {
          setLogs((prev) => [...prev, `⚠ ${fishResult.message}`]);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setLogs((prev) => [...prev, `✗ Failed to set Fish as default: ${errorMsg}`]);
      }
    }

    // Final verification
    if (!config.dryRun) {
      setLogs((prev) => [...prev, "\n▶ Running final verification..."]);

      try {
        const { generateVerificationReport } = await import("./verification");
        const report = await generateVerificationReport(config.verbose);

        // Add verification report to logs
        const reportLines = report.split("\n");
        reportLines.forEach((line) => {
          setLogs((prev) => [...prev, line]);
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setLogs((prev) => [...prev, `⚠ Verification failed: ${errorMsg}`]);
      }
    }

    setIsRunning(false);
    setMode("complete");
    setLogs((prev) => [...prev, "\n✓ Setup complete!"]);
  };

  // Render different modes
  if (showOutput) {
    return (
      <box style={{ flexDirection: "column", padding: 2, gap: 1 }}>
        <box style={{ border: true, borderColor: "#00FFFF", padding: 1 }}>
          <text fg="#00FFFF" attributes={TextAttributes.BOLD}>
            Output
          </text>
        </box>
        <box style={{ border: true, borderColor: "#666666", padding: 1, flexDirection: "column", height: 25 }}>
          {currentOutput.split("\n").slice(0, 20).map((line, i) => (
            <text key={i} fg="#CCCCCC">
              {line}
            </text>
          ))}
        </box>
        <text fg="#FFFF00">Press 'o' or ESC to close</text>
      </box>
    );
  }

  if (mode === "menu") {
    const menuOptions = [
      { title: "Full Interactive Setup", desc: "Run complete setup with package selection" },
      { title: "Quick Install (All)", desc: "Install everything without prompts" },
      { title: "Custom Install", desc: "Select specific categories to install" },
      { title: "Dry Run", desc: "Preview what would be installed" },
      { title: "List Packages", desc: "View all available packages" },
      { title: "Resume Previous", desc: "Continue interrupted installation" },
      { title: "Help", desc: "Show detailed help and options" },
      { title: "Exit", desc: "Exit the installer" },
    ];

    return (
      <box style={{ flexDirection: "column", padding: 2, gap: 1 }}>
        <box style={{ border: true, borderStyle: "double", borderColor: "#FF00FF", padding: 1 }}>
          <text fg="#FF00FF" attributes={TextAttributes.BOLD}>
            ╔══════════════════════════════════════════════════════════════════╗
          </text>
          <text fg="#FF00FF" attributes={TextAttributes.BOLD}>
            ║                   Dotfiles Setup Script                          ║
          </text>
          <text fg="#FF00FF" attributes={TextAttributes.BOLD}>
            ║                   Welcome to the installer                       ║
          </text>
          <text fg="#FF00FF" attributes={TextAttributes.BOLD}>
            ╚══════════════════════════════════════════════════════════════════╝
          </text>
        </box>

        <text fg="#00FFFF">What would you like to do?</text>
        <text fg="#666666">─────────────────────────────────────────────────────</text>

        {menuOptions.map((option, i) => (
          <box key={i} style={{ flexDirection: "column" }}>
            <text
              fg={i === selectedMenu ? "#FFFF00" : "#FFFFFF"}
              attributes={i === selectedMenu ? TextAttributes.BOLD : undefined}
            >
              {i === selectedMenu ? "► " : "  "}
              [{i + 1}] {option.title}
            </text>
            <text fg="#666666" attributes={TextAttributes.DIM}>
              {"     "}{option.desc}
            </text>
          </box>
        ))}

        <box style={{ marginTop: 1 }}>
          <text fg="#666666">Select: 1-8 or ↑/k ↓/j | Confirm: Enter | Quit: q/Esc</text>
        </box>
      </box>
    );
  }

  if (mode === "select") {
    return (
      <box style={{ flexDirection: "column", padding: 2, gap: 1 }}>
        <box style={{ border: true, borderStyle: "double", borderColor: "#00FFFF", padding: 1 }}>
          <text fg="#00FFFF" attributes={TextAttributes.BOLD}>
            Select Categories to Install
          </text>
          {config.dryRun && (
            <text fg="#FFFF00"> [DRY RUN MODE]</text>
          )}
        </box>

        <box style={{ flexDirection: "row", gap: 2, flexWrap: "wrap" }}>
          {cats.map((cat, idx) => (
            <box
              key={cat.id}
              style={{
                border: true,
                borderColor: idx === currentCategory ? "#00FF00" : "#666666",
                padding: 1,
                width: 35,
                flexDirection: "column",
              }}
            >
              <text
                fg={idx === currentCategory ? "#00FF00" : "#FFFFFF"}
                attributes={idx === currentCategory ? TextAttributes.BOLD : undefined}
              >
                {cat.selected ? "[✓] " : "[ ] "}
                {cat.name}
              </text>
              <text fg="#666666" attributes={TextAttributes.DIM}>
                {cat.packages.length} packages
              </text>
            </box>
          ))}
        </box>

        <box style={{ border: true, borderColor: "#666666", padding: 1, marginTop: 1 }}>
          <text fg="#CCCCCC">{cats[currentCategory].description}</text>
        </box>

        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text fg="#00FFFF">Controls:</text>
          <text fg="#CCCCCC">  ←/h →/l - Switch categories</text>
          <text fg="#CCCCCC">  SPACE   - Toggle selection</text>
          <text fg="#CCCCCC">  a       - Select current category</text>
          <text fg="#CCCCCC">  ENTER   - Continue to confirmation</text>
          <text fg="#CCCCCC">  ESC/q   - Back to menu</text>
        </box>

        <text fg="#FFFF00">
          Selected: {cats.filter((c) => c.selected).length} / {cats.length} categories
        </text>
      </box>
    );
  }

  if (mode === "confirm") {
    const selectedCats = cats.filter((c) => c.selected);
    const totalPackages = selectedCats.reduce((sum, cat) => sum + cat.packages.length, 0);

    return (
      <box style={{ flexDirection: "column", padding: 2, gap: 1 }}>
        <box style={{ border: true, borderStyle: "double", borderColor: "#FFFF00", padding: 1 }}>
          <text fg="#FFFF00" attributes={TextAttributes.BOLD}>
            ⚠ CONFIRMATION REQUIRED
          </text>
        </box>

        <text fg="#FFFFFF">
          You are about to install {totalPackages} packages from {selectedCats.length} categories:
        </text>

        {selectedCats.slice(0, 10).map((cat) => (
          <text key={cat.id} fg="#CCCCCC">
            • {cat.name} ({cat.packages.length} packages)
          </text>
        ))}
        {selectedCats.length > 10 && (
          <text fg="#666666">... and {selectedCats.length - 10} more categories</text>
        )}

        {!config.dryRun && (
          <box style={{ border: true, borderColor: "#FF0000", padding: 1, marginTop: 1 }}>
            <text fg="#FF0000" attributes={TextAttributes.BOLD}>
              These packages will be installed on your system!
            </text>
          </box>
        )}

        {config.dryRun && (
          <box style={{ border: true, borderColor: "#FFFF00", padding: 1, marginTop: 1 }}>
            <text fg="#FFFF00">
              DRY RUN: No actual changes will be made
            </text>
          </box>
        )}

        <box style={{ marginTop: 1 }}>
          <text fg="#00FF00">Press 'y' to continue, 'n' or ESC to cancel</text>
        </box>
      </box>
    );
  }

  if (mode === "running" || mode === "complete") {
    const totalPackages = cats
      .filter((c) => c.selected)
      .reduce((sum, cat) => sum + cat.packages.length, 0);
    const completedPackages = cats
      .flatMap((c) => c.packages)
      .filter((p) => p.status === "completed").length;
    const failedPackages = cats
      .flatMap((c) => c.packages)
      .filter((p) => p.status === "failed").length;
    const progress = totalPackages > 0 ? (completedPackages / totalPackages) * 100 : 0;

    return (
      <box style={{ flexDirection: "column", padding: 2, gap: 1 }}>
        <box
          style={{
            border: true,
            borderStyle: "double",
            borderColor: mode === "complete" ? (failedPackages > 0 ? "#FFFF00" : "#00FF00") : "#FFFF00",
            padding: 1,
          }}
        >
          <text
            fg={mode === "complete" ? (failedPackages > 0 ? "#FFFF00" : "#00FF00") : "#FFFF00"}
            attributes={TextAttributes.BOLD}
          >
            {mode === "complete"
              ? failedPackages > 0
                ? `⚠ Setup Complete with ${failedPackages} error(s)`
                : "✓ Setup Complete!"
              : "⚙ Running Setup..."}
          </text>
        </box>

        <box style={{ flexDirection: "column" }}>
          <text fg="#CCCCCC">
            Progress: {completedPackages}/{totalPackages} ({Math.round(progress)}%)
            {failedPackages > 0 && ` - ${failedPackages} failed`}
          </text>
          <box style={{ border: true, borderColor: "#666666", width: 60, height: 3 }}>
            <box
              style={{
                width: `${progress}%`,
                height: 1,
                backgroundColor: mode === "complete" ? (failedPackages > 0 ? "#FFFF00" : "#00FF00") : "#FFFF00",
              }}
            />
          </box>
        </box>

        <box style={{ border: true, borderColor: "#666666", padding: 1, flexDirection: "column", height: 20 }}>
          <text fg="#00FFFF" attributes={TextAttributes.BOLD}>
            Execution Log:
          </text>
          <text fg="#666666">─────────────────────────────────────</text>
          {logs.slice(-15).map((log, i) => (
            <text key={i} fg="#CCCCCC">
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
