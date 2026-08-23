// src/components/auth-provider.tsx
//
// Client boundary. AuthProvider, AuthDrawer and useAuth are all client-side,
// so they live behind "use client". The provider reads the session once via
// adapter.useSession() and exposes it (plus drawer controls) through context.
"use client";

import type { ReactNode } from "react";
import { AuthProvider, AuthDrawer } from "@remcostoeten/auth-drawer";
import { authAdapter } from "@/lib/auth-adapter";

type TProps = {
  children: ReactNode;
};

export function AppAuthProvider({ children }: TProps) {
  return (
    <AuthProvider adapter={authAdapter}>
      {children}
      {/*
        Render the drawer once, inside the provider. We drive it from the
        header's "Sign in" button (useAuth().openDrawer), so hide the library's
        own floating trigger.
      */}
      <AuthDrawer adapter={authAdapter} hideTrigger />
    </AuthProvider>
  );
}
