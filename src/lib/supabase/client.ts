import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "../../types/database"
import { readSupabasePublicConfig } from "./public-config"

export function createClient() {
  const config = readSupabasePublicConfig()
  return createBrowserClient<Database>(config.supabaseUrl, config.publishableKey)
}
