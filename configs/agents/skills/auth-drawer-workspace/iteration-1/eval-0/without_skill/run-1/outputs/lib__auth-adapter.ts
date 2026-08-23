// Intended path: src/lib/auth-adapter.ts (or @/lib/auth-adapter)
//
// Wires the @remcostoeten/auth-drawer Supabase adapter to our existing
// browser Supabase client. The adapter is what the drawer/provider uses
// to perform sign in / sign up / sign out and to read the session.

import { createSupabaseAdapter } from "@remcostoeten/auth-drawer/adapters/supabase";
import { supabase } from "@/lib/supabase";

export const authAdapter = createSupabaseAdapter({ client: supabase });
