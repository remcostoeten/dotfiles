// auth-adapter.ts
// The single bridge between the AuthDrawer UI and Clerk.
// The Clerk client is the only integration point with the auth backend.
import { createClerkAdapter } from "@remcostoeten/auth-drawer/adapters/clerk";
import { clerkClient } from "./clerk-client";

export const authAdapter = createClerkAdapter({
  client: clerkClient,
  callbackURL: "/",
  // OAuth buttons are feature-detected from the adapter; declaring the
  // providers here surfaces the GitHub and Google buttons in the drawer.
  providers: ["github", "google"],
});
