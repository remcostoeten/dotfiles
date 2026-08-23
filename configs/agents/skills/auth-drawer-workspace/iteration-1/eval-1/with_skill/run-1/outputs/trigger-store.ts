// src/auth/trigger-store.ts
//
// A single shared trigger store. Scroll triggers need a shared store because the
// host app (not <AuthDrawer>) is what emits the scroll event. Pass this same
// instance to both <AuthDrawer> (via triggerStore) and to useScrollOpenTrigger.

import { createAuthTriggerStore } from "@remcostoeten/auth-drawer";

export const triggerStore = createAuthTriggerStore();
