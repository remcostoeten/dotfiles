import { readFileSync } from "fs";
import { join } from "path";
import type { InstallMethod } from "../services/executor";

export type Package = {
  id: string;
  name: string;
  description: string;
  category: string;
  method: InstallMethod;
  extra?: string;
  optional: boolean;
};

type CategoryMap = {
  file: string;
  category: string;
};

const categories: CategoryMap[] = [
  { file: "essential.sh", category: "essential" },
  { file: "languages.sh", category: "languages" },
  { file: "editors.sh", category: "editors" },
  { file: "package-managers.sh", category: "package-managers" },
  { file: "git-tools.sh", category: "git" },
  { file: "cli-utils.sh", category: "cli" },
  { file: "browsers.sh", category: "browsers" },
  { file: "communication.sh", category: "communication" },
  { file: "media.sh", category: "media" },
  { file: "devops.sh", category: "devops" },
  { file: "system.sh", category: "system" },
  { file: "hardware.sh", category: "hardware" },
  { file: "automation.sh", category: "automation" },
  { file: "gnome.sh", category: "gnome" },
  { file: "snap.sh", category: "snap" },
  { file: "curl-tools.sh", category: "tools" },
  { file: "npm-tools.sh", category: "npm-tools" },
  { file: "android.sh", category: "android" },
];

function parseBashArray(content: string, arrayName: string): string[] {
  const regex = new RegExp(`declare -a ${arrayName}=\\(([^)]+)\\)`, "s");
  const match = content.match(regex);
  
  if (!match || !match[1]) return [];
  
  const items = match[1]
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith('"'))
    .map(line => line.replace(/^"|"$/g, ""));
  
  return items;
}

function parsePackageString(pkg: string, category: string): Package | null {
  if (pkg.includes("|")) {
    const parts = pkg.split("|");
    const id = parts[0] || "";
    const method = (parts[1] || "apt") as InstallMethod;
    const extra = parts[2] || undefined;
    const name = parts[3] || id;
    
    if (!id) return null;
    
    return {
      id,
      name,
      description: name,
      category,
      method,
      extra,
      optional: category !== "essential",
    };
  }
  
  if (pkg.includes(":")) {
    const [id, name] = pkg.split(":");
    if (!id || !name) return null;
    
    return {
      id,
      name,
      description: name,
      category,
      method: "apt",
      optional: true,
    };
  }
  
  return null;
}

export function importFromBash(): Package[] {
  const packages: Package[] = [];
  const setupDir = join(process.cwd(), "..", "setup", "packages");
  
  for (const cat of categories) {
    try {
      const filePath = join(setupDir, cat.file);
      const content = readFileSync(filePath, "utf-8");
      
      let arrayName = "";
      if (cat.file === "essential.sh") arrayName = "ESSENTIAL_PACKAGES";
      else if (cat.file === "languages.sh") arrayName = "LANGUAGES";
      else if (cat.file === "editors.sh") arrayName = "EDITORS";
      else if (cat.file === "package-managers.sh") arrayName = "PACKAGE_MANAGERS";
      else if (cat.file === "git-tools.sh") arrayName = "GIT_TOOLS";
      else if (cat.file === "cli-utils.sh") arrayName = "CLI_UTILITIES";
      else if (cat.file === "browsers.sh") arrayName = "BROWSERS";
      else if (cat.file === "communication.sh") arrayName = "COMMUNICATION_APPS";
      else if (cat.file === "media.sh") arrayName = "MEDIA_APPS";
      else if (cat.file === "devops.sh") arrayName = "DEVOPS_TOOLS";
      else if (cat.file === "system.sh") arrayName = "SYSTEM_UTILS";
      else if (cat.file === "hardware.sh") arrayName = "HARDWARE_TOOLS";
      else if (cat.file === "automation.sh") arrayName = "AUTOMATION_TOOLS";
      else if (cat.file === "gnome.sh") arrayName = "GNOME_TOOLS";
      else if (cat.file === "snap.sh") arrayName = "SNAP_PACKAGES";
      else if (cat.file === "curl-tools.sh") arrayName = "CURL_TOOLS";
      else if (cat.file === "npm-tools.sh") arrayName = "NPM_CLI_TOOLS";
      else if (cat.file === "android.sh") arrayName = "ANDROID_TOOLS";
      
      const items = parseBashArray(content, arrayName);
      
      for (const item of items) {
        const pkg = parsePackageString(item, cat.category);
        if (pkg) {
          packages.push(pkg);
        }
      }
    } catch (error) {
      console.warn(`Failed to load ${cat.file}:`, error);
    }
  }
  
  return packages;
}
