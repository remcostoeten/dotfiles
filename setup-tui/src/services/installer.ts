import type { Package } from "../data/packages";
import { executeCommand } from "./executor";
import type { ExecResult } from "./executor";

export type InstallResult = {
  package: string;
  success: boolean;
  error?: string;
};

export type InstallCallbacks = {
  onProgress?: (pkg: string, status: "installing" | "success" | "failed") => void;
  onComplete?: (results: InstallResult[]) => void;
};

export async function checkInstalled(pkg: Package): Promise<boolean> {
  try {
    const { $ } = await import("bun");
    const result = await $`command -v ${pkg.id}`.quiet();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export async function installPackage(pkg: Package): Promise<ExecResult> {
  const installed = await checkInstalled(pkg);
  if (installed) {
    return {
      success: true,
      output: `${pkg.name} already installed`,
    };
  }

  return executeCommand(pkg.method, pkg.id, pkg.extra);
}

export async function installBatch(
  packages: Package[],
  callbacks?: InstallCallbacks
): Promise<InstallResult[]> {
  const results: InstallResult[] = [];

  for (const pkg of packages) {
    callbacks?.onProgress?.(pkg.id, "installing");

    const result = await installPackage(pkg);

    const installResult: InstallResult = {
      package: pkg.id,
      success: result.success,
      error: result.error,
    };

    results.push(installResult);

    if (result.success) {
      callbacks?.onProgress?.(pkg.id, "success");
    } else {
      callbacks?.onProgress?.(pkg.id, "failed");
    }
  }

  callbacks?.onComplete?.(results);
  return results;
}

export async function retryFailed(
  packages: Package[],
  failedIds: string[],
  callbacks?: InstallCallbacks
): Promise<InstallResult[]> {
  const toRetry = packages.filter(p => failedIds.includes(p.id));
  return installBatch(toRetry, callbacks);
}

export function resolveDependencies(packages: Package[]): Package[] {
  const resolved: Package[] = [];
  const visited = new Set<string>();

  function visit(pkg: Package) {
    if (visited.has(pkg.id)) return;
    visited.add(pkg.id);

    if (pkg.dependencies) {
      for (const depId of pkg.dependencies) {
        const dep = packages.find(p => p.id === depId);
        if (dep) visit(dep);
      }
    }

    resolved.push(pkg);
  }

  packages.forEach(visit);
  return resolved;
}
