import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "../../types/database"
import { readSupabasePublicConfig } from "./public-config"

export async function createClient() {
  const config = readSupabasePublicConfig()
  const cookieStore = await cookies()

  return createServerClient<Database>(config.supabaseUrl, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Middleware refreshes cookies when this runs inside a Server Component.
        }
      },
    },
  })
}
