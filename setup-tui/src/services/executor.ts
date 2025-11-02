import { $ } from "bun";

export type ExecResult = {
  success: boolean;
  output: string;
  error?: string;
};

export type InstallMethod = "apt" | "snap" | "curl" | "npm" | "github" | "cargo";

export async function executeApt(pkg: string): Promise<ExecResult> {
  try {
    const result = await $`sudo apt-get install -y ${pkg}`.quiet();
    return {
      success: result.exitCode === 0,
      output: result.stdout.toString(),
      error: result.exitCode !== 0 ? result.stderr.toString() : undefined,
    };
  } catch (error) {
    return {
      success: false,
      output: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function executeSnap(pkg: string): Promise<ExecResult> {
  try {
    const hasSnap = await $`command -v snap`.quiet();
    if (hasSnap.exitCode !== 0) {
      return {
        success: false,
        output: "",
        error: "snapd not installed",
      };
    }

    const result = await $`sudo snap install ${pkg}`.quiet();
    return {
      success: result.exitCode === 0,
      output: result.stdout.toString(),
      error: result.exitCode !== 0 ? result.stderr.toString() : undefined,
    };
  } catch (error) {
    return {
      success: false,
      output: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function executeCurl(url: string, name: string): Promise<ExecResult> {
  try {
    let cmd = "";
    
    if (name === "starship") {
      cmd = `curl -fsSL ${url} | sh -s -- -y`;
    } else if (name === "pnpm") {
      cmd = `curl -fsSL ${url} | sh -`;
    } else if (name === "turso") {
      cmd = `curl -sSfL ${url} | bash`;
    } else if (name === "nvm") {
      cmd = `curl -o- ${url} | bash`;
    } else {
      cmd = `curl -fsSL ${url} | bash`;
    }

    const result = await $`sh -c ${cmd}`.quiet();
    return {
      success: result.exitCode === 0,
      output: result.stdout.toString(),
      error: result.exitCode !== 0 ? result.stderr.toString() : undefined,
    };
  } catch (error) {
    return {
      success: false,
      output: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function executeNpm(pkg: string): Promise<ExecResult> {
  try {
    const hasNpm = await $`command -v npm`.quiet();
    const hasPnpm = await $`command -v pnpm`.quiet();

    let result;
    if (hasPnpm.exitCode === 0) {
      result = await $`pnpm add -g ${pkg}`.quiet();
    } else if (hasNpm.exitCode === 0) {
      result = await $`npm install -g ${pkg}`.quiet();
    } else {
      return {
        success: false,
        output: "",
        error: "npm/pnpm not installed",
      };
    }

    return {
      success: result.exitCode === 0,
      output: result.stdout.toString(),
      error: result.exitCode !== 0 ? result.stderr.toString() : undefined,
    };
  } catch (error) {
    return {
      success: false,
      output: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function executeGithub(repo: string, name: string): Promise<ExecResult> {
  try {
    const arch = await $`uname -m`.text();
    const archMap: Record<string, string> = {
      "x86_64": "x86_64",
      "aarch64": "arm64",
      "arm64": "arm64",
    };
    
    const mappedArch = archMap[arch.trim()] || "x86_64";
    
    const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;
    const response = await fetch(apiUrl);
    const data = await response.json() as { assets?: Array<{ name: string; browser_download_url: string }> };
    
    const asset = data.assets?.find((a) => 
      a.name.includes("Linux") && 
      a.name.includes(mappedArch) && 
      a.name.endsWith(".tar.gz")
    );

    if (!asset) {
      return {
        success: false,
        output: "",
        error: `No release found for ${mappedArch}`,
      };
    }

    const tempDir = await $`mktemp -d`.text();
    const downloadUrl = asset.browser_download_url;
    
    await $`wget -q ${downloadUrl} -O ${tempDir}/${name}.tar.gz`;
    await $`tar -xzf ${tempDir}/${name}.tar.gz -C ${tempDir}`;
    
    const binary = await $`find ${tempDir} -name ${name} -type f`.text();
    if (binary.trim()) {
      await $`sudo mv ${binary.trim()} /usr/local/bin/${name}`;
      await $`sudo chmod +x /usr/local/bin/${name}`;
      await $`rm -rf ${tempDir}`;
      
      return {
        success: true,
        output: `Installed ${name} from GitHub`,
      };
    }

    await $`rm -rf ${tempDir}`;
    return {
      success: false,
      output: "",
      error: "Binary not found in archive",
    };
  } catch (error) {
    return {
      success: false,
      output: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function executeCargo(pkg: string): Promise<ExecResult> {
  try {
    const hasCargo = await $`command -v cargo`.quiet();
    if (hasCargo.exitCode !== 0) {
      return {
        success: false,
        output: "",
        error: "cargo not installed",
      };
    }

    const result = await $`cargo install ${pkg}`.quiet();
    return {
      success: result.exitCode === 0,
      output: result.stdout.toString(),
      error: result.exitCode !== 0 ? result.stderr.toString() : undefined,
    };
  } catch (error) {
    return {
      success: false,
      output: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function executeCommand(
  method: InstallMethod,
  pkg: string,
  extra?: string
): Promise<ExecResult> {
  switch (method) {
    case "apt":
      return executeApt(pkg);
    case "snap":
      return executeSnap(pkg);
    case "curl":
      return executeCurl(extra || "", pkg);
    case "npm":
      return executeNpm(pkg);
    case "github":
      return executeGithub(extra || "", pkg);
    case "cargo":
      return executeCargo(pkg);
    default:
      return {
        success: false,
        output: "",
        error: `Unknown method: ${method}`,
      };
  }
}
