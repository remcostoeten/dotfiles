// lib/auth-adapter.ts
//
// The adapter is the single bridge between the AuthDrawer UI and the auth
// backend. For Better Auth we use the prebuilt factory and hand it the existing
// client. It auto-detects providers from `client.options.socialProviders`
// (github + google here), wires signIn.email / signUp.email / useSession, and
// maps Better Auth error codes to AuthUiError. No manual feature toggling needed.

import { createBetterAuthAdapter } from "@remcostoeten/auth-drawer/adapters/better-auth";
import { authClient } from "@/lib/auth-client";

export const authAdapter = createBetterAuthAdapter({
  client: authClient,
  // callbackURL defaults to "/"; providers default to the client's configured
  // socialProviders (github, google), so we leave them implicit.
});
