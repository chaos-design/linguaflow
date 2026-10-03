import { cache } from "react"
import { createClient } from "../../lib/supabase/server"

export interface AuthUser {
  id: string
  email: string
}

async function queryOptionalAuthUser(): Promise<AuthUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user?.email) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
  }
}

export const getOptionalAuthUser = cache(queryOptionalAuthUser)
