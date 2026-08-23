// Intended path: src/lib/supabase.ts (or @/lib/supabase)
//
// This is the existing browser Supabase client the app already exports.
// Shown here for completeness so the integration is self-contained.
// If you already have this file, keep yours — do NOT overwrite it.

import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
