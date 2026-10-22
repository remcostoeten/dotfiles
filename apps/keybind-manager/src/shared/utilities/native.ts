import { invoke } from "@tauri-apps/api/core"
import type { AppConfig, Profile } from "@/shared/types/config"
import type {
  ApplyResult,
  BackendStatus,
  Capabilities,
  CheckResult,
  InputDevice,
  KeyboardConflict,
  LocalState,
  ManagedFile,
  NativeError,
  PackageInfo,
  ScannedConfig,
  ViaKeyboard
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

export function scanKeydConfigs(): Promise<ScannedConfig[]> {
  return call("scan_keyd_configs")
}

export function getKeyboardConflicts(): Promise<KeyboardConflict[]> {
  return call("get_keyboard_conflicts")
}

export function getKeyboardOwnership(config: AppConfig): Promise<KeyboardConflict[]> {
  return call("get_keyboard_ownership", { config })
}

export function importKeydConfig(filename: string): Promise<Profile> {
  return call("import_keyd_config", { filename })
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

export type DesktopApp = {
  name: string
  path: string
}

export function getSessionUser(): Promise<string | null> {
  return call("get_session_user")
}

export function getDesktopApps(): Promise<DesktopApp[]> {
  return call("get_desktop_apps")
}

export function viaDetect(vendor: string, product: string): Promise<ViaKeyboard> {
  return call("via_detect", { vendor, product })
}

export function viaReadKeymap(vendor: string, product: string, layers: number, rows: number, cols: number): Promise<number[]> {
  return call("via_read_keymap", { vendor, product, layers, rows, cols })
}

export function viaSetKeycode(vendor: string, product: string, layer: number, row: number, col: number, keycode: number): Promise<void> {
  return call("via_set_keycode", { vendor, product, layer, row, col, keycode })
}

export function viaGetLayoutOptions(vendor: string, product: string): Promise<number> {
  return call("via_get_layout_options", { vendor, product })
}

export function viaSetLayoutOptions(vendor: string, product: string, options: number): Promise<void> {
  return call("via_set_layout_options", { vendor, product, options })
}

export function viaSaveLayout(path: string, contents: string): Promise<void> {
  return call("via_save_layout", { path, contents })
}
