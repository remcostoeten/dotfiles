import { invoke } from "@tauri-apps/api/core"
import type { AppConfig } from "@/shared/types/config"
import type {
  ApplyResult,
  BackendStatus,
  Capabilities,
  CheckResult,
  InputDevice,
  LocalState,
  ManagedFile,
  NativeError,
  PackageInfo
} from "@/shared/types/native"
import { toNativeError } from "@/shared/utilities/guards"

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args)
  } catch (raw) {
    const error: NativeError = toNativeError(raw)
    throw error
  }
}

export function getCapabilities(): Promise<Capabilities> {
  return call("get_capabilities")
}

export function getBackendStatus(): Promise<BackendStatus> {
  return call("get_backend_status")
}

export function getDevices(): Promise<InputDevice[]> {
  return call("get_devices")
}

export function getInstallGuidance(): Promise<PackageInfo[]> {
  return call("get_install_guidance")
}

export function getConfig(): Promise<AppConfig> {
  return call("get_config")
}

export function putConfig(config: AppConfig): Promise<void> {
  return call("put_config", { config })
}

export function checkConfig(config: AppConfig): Promise<CheckResult> {
  return call("check_config", { config })
}

export function previewConfig(config: AppConfig): Promise<ManagedFile[]> {
  return call("preview_config", { config })
}

export function applyConfig(config: AppConfig, force: boolean): Promise<ApplyResult> {
  return call("apply_config", { config, force })
}

export function helperAction(action: string): Promise<string> {
  return call("helper_action", { action })
}

export function getLocalState(): Promise<LocalState> {
  return call("get_local_state")
}

export function exportProfiles(
  config: AppConfig,
  profileId: string | null,
  dir: string,
  includeHardware: boolean
): Promise<string> {
  return call("export_profiles", {
    config,
    profileId,
    dir,
    includeHardware
  })
}

export function importBundle(path: string): Promise<{ schema: number; profiles: AppConfig["profiles"] }> {
  return call("import_bundle", { path })
}
