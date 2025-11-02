import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { Package } from "../data/packages";
import type { ExecResult } from "./executor";

export type InstallError = {
  package: string;
  error: string;
  recoverable: boolean;
  suggestions: string[];
  timestamp: number;
};

export type ErrorCategory = 
  | "network"
  | "permissions"
  | "dependencies"
  | "not_found"
  | "timeout"
  | "unknown";

const errorLog = join(process.env.HOME || "", ".dotfiles", "logs", "setup-errors.log");

function ensureLogDir(): void {
  const logDir = join(process.env.HOME || "", ".dotfiles", "logs");
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
}

function categorizeError(error: string): ErrorCategory {
  const lower = error.toLowerCase();
  
  if (lower.includes("network") || lower.includes("connection") || lower.includes("timeout")) {
    return "network";
  }
  if (lower.includes("permission") || lower.includes("denied") || lower.includes("sudo")) {
    return "permissions";
  }
  if (lower.includes("depends") || lower.includes("dependency") || lower.includes("required")) {
    return "dependencies";
  }
  if (lower.includes("not found") || lower.includes("404") || lower.includes("no such")) {
    return "not_found";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "timeout";
  }
  
  return "unknown";
}

export function suggestFix(error: InstallError): string[] {
  const category = categorizeError(error.error);
  const suggestions: string[] = [];
  
  switch (category) {
    case "network":
      suggestions.push("Check your internet connection");
      suggestions.push("Try again in a few moments");
      suggestions.push("Check if the download server is accessible");
      break;
      
    case "permissions":
      suggestions.push("Ensure you have sudo privileges");
      suggestions.push("Run: sudo -v to refresh sudo timeout");
      suggestions.push("Check file permissions in target directory");
      break;
      
    case "dependencies":
      suggestions.push("Install missing dependencies first");
      suggestions.push("Run system update: sudo apt-get update");
      suggestions.push("Check package requirements");
      break;
      
    case "not_found":
      suggestions.push("Verify package name is correct");
      suggestions.push("Check if package is available for your system");
      suggestions.push("Try alternative installation method");
      break;
      
    case "timeout":
      suggestions.push("Increase timeout duration");
      suggestions.push("Check network stability");
      suggestions.push("Try during off-peak hours");
      break;
      
    case "unknown":
      suggestions.push("Check the error log for details");
      suggestions.push("Search for the error message online");
      suggestions.push("Try manual installation");
      break;
  }
  
  return suggestions;
}

export function isRecoverable(error: string): boolean {
  const category = categorizeError(error);
  return category === "network" || category === "timeout" || category === "permissions";
}

export function logError(error: InstallError): void {
  ensureLogDir();
  
  const timestamp = new Date(error.timestamp).toISOString();
  const logEntry = `
[${timestamp}] Package: ${error.package}
Error: ${error.error}
Recoverable: ${error.recoverable}
Suggestions:
${error.suggestions.map(s => `  - ${s}`).join("\n")}
${"=".repeat(80)}
`;
  
  try {
    writeFileSync(errorLog, logEntry, { flag: "a" });
  } catch {
    // Silent fail - logging is not critical
  }
}

export function createError(pkg: Package, result: ExecResult): InstallError {
  const error: InstallError = {
    package: pkg.id,
    error: result.error || "Unknown error",
    recoverable: isRecoverable(result.error || ""),
    suggestions: [],
    timestamp: Date.now(),
  };
  
  error.suggestions = suggestFix(error);
  logError(error);
  
  return error;
}

export async function retryWithBackoff(
  fn: () => Promise<ExecResult>,
  maxAttempts: number = 3
): Promise<ExecResult> {
  let lastError: ExecResult | null = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await fn();
    
    if (result.success) {
      return result;
    }
    
    lastError = result;
    
    if (attempt < maxAttempts && isRecoverable(result.error || "")) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    } else {
      break;
    }
  }
  
  return lastError || { success: false, output: "", error: "Max retries exceeded" };
}
