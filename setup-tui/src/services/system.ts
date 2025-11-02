import { $ } from "bun";

export type SystemInfo = {
  os: string;
  arch: string;
  shell: string;
  user: string;
};

export async function updateSystem(): Promise<void> {
  await $`sudo apt-get update`.quiet();
  await $`sudo apt-get upgrade -y`.quiet();
}

export async function checkDependencies(): Promise<string[]> {
  const required = ["curl", "wget", "git"];
  const missing: string[] = [];

  for (const dep of required) {
    const result = await $`command -v ${dep}`.quiet();
    if (result.exitCode !== 0) {
      missing.push(dep);
    }
  }

  return missing;
}

export async function ensureSudo(): Promise<boolean> {
  try {
    const result = await $`sudo -n true`.quiet();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export async function getSystemInfo(): Promise<SystemInfo> {
  const os = await $`uname -s`.text();
  const arch = await $`uname -m`.text();
  const shell = await $`echo $SHELL`.text();
  const user = await $`whoami`.text();

  return {
    os: os.trim(),
    arch: arch.trim(),
    shell: shell.trim(),
    user: user.trim(),
  };
}

export async function checkCompatibility(): Promise<boolean> {
  const info = await getSystemInfo();
  return info.os === "Linux" && (info.arch === "x86_64" || info.arch === "aarch64");
}
