/**
 * Shared Supabase admin client for Edge Functions.
 *
 * Uses the service-role key so functions can bypass RLS when writing
 * processing results back to the database.
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

let _client: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client initialised with the service-role key.
 *
 * Required env vars:
 *   SUPABASE_URL          — e.g. https://<ref>.supabase.co  (or Railway URL)
 *   SUPABASE_SERVICE_ROLE_KEY — full-access key, never exposed to clients
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client;

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error(
      "Missing required environment variables: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  _client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _client;
}
