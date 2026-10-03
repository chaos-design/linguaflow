import type { Metadata } from "next"
import { Brand } from "../../components/brand"
import { ResetPasswordForm } from "../../features/auth/reset-password-form"
import { sanitizeRedirectPath } from "../../server/auth/redirect-path"

export const metadata: Metadata = {
  title: "重设密码",
  description: "为账户设置新密码。",
}

interface ResetPasswordPageProps {
  searchParams: Promise<{ next?: string | string[] }>
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const query = await searchParams
  const rawNext = Array.isArray(query.next) ? query.next[0] : query.next
  const nextPath = sanitizeRedirectPath(rawNext)

  return (
    <main className="auth-shell auth-shell-compact">
      <header className="auth-header">
        <Brand />
      </header>

      <section className="auth-card auth-card-centered">
        <span className="card-index">RECOVERY / 02</span>
        <header>
          <h1>设置新密码</h1>
          <p>密码更新后会直接进入原目标页面。</p>
        </header>
        <ResetPasswordForm nextPath={nextPath} />
      </section>
    </main>
  )
}
