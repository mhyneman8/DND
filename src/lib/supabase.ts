import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const PUBLISHED_SITE_URL = "https://mhyneman8.github.io/DND/"

function readEnv(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

// Confirmation emails must land on the published app. A localhost redirect
// only works on the machine running the dev server, so signups from there
// still send people to the live site.
export function authRedirectUrl() {
  const configured = readEnv(import.meta.env.VITE_SITE_URL)
  if (configured) return configured
  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return new URL(import.meta.env.BASE_URL || "/", origin).href
    }
  }
  return PUBLISHED_SITE_URL
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
