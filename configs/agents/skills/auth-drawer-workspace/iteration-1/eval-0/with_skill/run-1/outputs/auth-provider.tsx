// src/components/auth-provider.tsx
//
// Client boundary that wraps the whole app. AuthProvider, AuthDrawer and
// useAuth are all client-side, so this file carries the "use client"
// directive and gets dropped into the root layout (a Server Component).
//
// AuthProvider calls adapter.useSession() once and exposes the session +
// drawer controls through context to everything beneath it. We render
// <AuthDrawer> here too so a single mounted surface is available app-wide.

"use client";

import type { ReactNode } from "react";
import { AuthProvider as AuthDrawerProvider, AuthDrawer } from "@remcostoeten/auth-drawer";
import { authAdapter } from "@/lib/auth-adapter";

type TProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: TProps) {
  return (
    <AuthDrawerProvider adapter={authAdapter}>
      {children}

      {/*
        Single app-wide auth surface. hideTrigger removes the package's
        built-in floating button — we drive opening from our own header
        "Sign in" button via useAuth().openDrawer() instead.
      */}
      <AuthDrawer
        adapter={authAdapter}
        hideTrigger
        config={{
          ui: {
            auth: {
              providers: ["github", "google"],
              allowRegister: true,
            },
            presentation: { variant: "drawer" },
          },
        }}
      />
    </AuthDrawerProvider>
  );
}
