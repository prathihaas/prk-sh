import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service role client — bypasses RLS.
// ONLY use in Server Actions / route handlers for admin operations.
// NEVER import this in Client Components.
//
// Instantiated lazily via a Proxy so that simply importing the module does
// not call createClient() at build-time. Next.js's "Collecting page data"
// step evaluates server modules during build; if env vars aren't injected
// at that stage, eager instantiation throws "supabaseUrl is required" and
// the whole build fails. With the lazy proxy, env vars only need to be
// present at request time — which is when service-role calls actually
// run anyway.

let cached: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY at runtime."
    );
  }
  cached = createClient(url, key);
  return cached;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
