#!/usr/bin/env bun
/**
 * CLI Package Manager - install/remove individual packages
 */

import { categories } from "./src/packages";
import { executeCommand } from "./src/executor";

const verbose = process.argv.includes("--verbose");
const action = process.argv[2]; // install or remove
const searchTerm = process.argv[3];

if (!action || !searchTerm || !["install", "remove"].includes(action)) {
  console.log("Usage: bun run cli-manager install|remove <package-name> [--verbose]");
  console.log("\nAvailable packages:");
  listAllPackages();
  process.exit(1);
}

async function listAllPackages() {
  for (const category of categories) {
    console.log(`\n${category.name}:`);
    category.packages.forEach(pkg => {
      console.log(`  - ${pkg.id} (${pkg.displayName}) - ${pkg.method}`);
    });
  }
}

async function findPackage(search: string) {
  for (const category of categories) {
    const pkg = category.packages.find(p =>
      p.id === search.toLowerCase() ||
      p.displayName.toLowerCase().includes(search.toLowerCase()) ||
      p.name.toLowerCase().includes(search.toLowerCase())
    );
    if (pkg) return { pkg, category };
  }
  return null;
}

async function checkInstalled(pkg: any) {
  const { name, method } = pkg;
  switch (method) {
    case "apt":
      return await executeCommand(`dpkg -l | grep -q "^ii  ${name} "`, false);
    case "snap":
      return await executeCommand(`snap list | grep -q "^${name} "`, false);
    case "npm":
      return await executeCommand(`npm list -g ${name} 2>/dev/null | grep -q "${name}"`, false);
    case "github":
      return await executeCommand(`test -d ${name}`, false);
    case "curl":
      return await executeCommand(`command -v ${name}`, false);
    default:
      return { success: false };
  }
}

async function installPackage(pkg: any) {
  const { name, method, extra, flags } = pkg;

  switch (method) {
    case "apt":
      return await executeCommand(`sudo apt install -y ${name}`, verbose);
    case "snap":
      const snapFlags = flags || "";
      return await executeCommand(`sudo snap install ${snapFlags} ${name}`, verbose);
    case "github":
      // Try different installation methods for GitHub packages
      if (name === "lazygit") {
        return await executeCommand(`LAZYGIT_VERSION=$(curl -s "https://api.github.com/repos/jesseduffield/lazygit/releases/latest" | grep -Po '"tag_name": "v\K[^"]*') && curl -Lo lazygit "https://github.com/jesseduffield/lazygit/releases/latest/download/lazygit_${LAZYGIT_VERSION}_$(uname -s)_$(uname -m).tar.gz" && tar xf lazygit && sudo mv lazygit /usr/local/bin && rm -rf lazygit lazygit.tar.gz`, verbose);
      } else if (name === "lazydocker") {
        return await executeCommand(`curl https://github.com/jesseduffield/lazydocker/releases/latest/download/lazydocker_$(uname -s)_$(uname -m).tar.gz | tar xz && sudo mv lazydocker /usr/local/bin/`, verbose);
      } else {
        return await executeCommand(`gh repo clone ${extra} ${name}`, verbose);
      }
    case "curl":
      return await executeCommand(`curl -fsSL ${extra} | bash`, verbose);
    case "npm":
      return await executeCommand(`npm install -g ${name}`, verbose);
    default:
      return { success: false, output: "", error: `Unsupported method: ${method}` };
  }
}

async function removePackage(pkg: any) {
  const { name, method } = pkg;

  switch (method) {
    case "apt":
      return await executeCommand(`sudo apt remove -y ${name}`, verbose);
    case "snap":
      return await executeCommand(`sudo snap remove ${name}`, verbose);
    case "npm":
      return await executeCommand(`npm uninstall -g ${name}`, verbose);
    case "github":
      return await executeCommand(`rm -rf ${name}`, verbose);
    case "curl":
      // For curl tools, this is more complex - just warn user
      return {
        success: false,
        output: "",
        error: `Cannot automatically remove ${name} - installed via curl. Manual removal may be required.`
      };
    default:
      return { success: false, output: "", error: `Unsupported method: ${method}` };
  }
}

async function main() {
  const found = await findPackage(searchTerm);

  if (!found) {
    console.log(`❌ Package "${searchTerm}" not found.`);
    console.log("\nAvailable packages:");
    listAllPackages();
    process.exit(1);
  }

  const { pkg, category } = found;
  console.log(`Found: ${pkg.displayName} (${pkg.id}) from ${category.name}`);

  if (action === "install") {
    const installed = await checkInstalled(pkg);
    if (installed.success) {
      console.log(`✅ ${pkg.displayName} is already installed`);
      process.exit(0);
    }

    console.log(`📦 Installing ${pkg.displayName}...`);
    const result = await installPackage(pkg);

    if (result.success) {
      console.log(`✅ ${pkg.displayName} installed successfully`);
    } else {
      console.log(`❌ Failed to install ${pkg.displayName}: ${result.error}`);
      process.exit(1);
    }
  } else if (action === "remove") {
    const installed = await checkInstalled(pkg);
    if (!installed.success) {
      console.log(`ℹ️ ${pkg.displayName} is not installed`);
      process.exit(0);
    }

    console.log(`🗑️ Removing ${pkg.displayName}...`);
    const result = await removePackage(pkg);

    if (result.success) {
      console.log(`✅ ${pkg.displayName} removed successfully`);
    } else {
      console.log(`❌ Failed to remove ${pkg.displayName}: ${result.error}`);
      process.exit(1);
    }
  }
}

main().catch(console.error);
