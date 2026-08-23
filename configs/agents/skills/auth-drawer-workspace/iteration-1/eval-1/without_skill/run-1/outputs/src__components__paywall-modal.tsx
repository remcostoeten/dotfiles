// src/components/paywall-modal.tsx
//
// The paywall itself. Renders @remcostoeten/auth-drawer in MODAL mode with
// NO social/OAuth providers, wired to our custom JWT adapter. It reads its
// open/close state from the AuthProvider so any trigger (the scroll hook,
// a "Sign in" button, etc.) can drive it.

import { AuthDrawer } from "@remcostoeten/auth-drawer";
import "@remcostoeten/auth-drawer/styles.css";
import { useAuth } from "../lib/auth/auth-context";
import { jwtAuthAdapter, type TUser } from "../lib/auth/jwt-adapter";

export function PaywallModal() {
  const { isPaywallOpen, closePaywall, setUser } = useAuth();

  return (
    <AuthDrawer
      // Render as a centered modal/dialog rather than a side drawer.
      variant="modal"
      // Controlled open state.
      open={isPaywallOpen}
      onOpenChange={(open: boolean) => {
        if (!open) closePaywall();
      }}
      // Hand the drawer our JWT backend handlers.
      adapter={jwtAuthAdapter}
      // No social login buttons at all — only email/password.
      providers={[]}
      socialProviders={[]}
      showSocial={false}
      // Copy tuned for a paywall.
      title="Keep reading"
      description="Create a free account or sign in to read the full article."
      // The drawer calls this once a sign in / sign up resolves successfully.
      onAuthSuccess={(user: TUser) => {
        setUser(user);
        closePaywall();
      }}
    />
  );
}
