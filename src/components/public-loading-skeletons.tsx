import { Skeleton } from "./ui/skeleton"

const fieldKeys = ["one", "two"]
const legalSectionKeys = ["one", "two", "three", "four", "five"]

function DarkSkeleton({ className }: { className: string }) {
  return (
    <Skeleton className={`[background:var(--landing-surface-raised)] ${className}`} />
  )
}

function AuthFormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className="flex flex-col gap-5">
      {fieldKeys.slice(0, fields).map((key) => (
        <div key={key} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-3 w-36" />
        </div>
      ))}
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

export function LandingPageSkeleton() {
  return (
    <main className="home-shell" aria-busy="true" aria-label="正在加载首页">
      <div className="home-grid" aria-hidden="true" />
      <nav className="home-nav" aria-hidden="true">
        <DarkSkeleton className="h-9 w-36" />
        <DarkSkeleton className="h-4 w-72" />
        <DarkSkeleton className="h-10 w-32" />
      </nav>
      <section className="home-hero">
        <DarkSkeleton className="absolute inset-0 size-full rounded-none" />
        <div className="home-hero-shade" />
        <div className="home-hero-content">
          <DarkSkeleton className="h-4 w-64" />
          <DarkSkeleton className="mt-6 h-7 w-64" />
          <DarkSkeleton className="mt-6 h-24 w-full max-w-3xl" />
          <DarkSkeleton className="mt-6 h-5 w-full max-w-2xl" />
          <div className="mt-7 flex gap-3">
            <DarkSkeleton className="h-12 w-36" />
            <DarkSkeleton className="h-12 w-36" />
          </div>
          <div className="mt-7 flex flex-wrap gap-5">
            {["one", "two", "three"].map((key) => (
              <DarkSkeleton key={key} className="h-4 w-40" />
            ))}
          </div>
        </div>
      </section>
      <section className="home-metrics">
        {["source", "one", "two", "three"].map((key) => (
          <DarkSkeleton key={key} className="h-28 w-full rounded-none" />
        ))}
      </section>
    </main>
  )
}

export function LoginPageSkeleton() {
  return (
    <main
      className="auth-shell auth-login-shell"
      aria-busy="true"
      aria-label="正在加载登录页"
    >
      <div className="auth-login-grid" aria-hidden="true" />
      <DarkSkeleton className="auth-login-brand h-10 w-40" />
      <section className="auth-login-layout">
        <div className="auth-login-story">
          <div className="auth-story-copy">
            <DarkSkeleton className="h-3 w-48" />
            <DarkSkeleton className="h-32 w-full max-w-xl" />
            <DarkSkeleton className="h-12 w-full max-w-lg" />
          </div>
          <div className="auth-learning-scene">
            <DarkSkeleton className="absolute inset-6 rounded-md" />
          </div>
          <div className="auth-story-facts">
            {["one", "two", "three"].map((key) => (
              <DarkSkeleton key={key} className="h-3 w-28" />
            ))}
          </div>
        </div>
        <section className="auth-entry">
          <header className="login-card-header">
            <DarkSkeleton className="h-3 w-40" />
            <DarkSkeleton className="h-8 w-32" />
            <DarkSkeleton className="h-4 w-full" />
          </header>
          <div className="auth-panel">
            <div className="flex flex-col gap-5">
              {fieldKeys.map((key) => (
                <div key={key} className="flex flex-col gap-2">
                  <DarkSkeleton className="h-4 w-20" />
                  <DarkSkeleton className="h-10 w-full" />
                  <DarkSkeleton className="h-3 w-36" />
                </div>
              ))}
              <DarkSkeleton className="h-10 w-full" />
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}

export function CompactAuthPageSkeleton({ fields = 1 }: { fields?: number }) {
  return (
    <main
      className="auth-shell auth-shell-compact"
      aria-busy="true"
      aria-label="正在加载账户页面"
    >
      <header className="auth-header">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-4 w-20" />
      </header>
      <section className="auth-card auth-card-centered">
        <Skeleton className="h-3 w-28" />
        <header className="flex flex-col gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </header>
        <AuthFormSkeleton fields={fields} />
      </section>
    </main>
  )
}

export function LegalPageSkeleton() {
  return (
    <main
      className="page-shell legal-page"
      aria-busy="true"
      aria-label="正在加载法律文档"
    >
      <header className="site-header">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-4 w-20" />
      </header>
      <article className="legal-document">
        <header className="legal-document-header">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-5 w-full max-w-xl" />
          <Skeleton className="h-3 w-28" />
        </header>
        <Skeleton className="h-24 w-full" />
        <div className="legal-sections">
          {legalSectionKeys.map((key) => (
            <section key={key} className="flex flex-col gap-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
            </section>
          ))}
        </div>
      </article>
    </main>
  )
}
