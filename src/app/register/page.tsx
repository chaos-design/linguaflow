import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { sanitizeRedirectPath } from "../../server/auth/redirect-path"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "注册",
  description: "前往登录页创建账户。",
}

interface RegisterPageProps {
  searchParams: Promise<{ next?: string | string[] }>
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const query = await searchParams
  const rawNext = Array.isArray(query.next) ? query.next[0] : query.next
  const nextPath = sanitizeRedirectPath(rawNext)

  redirect(`/login?mode=register&next=${encodeURIComponent(nextPath)}`)
}
