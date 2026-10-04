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

/**
 * GitHub 品牌图标。lucide v1 起移除了全部品牌图标，不提供 GithubIcon，
 * 因此按官方 simple-icons 路径内联，作为唯一的品牌标识例外。
 */
export function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.15c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.26 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z"
      />
    </svg>
  )
}
