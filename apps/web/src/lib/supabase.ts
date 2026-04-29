import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Singleton browser client. Initialised once per page load. Picks up env
// from Vite's import.meta.env — only the publishable / anon key is shipped
// to the bundle (NEVER service_role; see ADR 0008 + .env.example notes).
//
// Database type generation lands with FHS-192 (the user-mirror sync); for
// now we use the unparameterised generic so the file compiles before any
// schema exists. When generated types are committed at
// `packages/shared/src/db-types.ts` (or similar), tighten via:
//   createClient<Database>(...)

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loudly at import time. The web bundle cannot function without
  // these; missing values almost always mean Railway env vars weren't
  // propagated to the build (see FHS-189). Throwing here surfaces the
  // problem on first page load instead of a confusing "auth doesn't
  // work" symptom three pages deep.
  throw new Error(
    '[supabase] missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — ' +
      'check apps/web build env (Vite reads VITE_* at build time, not runtime).',
  );
}

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: {
    // detectSessionInUrl is needed so /auth/callback can extract the
    // session from the OAuth fragment Supabase appends to redirectTo.
    // persistSession + autoRefreshToken use Supabase defaults
    // (localStorage + auto-refresh) per the FHS-190 ticket description.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
