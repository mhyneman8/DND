import { LocalRepository } from "./local-repository.ts"
import type { Repository } from "./repository.ts"
import { supabase } from "./supabase.ts"
import { SupabaseRepository } from "./supabase-repository.ts"

export function createRepository(): Repository {
  if (supabase) return new SupabaseRepository(supabase)
  return new LocalRepository()
}
