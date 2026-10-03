"use client"

import { toast } from "sonner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { type EnglishAccent, speakEnglish } from "@/lib/english-speech"
import { cn } from "@/lib/utils"

const accentItems: Array<{
  accent: EnglishAccent
  label: string
  shortLabel: string
}> = [
  { accent: "uk", label: "英式", shortLabel: "英" },
  { accent: "us", label: "美式", shortLabel: "美" },
]

export function EnglishPronunciation({
  className,
  phoneticUk,
  phoneticUs,
  text,
}: {
  className?: string
  phoneticUk: string
  phoneticUs: string
  text: string
}) {
  function pronounce(accent: EnglishAccent) {
    void speakEnglish(text, accent).then((spoken) => {
      if (!spoken) {
        toast.error("当前浏览器不支持语音朗读。")
      }
    })
  }

  return (
    <div
      className={cn(
        "flex max-w-full flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-xs leading-snug text-muted-foreground",
        className,
      )}
    >
      {accentItems.map((item) => {
        const phonetic = item.accent === "uk" ? phoneticUk : phoneticUs
        return (
          <Tooltip key={item.accent}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="inline-flex min-w-0 items-center gap-1 rounded-sm py-1 text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  aria-label={`使用${item.label}发音朗读 ${text}`}
                  onClick={() => pronounce(item.accent)}
                />
              }
            >
              <span className="shrink-0 font-sans text-foreground">
                {item.shortLabel}
              </span>
              <span className="break-all">{phonetic || "发音"}</span>
            </TooltipTrigger>
            <TooltipContent>点击播放{item.label}发音</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
