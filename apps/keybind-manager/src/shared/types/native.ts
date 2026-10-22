export type Session = "x11" | "wayland" | "unknown"

export type Distro = {
  id: string
  name: string
  version?: string
  family: "arch" | "debian" | "other"
}

export type Capabilities = {
  distro: Distro
  desktop: string
  session: Session
  package_managers: string[]
  systemd: boolean
  pkexec: boolean
}

export type BackendStatus = {
  installed: boolean
  version?: string
  service_exists: boolean
  service_enabled: boolean
  service_active: boolean
  config_dir: string
}

export type DeviceKind = "keyboard" | "mouse" | "other"

export type InputDevice = {
  name: string
  vendor: string
  product: string
  phys?: string
  keyboard: boolean
  virtual_keyd: boolean
  kind: DeviceKind
}

export type PackageInfo = {
  manager: string
  installed: boolean
  version?: string
  source?: string
  command?: string
  available: boolean
}

export type Issue = {
  code: string
  message: string
  mapping_id?: string
  profile_id?: string
}

export type CheckResult = {
  errors: Issue[]
  warnings: Issue[]
}

export type ManagedFile = {
  name: string
  content: string
}

export type ApplyResult = {
  applied: boolean
  rolled_back: boolean
  message: string
}

export type LocalState = {
  applied_hashes: Record<string, string>
  last_applied?: string | null
  last_error?: string | null
}

export type NativeError = {
  code: string
  message: string
  detail?: string
  retryable: boolean
  action?: string
}

export type IdPattern = "wildcard" | "explicit" | "unknown"

export type IdEntry = {
  raw: string
  excluded: boolean
  device_class?: string
  pattern: IdPattern
  vendor?: string
  product?: string
}

export type ScannedConfig = {
  filename: string
  managed: boolean
  ids: IdEntry[]
}

export type MatchRank = "wildcard" | "explicit"

export type ConfigMatch = {
  filename: string
  managed: boolean
  rank: MatchRank
}

export type KeyboardConflict = {
  device_name: string
  vendor: string
  product: string
  matches: ConfigMatch[]
  conflict: boolean
  shadowed: boolean
}

export type ViaKeyboard = {
  path: string
  protocol: number
  layers: number
}
