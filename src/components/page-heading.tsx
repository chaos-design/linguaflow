import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

interface PageHeadingProps {
  eyebrow: string
  title: string
  description: string
  icon?: LucideIcon
  actions?: ReactNode
}

export function PageHeading({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
}: PageHeadingProps) {
  return (
    <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-mono text-[11px] font-medium text-muted-foreground">
          {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
          <span>{eyebrow}</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  )
}
