"use client"

import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileUpIcon,
  GitCompareArrowsIcon,
} from "lucide-react"
import dynamic from "next/dynamic"
import {
  type ChangeEvent,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "../../components/ui/field"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet"
import { Spinner } from "../../components/ui/spinner"
import {
  compareSubtitleCues,
  formatSubtitleTimestamp,
  type ParsedSubtitleCue,
  parseSubtitleDocument,
  parseSubtitleFile,
  type SubtitleCueDiff,
  type SubtitleCueDiffStatus,
  type SubtitleSourceFormat,
} from "../../lib/subtitles"
import { cn } from "../../lib/utils"
import {
  importVideoTranscript,
  readVideoTranscript,
} from "../../server/learning/actions"
import type { TranscriptCue } from "../../types/learning"

const maximumSubtitleLength = 2_000_000
const differencesPerPage = 100

const SubtitleCodeEditor = dynamic(
  () => import("./subtitle-code-editor").then((module) => module.SubtitleCodeEditor),
  {
    ssr: false,
    loading: () => (
      <div
        className="grid h-[min(48svh,34rem)] min-h-72 place-items-center rounded-md border bg-muted/30"
        role="status"
      >
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          正在加载编辑器
        </span>
      </div>
    ),
  },
)

const subtitleFormatLabels: Record<SubtitleSourceFormat, string> = {
  srt: "SRT",
  webvtt: "WebVTT",
  json: "JSON",
  tabular: "表格文本",
  unknown: "未知格式",
}

const diffLabels: Record<Exclude<SubtitleCueDiffStatus, "unchanged">, string> = {
  added: "新增",
  changed: "修改",
  removed: "删除",
}

export function SubtitleImportSheet({
  open,
  videoId,
  videoTitle,
  currentCueCount,
  onOpenChange,
  onImported,
}: {
  open: boolean
  videoId: string
  videoTitle: string
  currentCueCount: number
  onOpenChange: (open: boolean) => void
  onImported?: (cues: TranscriptCue[]) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<"edit" | "compare">("edit")
  const [content, setContent] = useState("")
  const [originalContent, setOriginalContent] = useState("")
  const [fileName, setFileName] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(false)
  const [differencePage, setDifferencePage] = useState(0)
  const [isPending, startTransition] = useTransition()
  const deferredContent = useDeferredValue(content)
  const hasCurrentTranscript = currentCueCount > 0

  useEffect(() => {
    if (!open) {
      return
    }

    let active = true
    setStep("edit")
    setFileName(null)
    setLoadError(null)
    setDifferencePage(0)

    if (!hasCurrentTranscript) {
      setOriginalContent("")
      setContent("")
      setIsLoadingCurrent(false)
      return () => {
        active = false
      }
    }

    setIsLoadingCurrent(true)
    void readVideoTranscript(videoId).then((result) => {
      if (!active) {
        return
      }
      setIsLoadingCurrent(false)
      if (!result.ok || !result.data) {
        setOriginalContent("")
        setContent("")
        setLoadError(result.message)
        return
      }
      setOriginalContent(result.data.content)
      setContent(result.data.content)
    })

    return () => {
      active = false
    }
  }, [hasCurrentTranscript, open, videoId])

  const originalCues = useMemo(
    () => parseSubtitleFile(originalContent),
    [originalContent],
  )
  const incomingDocument = useMemo(
    () => parseSubtitleDocument(deferredContent),
    [deferredContent],
  )
  const incomingCues = incomingDocument.cues
  const differences = useMemo(
    () => compareSubtitleCues(originalCues, incomingCues),
    [incomingCues, originalCues],
  )
  const changedDifferences = differences.filter(
    (difference) => difference.status !== "unchanged",
  )
  const summary = summarizeDifferences(differences)
  const pageCount = Math.max(
    1,
    Math.ceil(changedDifferences.length / differencesPerPage),
  )
  const visibleDifferences = changedDifferences.slice(
    differencePage * differencesPerPage,
    (differencePage + 1) * differencesPerPage,
  )
  const isParsing = content !== deferredContent
  const contentError = getContentError(content, incomingCues.length)
  const canContinue =
    !isLoadingCurrent &&
    !loadError &&
    !isParsing &&
    !contentError &&
    incomingCues.length > 0

  function selectSubtitleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ""
    if (!file) {
      return
    }
    if (file.size > maximumSubtitleLength) {
      toast.error("字幕文件不能超过 2MB。")
      return
    }

    void file
      .text()
      .then((nextContent) => {
        const parsedDocument = parseSubtitleDocument(nextContent)
        const cueCount = parsedDocument.cues.length
        if (cueCount === 0) {
          toast.error("没有从文件中解析出有效时间轴。")
          return
        }
        setContent(nextContent)
        setFileName(file.name)
        setStep("edit")
        toast.success(
          `已识别为 ${subtitleFormatLabels[parsedDocument.format]}，共 ${cueCount} 条字幕。`,
        )
      })
      .catch(() => {
        toast.error("字幕文件读取失败，请重新选择。")
      })
  }

  function continueImport() {
    if (!canContinue) {
      toast.error(contentError ?? "字幕仍在解析，请稍后重试。")
      return
    }
    if (hasCurrentTranscript) {
      if (changedDifferences.length === 0) {
        toast.info("字幕内容与当前版本一致。")
        return
      }
      setDifferencePage(0)
      setStep("compare")
      return
    }
    applyImport()
  }

  function applyImport() {
    startTransition(async () => {
      const result = await importVideoTranscript({ videoId, content })
      if (!result.ok || !result.data) {
        toast.error(result.message)
        return
      }
      onImported?.(result.data.cues)
      toast.success(
        hasCurrentTranscript
          ? `字幕已更新，共 ${result.data.cueCount} 条。`
          : result.message,
      )
      onOpenChange(false)
    })
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) {
          onOpenChange(nextOpen)
        }
      }}
    >
      <SheetContent className="w-full! gap-0 overflow-hidden sm:max-w-2xl! lg:max-w-3xl!">
        <SheetHeader className="border-b pr-12">
          <div className="flex flex-wrap items-center gap-2">
            {step === "compare" ? (
              <GitCompareArrowsIcon className="size-4 text-info-foreground" />
            ) : (
              <FileUpIcon className="size-4 text-info-foreground" />
            )}
            <SheetTitle>
              {step === "compare"
                ? "核对字幕更新"
                : hasCurrentTranscript
                  ? "更新字幕"
                  : "导入字幕"}
            </SheetTitle>
            {hasCurrentTranscript ? (
              <Badge variant="outline">{currentCueCount} 条当前字幕</Badge>
            ) : null}
          </div>
          <SheetDescription className="truncate">{videoTitle}</SheetDescription>
        </SheetHeader>

        {step === "edit" ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {loadError ? (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>当前字幕读取失败</AlertTitle>
                <AlertDescription>{loadError}</AlertDescription>
              </Alert>
            ) : null}

            <FieldGroup>
              <Field>
                <FieldLabel>字幕文件</FieldLabel>
                <button
                  type="button"
                  className="flex min-h-20 w-full items-center gap-3 rounded-md border border-dashed border-info/50 bg-info/8 p-4 text-left transition-colors hover:border-info hover:bg-info/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isLoadingCurrent || isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-info/15 text-info-foreground">
                    <FileUpIcon aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {fileName ?? "选择字幕或表格数据文件"}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      支持 SRT、WebVTT、JSON、CSV、TSV 和 TXT，最大 2MB
                    </span>
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".srt,.vtt,.json,.csv,.tsv,.txt,text/vtt,application/x-subrip,application/json,text/csv,text/tab-separated-values,text/plain"
                  className="sr-only"
                  aria-label="选择字幕文件"
                  onChange={selectSubtitleFile}
                />
              </Field>

              <Field data-invalid={Boolean(contentError) && Boolean(content)}>
                <div className="flex items-end justify-between gap-3">
                  <FieldLabel id={`subtitle-content-label-${videoId}`}>
                    字幕内容
                  </FieldLabel>
                  <span
                    className={cn(
                      "text-xs tabular-nums text-muted-foreground",
                      content.length > maximumSubtitleLength && "text-destructive",
                    )}
                  >
                    {content.length.toLocaleString()} /{" "}
                    {maximumSubtitleLength.toLocaleString()}
                  </span>
                </div>
                <SubtitleCodeEditor
                  id={`subtitle-content-${videoId}`}
                  labelId={`subtitle-content-label-${videoId}`}
                  value={content}
                  disabled={isLoadingCurrent || isPending}
                  invalid={Boolean(contentError) && Boolean(content)}
                  onChange={(nextContent) => {
                    setContent(nextContent)
                    setFileName(null)
                  }}
                />
                <FieldDescription>
                  {isLoadingCurrent
                    ? "正在读取当前字幕..."
                    : isParsing
                      ? "正在解析时间轴..."
                      : contentError && content
                        ? contentError
                        : `${subtitleFormatLabels[incomingDocument.format]} · ${incomingCues.length} 条有效时间轴`}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </div>
        ) : (
          <SubtitleDifferences
            summary={summary}
            differences={visibleDifferences}
            page={differencePage}
            pageCount={pageCount}
            onPageChange={setDifferencePage}
          />
        )}

        <SheetFooter className="border-t bg-popover">
          {step === "compare" ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setStep("edit")}
              >
                <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
                返回编辑
              </Button>
              <Button type="button" disabled={isPending} onClick={applyImport}>
                {isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <CheckIcon data-icon="inline-start" aria-hidden="true" />
                )}
                应用 {changedDifferences.length} 项变更
              </Button>
            </div>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button
                type="button"
                disabled={!canContinue || isPending}
                onClick={continueImport}
              >
                {isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : hasCurrentTranscript ? (
                  <GitCompareArrowsIcon data-icon="inline-start" aria-hidden="true" />
                ) : (
                  <FileUpIcon data-icon="inline-start" aria-hidden="true" />
                )}
                {hasCurrentTranscript
                  ? `对比 ${incomingCues.length} 条字幕`
                  : `导入 ${incomingCues.length || ""} 条字幕`}
              </Button>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function SubtitleDifferences({
  summary,
  differences,
  page,
  pageCount,
  onPageChange,
}: {
  summary: Record<SubtitleCueDiffStatus, number>
  differences: Array<SubtitleCueDiff>
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap gap-2 border-b bg-muted/30 px-4 py-3">
        <DiffSummaryBadge status="added" count={summary.added} />
        <DiffSummaryBadge status="changed" count={summary.changed} />
        <DiffSummaryBadge status="removed" count={summary.removed} />
        <Badge variant="outline">{summary.unchanged} 条未变化</Badge>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <ul className="flex list-none flex-col gap-2" aria-label="字幕时间轴差异">
          {differences.map((difference) => (
            <SubtitleDifferenceRow key={difference.key} difference={difference} />
          ))}
        </ul>
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3 border-t px-4 py-2">
          <span className="text-xs text-muted-foreground">
            第 {page + 1} / {pageCount} 页
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => onPageChange(Math.max(0, page - 1))}
            >
              <ChevronLeftIcon data-icon="inline-start" aria-hidden="true" />
              上一页
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pageCount - 1}
              onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
            >
              下一页
              <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SubtitleDifferenceRow({ difference }: { difference: SubtitleCueDiff }) {
  if (difference.status === "unchanged") {
    return null
  }
  const cue = difference.incoming ?? difference.original
  if (!cue) {
    return null
  }

  return (
    <li
      className={cn(
        "overflow-hidden rounded-md border",
        difference.status === "added" && "border-success/50",
        difference.status === "changed" && "border-info/50",
        difference.status === "removed" && "border-destructive/40",
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/35 px-3 py-2">
        <span className="font-mono text-xs font-medium text-foreground">
          {formatSubtitleTimestamp(cue.startSeconds)}
        </span>
        <DiffSummaryBadge status={difference.status} count={1} compact />
      </header>
      <div
        className={cn(
          "grid",
          difference.status === "changed" && "md:grid-cols-2 md:divide-x",
        )}
      >
        {difference.original ? (
          <SubtitleCueVersion
            label={difference.status === "changed" ? "当前" : "将删除"}
            cue={difference.original}
            tone="removed"
          />
        ) : null}
        {difference.incoming ? (
          <SubtitleCueVersion
            label={difference.status === "changed" ? "更新后" : "将新增"}
            cue={difference.incoming}
            tone={difference.status}
          />
        ) : null}
      </div>
    </li>
  )
}

function SubtitleCueVersion({
  label,
  cue,
  tone,
}: {
  label: string
  cue: ParsedSubtitleCue
  tone: Exclude<SubtitleCueDiffStatus, "unchanged">
}) {
  return (
    <div
      className={cn(
        "min-w-0 p-3",
        tone === "added" && "bg-success/8",
        tone === "changed" && "bg-info/8",
        tone === "removed" && "bg-destructive/5",
      )}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="font-mono text-muted-foreground">
          {formatSubtitleTimestamp(cue.startSeconds)} -{" "}
          {formatSubtitleTimestamp(cue.endSeconds)}
        </span>
      </div>
      <p className="text-sm leading-relaxed font-medium text-foreground">{cue.text}</p>
      {cue.translation ? (
        <p className="mt-1 text-xs leading-relaxed text-info-foreground">
          {cue.translation}
        </p>
      ) : null}
    </div>
  )
}

function DiffSummaryBadge({
  status,
  count,
  compact = false,
}: {
  status: Exclude<SubtitleCueDiffStatus, "unchanged">
  count: number
  compact?: boolean
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "added" && "border-success/50 bg-success/15 text-foreground",
        status === "changed" && "border-info/50 bg-info/15 text-info-foreground",
        status === "removed" &&
          "border-destructive/40 bg-destructive/8 text-destructive",
      )}
    >
      {compact ? diffLabels[status] : `${diffLabels[status]} ${count} 条`}
    </Badge>
  )
}

function summarizeDifferences(
  differences: Array<SubtitleCueDiff>,
): Record<SubtitleCueDiffStatus, number> {
  const summary: Record<SubtitleCueDiffStatus, number> = {
    added: 0,
    changed: 0,
    removed: 0,
    unchanged: 0,
  }
  for (const difference of differences) {
    summary[difference.status] += 1
  }
  return summary
}

function getContentError(content: string, cueCount: number): string | null {
  if (!content.trim()) {
    return "字幕内容不能为空。"
  }
  if (content.length > maximumSubtitleLength) {
    return "字幕内容不能超过 2MB。"
  }
  if (cueCount === 0) {
    return "没有解析出有效时间轴，请检查字幕、JSON 或表格格式。"
  }
  return null
}
