// auth-adapter.ts
//
// The single integration point between AuthDrawer's UI and NextAuth (Auth.js).
//
// The NextAuth adapter expects a `client` that exposes `signIn`, `signOut`, and
// `useSession`. The `next-auth/react` module provides exactly those named
// exports, so we pass the module namespace straight through as the client.

import { createNextAuthAdapter } from "@remcostoeten/auth-drawer/adapters/next-auth";
import { signIn, signOut, useSession } from "next-auth/react";

export const authAdapter = createNextAuthAdapter({
  client: { signIn, signOut, useSession },
  callbackURL: "/",
  // OAuth buttons only appear because the adapter implements signInWithOAuth.
  // List the providers you've configured in your NextAuth options here.
  providers: ["github", "google"],
});
