// src/lib/auth-adapter.ts
//
// The adapter is the single bridge between the AuthDrawer UI and Supabase.
// It is plain (non-React) module code, so it can be imported from either
// client or server modules — but it is only ever *used* inside the
// client-side AuthProvider / AuthDrawer.

import { createSupabaseAdapter } from "@remcostoeten/auth-drawer/adapters/supabase";
import { supabase } from "@/lib/supabase";

export const authAdapter = createSupabaseAdapter({
  supabase,
  // Where Supabase redirects back to after an OAuth round-trip or a
  // password-reset email link. Adjust to your deployed origin / route.
  redirectTo:
    typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
  passwordResetRedirectTo:
    typeof window !== "undefined"
      ? `${window.location.origin}/reset-password`
      : undefined,
  // OAuth buttons only render if these providers are configured here AND
  // enabled in your Supabase project's Auth settings. Drop this line to
  // ship email/password only.
  providers: ["github", "google"],
});
