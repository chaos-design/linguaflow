import type { Metadata } from "next"
import Link from "next/link"
import { Brand } from "../../components/brand"
import { ForgotPasswordForm } from "../../features/auth/forgot-password-form"
import { sanitizeRedirectPath } from "../../server/auth/redirect-path"

export const metadata: Metadata = {
  title: "找回密码",
  description: "通过邮箱重设账户密码。",
}

interface ForgotPasswordPageProps {
  searchParams: Promise<{ next?: string | string[] }>
}

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const query = await searchParams
  const rawNext = Array.isArray(query.next) ? query.next[0] : query.next
  const nextPath = sanitizeRedirectPath(rawNext)

  return (
    <main className="auth-shell auth-shell-compact">
      <header className="auth-header">
        <Brand />
        <Link
          className="text-link"
          href={`/login?next=${encodeURIComponent(nextPath)}`}
        >
          返回登录
        </Link>
      </header>

      <section className="auth-card auth-card-centered">
        <span className="card-index">RECOVERY / 01</span>
        <header>
          <h1>找回密码</h1>
          <p>输入账户邮箱，我们会发送一次性重设链接。</p>
        </header>
        <ForgotPasswordForm nextPath={nextPath} />
      </section>
    </main>
  )
}
