import { createResource } from "solid-js"
import {
  getBackendStatus,
  getCapabilities,
  getDevices,
  getInstallGuidance,
  getLocalState
} from "@/shared/utilities/native"

export const [capabilities] = createResource(getCapabilities)
export const [installGuidance] = createResource(getInstallGuidance)
export const [backendStatus, { refetch: refetchBackend }] = createResource(getBackendStatus)
export const [localState, { refetch: refetchLocalState }] = createResource(getLocalState)
export const [devices, { refetch: refetchDevices }] = createResource(getDevices)
