import Link from "next/link"
import { cn } from "../lib/utils"

export function BrandMark() {
  return (
    <span className="brand-symbol" aria-hidden="true">
      <svg viewBox="0 0 28 28">
        <title>LinguaFlow 视频与字幕</title>
        <path
          d="M5.5 6.5h17v11h-9.25L8.5 21.5v-4h-3z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path d="m12 9.25 5.25 2.75L12 14.75z" fill="currentColor" />
      </svg>
    </span>
  )
}

export function Brand({
  compact = false,
  href = "/",
}: {
  compact?: boolean
  href?: string
}) {
  return (
    <Link
      className={cn("brand-mark", compact && "justify-center")}
      href={href}
      aria-label="LinguaFlow 首页"
    >
      <BrandMark />
      <span className={cn(compact && "sr-only")}>LinguaFlow</span>
    </Link>
  )
}
