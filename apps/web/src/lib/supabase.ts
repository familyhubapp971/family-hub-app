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

// Don't throw at module init when env vars are missing: a hard throw here
// crashes the entire React tree, breaking unrelated pages (landing, /hello)
// in CI environments that build the bundle without auth secrets. Instead,
// log a warning and fall back to placeholder values; the actual auth.* calls
// will fail with a clear network error if invoked, which is the correct
// behaviour for a misconfigured deploy. Real auth flows in CI need
// VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY set as GH Actions secrets.
if (!url || !anonKey) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing — ' +
      'auth calls will fail. Set both at build time (Vite reads VITE_* env at build).',
  );
}

export const supabase: SupabaseClient = createClient(
  url || 'https://placeholder.invalid',
  anonKey || 'placeholder-anon-key',
  {
    auth: {
      // detectSessionInUrl is needed so /auth/callback can extract the
      // session from the OAuth fragment Supabase appends to redirectTo.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
