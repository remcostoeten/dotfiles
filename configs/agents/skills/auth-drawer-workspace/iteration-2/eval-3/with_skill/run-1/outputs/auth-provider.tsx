// components/auth-provider.tsx
//
// AuthProvider, AuthDrawer, and useAuth are all client-side, so this lives
// behind a "use client" boundary. The provider calls adapter.useSession() once
// and exposes session + drawer controls via context to every consumer below it.
//
// We render <AuthDrawer> here too (inside the provider). hideTrigger is set
// because the navbar drives the drawer via useAuth().openDrawer(), so we don't
// want the library's default floating trigger button.

"use client";

import { AuthProvider, AuthDrawer } from "@remcostoeten/auth-drawer";
import { authAdapter } from "@/lib/auth-adapter";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider adapter={authAdapter}>
      {children}
      <AuthDrawer
        adapter={authAdapter}
        hideTrigger
        config={{
          ui: {
            auth: {
              providers: ["github", "google"],
              allowRegister: true,
            },
          },
        }}
      />
    </AuthProvider>
  );
}
