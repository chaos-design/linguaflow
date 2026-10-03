import { CaptionsIcon, NotebookPenIcon, PlayIcon } from "lucide-react"
import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { BrandMark } from "../../components/brand"
import { LoginForm } from "../../features/auth/login-form"
import { getOptionalAuthUser } from "../../server/auth/auth-user"
import { getEmailConfirmationFeedback } from "../../server/auth/email-confirmation"
import { sanitizeRedirectPath } from "../../server/auth/redirect-path"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "登录",
  description: "登录 LinguaFlow 视频学习助手。",
}

interface LoginPageProps {
  searchParams: Promise<{
    next?: string | string[]
    error?: string | string[]
    confirmation?: string | string[]
    mode?: string | string[]
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [query, user] = await Promise.all([searchParams, getOptionalAuthUser()])
  const rawNext = Array.isArray(query.next) ? query.next[0] : query.next
  const nextPath = sanitizeRedirectPath(rawNext)
  const errorCode = Array.isArray(query.error) ? query.error[0] : query.error
  const confirmationStatus = Array.isArray(query.confirmation)
    ? query.confirmation[0]
    : query.confirmation
  const requestedMode = Array.isArray(query.mode) ? query.mode[0] : query.mode
  const initialMode = requestedMode === "register" ? "register" : "password"
  const confirmationFeedback = getEmailConfirmationFeedback(confirmationStatus)
  const routeError =
    errorCode === "recovery-link"
      ? "重设密码链接无效或已过期，请重新获取。"
      : errorCode === "callback"
        ? "验证链接无效或已过期，请重新登录。"
        : ""

  if (user) {
    redirect(nextPath)
  }

  return (
    <main className="auth-shell auth-login-shell">
      <div className="auth-login-grid" aria-hidden="true" />

      <Link className="brand-mark auth-login-brand" href="/">
        <BrandMark />
        <span>LinguaFlow</span>
      </Link>

      <section className="auth-login-layout">
        <div className="auth-login-story">
          <div className="auth-story-copy">
            <span>FOCUSED VIDEO LEARNING</span>
            <h1>
              继续观看，
              <em>也继续积累。</em>
            </h1>
            <p>你的进度、字幕笔记和生词都在这里，登录后从上次停下的位置继续。</p>
          </div>

          <div className="auth-learning-scene" aria-hidden="true">
            <div className="auth-signal-ring" />
            <div className="auth-player-card">
              <Image
                src="/images/linguaflow-course-cover.jpg"
                alt=""
                fill
                priority
                sizes="560px"
                className="object-cover"
              />
              <span className="auth-player-control">
                <PlayIcon />
              </span>
              <footer>
                <span>
                  <i />
                </span>
                <small>18:42 / 38:24</small>
              </footer>
            </div>
            <div className="auth-note-card">
              <span>
                <NotebookPenIcon />
                NOTE / 18:42
              </span>
              <p>反馈不是结果，而是下一轮学习的输入。</p>
            </div>
            <div className="auth-caption-card">
              <CaptionsIcon />
              <span>SUBTITLES SYNCED</span>
            </div>
            <div className="auth-scan-line" />
          </div>

          <div className="auth-story-facts">
            <span>VIDEO + SUBTITLES</span>
            <span>PROGRESS SYNC</span>
            <span>PRIVATE NOTES</span>
          </div>
        </div>

        <section className="auth-entry" aria-label="登录账户">
          <LoginForm
            key={initialMode}
            nextPath={nextPath}
            initialError={confirmationFeedback?.error || routeError}
            initialMessage={confirmationFeedback?.message}
            initialMode={initialMode}
          />
        </section>
      </section>

      <Link className="auth-login-back" href="/">
        返回首页
      </Link>
    </main>
  )
}
