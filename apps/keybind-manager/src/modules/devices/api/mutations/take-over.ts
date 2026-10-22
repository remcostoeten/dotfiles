import type { NativeError } from "@/shared/types/native"
import { importKeydConfig } from "@/shared/utilities/native"
import { toNativeError } from "@/shared/utilities/guards"
import { appStore } from "@/app/utilities/store"

export type TakeOverResult = { ok: true; profileId: string } | { ok: false; error: NativeError }

export async function takeOverKeydConfig(filename: string): Promise<TakeOverResult> {
  try {
    const profile = await importKeydConfig(filename)
    return { ok: true, profileId: appStore.adoptProfile(profile) }
  } catch (raw) {
    return { ok: false, error: toNativeError(raw) }
  }
}
