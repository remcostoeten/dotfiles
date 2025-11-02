import type { Package } from "../data/packages";

export type DryRunResult = {
  package: string;
  name: string;
  method: string;
  alreadyInstalled: boolean;
  estimatedSize?: string;
};

export async function checkIfInstalled(pkgId: string): Promise<boolean> {
  try {
    const { $ } = await import("bun");
    const result = await $`command -v ${pkgId}`.quiet();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export async function previewInstallation(packages: Package[]): Promise<DryRunResult[]> {
  const results: DryRunResult[] = [];

  for (const pkg of packages) {
    const installed = await checkIfInstalled(pkg.id);
    
    results.push({
      package: pkg.id,
      name: pkg.name,
      method: pkg.method,
      alreadyInstalled: installed,
      estimatedSize: getEstimatedSize(pkg.method),
    });
  }

  return results;
}

function getEstimatedSize(method: string): string {
  const sizes: Record<string, string> = {
    apt: "~10-50 MB",
    snap: "~50-200 MB",
    curl: "~5-20 MB",
    npm: "~1-10 MB",
    github: "~5-30 MB",
    cargo: "~10-100 MB",
  };
  
  return sizes[method] || "Unknown";
}

export function calculateTotalStats(results: DryRunResult[]): {
  total: number;
  toInstall: number;
  alreadyInstalled: number;
} {
  return {
    total: results.length,
    toInstall: results.filter(r => !r.alreadyInstalled).length,
    alreadyInstalled: results.filter(r => r.alreadyInstalled).length,
  };
}
