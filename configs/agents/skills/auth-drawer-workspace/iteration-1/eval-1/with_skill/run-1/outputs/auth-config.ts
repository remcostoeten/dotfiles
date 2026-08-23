// src/auth/auth-config.ts
//
// Declarative config for the auth surface: how it looks + what auto-opens it.
// No auth logic lives here.

import type { AuthConfig } from "@remcostoeten/auth-drawer";

// Open when the reader scrolls ~1/3 down the article.
export const SCROLL_THRESHOLD = 0.33;

export const authConfig: AuthConfig = {
  ui: {
    auth: {
      // Hard "no social login" guarantee. Combined with the adapter omitting
      // signInWithOAuth, the OAuth button group + divider never render.
      providers: [],
      // Login + register only (register tab appears because the adapter
      // implements signUp via the /register endpoint).
      allowRegister: true,
      initialMode: "login",
      showRememberMe: true,
      // We did not wire a password-reset endpoint, so keep the link hidden.
      showForgotPassword: false,
    },
    presentation: {
      // MODAL, not a drawer.
      variant: "modal",
    },
  },
  triggers: {
    // Auto-open once when scroll progress crosses ~1/3 of the article.
    // The actual emit is done by useScrollOpenTrigger in article-paywall.tsx;
    // the policy (threshold/once) lives here so the store enforces it.
    scrollOpen: {
      threshold: SCROLL_THRESHOLD,
      once: true,
      container: "self",
    },
  },
};
