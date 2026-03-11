import { createClient } from "@supabase/supabase-js";

// Service role client — bypasses RLS.
// ONLY use in Server Actions for admin operations (e.g. creating users).
// NEVER import this in Client Components.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
