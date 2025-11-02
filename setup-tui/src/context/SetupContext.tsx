import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import type { Package } from "../data/packages";
import type { ProgressState } from "../services/progress";

export type SetupConfig = {
  verbose: boolean;
  skipSystemUpdate: boolean;
  parallelInstalls: number;
};

type SetupState = {
  packages: Package[];
  selected: Set<string>;
  progress: ProgressState | null;
  config: SetupConfig;
  isInstalling: boolean;
};

type SetupActions = {
  togglePackage: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setProgress: (progress: ProgressState) => void;
  setInstalling: (installing: boolean) => void;
  updateConfig: (config: Partial<SetupConfig>) => void;
};

type SetupContextType = SetupState & SetupActions;

const SetupContext = createContext<SetupContextType | null>(null);

type Props = {
  children: ReactNode;
  packages: Package[];
};

export function SetupProvider({ children, packages }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [isInstalling, setInstalling] = useState(false);
  const [config, setConfig] = useState<SetupConfig>({
    verbose: false,
    skipSystemUpdate: false,
    parallelInstalls: 1,
  });

  function togglePackage(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(packages.map(p => p.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function updateConfig(partial: Partial<SetupConfig>) {
    setConfig(prev => ({ ...prev, ...partial }));
  }

  const value: SetupContextType = {
    packages,
    selected,
    progress,
    config,
    isInstalling,
    togglePackage,
    selectAll,
    clearSelection,
    setProgress,
    setInstalling,
    updateConfig,
  };

  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>;
}

export function useSetup() {
  const context = useContext(SetupContext);
  if (!context) {
    throw new Error("useSetup must be used within SetupProvider");
  }
  return context;
}
