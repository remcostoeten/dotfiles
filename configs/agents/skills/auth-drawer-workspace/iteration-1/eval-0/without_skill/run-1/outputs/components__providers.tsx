// Intended path: src/components/providers.tsx (or @/components/providers)
//
// Client-side wrapper that mounts the AuthDrawerProvider at the app root.
// We keep this in its own "use client" component so the root layout can
// stay a Server Component.

"use client";

import type { ReactNode } from "react";
import { AuthDrawerProvider } from "@remcostoeten/auth-drawer";
import { authAdapter } from "@/lib/auth-adapter";

type TProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: TProvidersProps) {
  return (
    <AuthDrawerProvider adapter={authAdapter}>
      {children}
    </AuthDrawerProvider>
  );
}
