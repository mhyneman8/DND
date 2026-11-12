import { createClient, type SupabaseClient } from "@supabase/supabase-js"

function readEnv(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function createSupabase() {
  const url = readEnv(import.meta.env.VITE_SUPABASE_URL)
  const key = readEnv(import.meta.env.VITE_SUPABASE_ANON_KEY)
  if (!url || !key) return null
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

export const supabase: SupabaseClient | null = createSupabase()
