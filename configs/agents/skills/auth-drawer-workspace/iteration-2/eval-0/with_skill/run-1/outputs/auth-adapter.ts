// src/lib/auth-adapter.ts
//
// The single bridge between the auth-drawer UI and Supabase.
// It is constructed from the existing browser Supabase client.
import { createSupabaseAdapter } from "@remcostoeten/auth-drawer/adapters/supabase";
import { supabase } from "@/lib/supabase";

export const authAdapter = createSupabaseAdapter({
  supabase,
  // Where OAuth / email confirmation links return to.
  redirectTo:
    typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
});
