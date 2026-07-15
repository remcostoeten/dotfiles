import { createMemo, createResource, createSignal } from "solid-js"
import { createStore, produce, reconcile, unwrap } from "solid-js/store"
import type { AppConfig, Mapping, Profile } from "@/shared/types/config"
import { getConfig, putConfig } from "@/shared/utilities/native"
import { makeId } from "@/shared/utilities/id"

const emptyConfig: AppConfig = {
  version: 1,
  active: "default",
  profiles: [
    { id: "default", name: "Default", enabled: true, devices: [], mappings: [], layers: [] }
  ],
  settings: {}
}

const [config, setConfig] = createStore<AppConfig>(structuredClone(emptyConfig))
const [dirty, setDirty] = createSignal(false)
const [selectedProfile, setSelectedProfile] = createSignal("default")

const [loaded] = createResource(async function loadInitial() {
  const stored = await getConfig()
  setConfig(reconcile(stored))
  if (stored.profiles.length > 0) {
    setSelectedProfile(stored.active)
  }
  return true
})

const currentProfile = createMemo(function findProfile(): Profile | undefined {
  return config.profiles.find(function matches(p) {
    return p.id === selectedProfile()
  })
})

function snapshot(): AppConfig {
  return structuredClone(unwrap(config))
}

function mutate(recipe: (draft: AppConfig) => void) {
  setConfig(produce(recipe))
  setDirty(true)
}

async function persist() {
  await putConfig(snapshot())
  setDirty(false)
}

function addProfile(name: string): string {
  const id = makeId("profile")
  mutate(function add(draft) {
    draft.profiles.push({ id, name, enabled: true, devices: [], mappings: [], layers: [] })
  })
  setSelectedProfile(id)
  return id
}

function removeProfile(id: string) {
  mutate(function remove(draft) {
    draft.profiles = draft.profiles.filter(function keep(p) {
      return p.id !== id
    })
    if (draft.active === id && draft.profiles[0]) {
      draft.active = draft.profiles[0].id
    }
  })
  const first = config.profiles[0]
  if (selectedProfile() === id && first) {
    setSelectedProfile(first.id)
  }
}

function updateProfile(id: string, recipe: (profile: Profile) => void) {
  mutate(function update(draft) {
    const profile = draft.profiles.find(function matches(p) {
      return p.id === id
    })
    if (profile) {
      recipe(profile)
    }
  })
}

function duplicateProfile(id: string) {
  const source = config.profiles.find(function matches(p) {
    return p.id === id
  })
  if (!source) {
    return
  }
  const copy = structuredClone(unwrap(source)) as Profile
  copy.id = makeId("profile")
  copy.name = `${copy.name} copy`
  copy.mappings = copy.mappings.map(function reid(m): Mapping {
    return { ...m, id: makeId("map") }
  })
  mutate(function add(draft) {
    draft.profiles.push(copy)
  })
  setSelectedProfile(copy.id)
}

function moveProfile(id: string, delta: number) {
  mutate(function move(draft) {
    const index = draft.profiles.findIndex(function matches(p) {
      return p.id === id
    })
    const next = index + delta
    if (index < 0 || next < 0 || next >= draft.profiles.length) {
      return
    }
    const [item] = draft.profiles.splice(index, 1)
    if (item) {
      draft.profiles.splice(next, 0, item)
    }
  })
}

export const appStore = {
  config,
  loaded,
  dirty,
  setDirty,
  selectedProfile,
  setSelectedProfile,
  currentProfile,
  snapshot,
  mutate,
  persist,
  addProfile,
  removeProfile,
  updateProfile,
  duplicateProfile,
  moveProfile
}
