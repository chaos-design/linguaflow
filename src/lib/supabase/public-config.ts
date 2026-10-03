interface SupabasePublicConfig {
  supabaseUrl: string
  publishableKey: string
}

export function readSupabasePublicConfig(): SupabasePublicConfig {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!supabaseUrl) {
    throw new Error("缺少公共 Supabase 配置：NEXT_PUBLIC_SUPABASE_URL")
  }
  if (!publishableKey) {
    throw new Error("缺少公共 Supabase 配置：NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ""),
    publishableKey,
  }
}
