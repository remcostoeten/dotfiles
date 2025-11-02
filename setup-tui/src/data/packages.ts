import { importFromBash } from "./packageImporter";
import type { Package } from "./packageImporter";

export type { Package };

export const packages: Package[] = importFromBash();
