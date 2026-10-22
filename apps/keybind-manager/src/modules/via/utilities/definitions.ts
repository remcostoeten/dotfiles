import { parseDefinition } from "@/modules/via/utilities/definition"
import type { ViaDefinition } from "@/modules/via/types"

const sources = import.meta.glob<string>("../definitions/*.json", {
  eager: true,
  query: "?raw",
  import: "default"
})

export const bundledDefinitions: ViaDefinition[] = Object.values(sources).map(parseDefinition)
