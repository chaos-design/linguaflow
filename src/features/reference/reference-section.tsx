import type { ReactNode } from "react"

export function ReferenceSection({
  index,
  title,
  description,
  children,
}: {
  index: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{index}</span>
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}
