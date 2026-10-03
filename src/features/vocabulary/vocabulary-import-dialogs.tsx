"use client"

import {
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileUpIcon,
  Trash2Icon,
} from "lucide-react"
import dynamic from "next/dynamic"
import { useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "../../components/ui/field"
import { Skeleton } from "../../components/ui/skeleton"
import { Spinner } from "../../components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table"
import { normalizeLearningTagNames } from "../../lib/learning-tags"
import { cn } from "../../lib/utils"
import {
  createVocabularyImportTemplate,
  maximumVocabularyImportFileSize,
  parseVocabularyImportText,
  serializeVocabularyImportItems,
} from "../../lib/vocabulary-import"
import { maximumVocabularyTermWords } from "../../lib/vocabulary-term"
import { importVocabularyWords } from "../../server/learning/actions"
import type {
  LearningTag,
  VocabularyImportResult,
  VocabularyWord,
} from "../../types/learning"
import { VocabularyTagInput } from "./vocabulary-tag-input"

const VocabularyImportEditor = dynamic(
  () =>
    import("./vocabulary-import-editor").then(
      (module) => module.VocabularyImportEditor,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-80 min-h-64 w-full sm:h-96" />,
  },
)

interface VocabularyImportDialogProps {
  open: boolean
  availableTags: LearningTag[]
  onOpenChange: (open: boolean) => void
  onImported: (words: VocabularyWord[]) => void
}

export function VocabularyBatchImportDialog({
  open,
  availableTags,
  onOpenChange,
  onImported,
}: VocabularyImportDialogProps) {
  const [source, setSource] = useState("")
  const [tagValue, setTagValue] = useState("")
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileError, setFileError] = useState("")
  const [submitError, setSubmitError] = useState("")
  const [lastResult, setLastResult] = useState<VocabularyImportResult | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const parsed = useMemo(() => parseVocabularyImportText(source), [source])
  const hasParseErrors = parsed.errors.length > 0
  const parseSummary = source
    ? `共读取 ${parsed.rowCount} 项，识别 ${parsed.items.length} 个唯一词条${
        parsed.duplicateCount > 0 ? `，已合并 ${parsed.duplicateCount} 个重复项` : ""
      }`
    : "使用中英文逗号或换行分隔单词、词组或短语。"

  function resetDialog() {
    setSource("")
    setTagValue("")
    setFileName(null)
    setFileError("")
    setSubmitError("")
    setLastResult(null)
    setIsDragging(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isPending) {
      return
    }
    if (!nextOpen) {
      resetDialog()
    }
    onOpenChange(nextOpen)
  }

  async function readFile(file: File | undefined) {
    if (!file) {
      return
    }
    const extension = file.name.split(".").at(-1)?.toLocaleLowerCase("en")
    if (!extension || !["csv", "tsv", "txt"].includes(extension)) {
      setFileError("请选择 CSV、TSV 或 TXT 文件。")
      return
    }
    if (file.size > maximumVocabularyImportFileSize) {
      setFileError("文件不能超过 250 KB。")
      return
    }
    try {
      const nextSource = await file.text()
      setSource(nextSource)
      setFileName(file.name)
      setFileError("")
      setSubmitError("")
      setLastResult(null)
    } catch {
      setFileError("文件读取失败，请重新选择。")
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  function updateSource(nextSource: string) {
    setSource(nextSource)
    setFileName(null)
    setFileError("")
    setSubmitError("")
    setLastResult(null)
  }

  function downloadTemplate() {
    const blob = new Blob([`\uFEFF${createVocabularyImportTemplate()}`], {
      type: "text/csv;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "linguaflow-vocabulary-import.csv"
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  function submit() {
    if (hasParseErrors) {
      toast.error("请先修正无法识别的内容。")
      return
    }
    if (parsed.items.length === 0) {
      toast.error("请先输入要导入的词条。")
      return
    }
    const submittedItems = parsed.items
    setSubmitError("")
    setLastResult(null)
    startTransition(async () => {
      const result = await importVocabularyWords({
        items: submittedItems,
        source: "batch",
        tagNames: normalizeLearningTagNames(tagValue),
      })
      if (!result.data) {
        setSubmitError(result.message)
        toast.error(result.message)
        return
      }
      if (result.data.words.length > 0) {
        onImported(result.data.words)
      }
      if (result.data.failures.length > 0) {
        const failedWords = new Set(
          result.data.failures.map((failure) => failure.word.toLocaleLowerCase("en")),
        )
        const retryItems = submittedItems.filter((item) =>
          failedWords.has(item.word.toLocaleLowerCase("en")),
        )
        if (retryItems.length > 0) {
          setSource(serializeVocabularyImportItems(retryItems))
        }
        setFileName(null)
        setLastResult(result.data)
        toast.warning(result.message)
        return
      }
      toast.success(result.message)
      resetDialog()
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!isPending}
        className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-6xl"
      >
        <DialogHeader className="border-b p-4 pr-12">
          <DialogTitle>导入生词</DialogTitle>
          <DialogDescription>
            支持单词、词组和最多 {maximumVocabularyTermWords}{" "}
            个英文单词组成的短语，导入时自动查询词典。使用中英文逗号或换行分隔；带表头的
            CSV、TSV 文件也可直接导入。
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4">
          <Field data-invalid={Boolean(fileError)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FieldLabel htmlFor="vocabulary-import-file">数据文件</FieldLabel>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={downloadTemplate}
              >
                <DownloadIcon data-icon="inline-start" aria-hidden="true" />
                下载模板
              </Button>
            </div>
            <button
              type="button"
              className={cn(
                "flex min-h-20 w-full items-center gap-3 rounded-md border border-dashed border-input bg-background p-4 text-left transition-colors",
                "hover:border-ring hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                isDragging && "border-ring bg-muted/50",
                fileError && "border-destructive",
              )}
              disabled={isPending}
              aria-invalid={Boolean(fileError)}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setIsDragging(false)
                void readFile(event.dataTransfer.files[0])
              }}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-foreground">
                {fileName ? (
                  <FileTextIcon aria-hidden="true" />
                ) : (
                  <FileUpIcon aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {fileName ?? "选择或拖入生词文件"}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  CSV、TSV 或 TXT，最大 250 KB
                </span>
              </span>
            </button>
            <input
              ref={fileInputRef}
              id="vocabulary-import-file"
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
              className="sr-only"
              aria-label="选择生词文件"
              onChange={(event) => void readFile(event.target.files?.[0])}
            />
            <FieldError>{fileError}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="vocabulary-import-tags">标签</FieldLabel>
            <VocabularyTagInput
              id="vocabulary-import-tags"
              availableTags={availableTags}
              value={tagValue}
              disabled={isPending}
              onValueChange={setTagValue}
            />
            <FieldDescription>应用到本次新导入的全部词条。</FieldDescription>
          </Field>

          <div className="grid min-h-0 gap-4 md:grid-cols-[minmax(0,3fr)_minmax(15rem,2fr)] md:items-start">
            <Field data-invalid={hasParseErrors}>
              <div className="flex items-end justify-between gap-3">
                <FieldLabel id="vocabulary-import-text-label">词条内容</FieldLabel>
                {source ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => updateSource("")}
                  >
                    <Trash2Icon data-icon="inline-start" aria-hidden="true" />
                    清空
                  </Button>
                ) : null}
              </div>
              <VocabularyImportEditor
                id="vocabulary-import-text"
                labelId="vocabulary-import-text-label"
                value={source}
                disabled={isPending}
                invalid={hasParseErrors}
                onChange={updateSource}
              />
              <FieldDescription aria-live="polite">{parseSummary}</FieldDescription>
            </Field>

            <section
              aria-labelledby="vocabulary-import-preview-title"
              className="min-w-0"
            >
              <div className="mb-2 flex min-h-8 flex-wrap items-center justify-between gap-2">
                <h3
                  id="vocabulary-import-preview-title"
                  className="text-sm font-medium"
                >
                  导入预览
                </h3>
                <div className="flex items-center gap-2" aria-live="polite">
                  <Badge variant="secondary">{parsed.items.length} 个可导入</Badge>
                  {parsed.duplicateCount > 0 ? (
                    <Badge variant="outline">{parsed.duplicateCount} 个重复项</Badge>
                  ) : null}
                </div>
              </div>
              {parsed.items.length > 0 ? (
                <div className="h-80 overflow-y-auto overscroll-contain rounded-md border sm:h-96">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-popover">
                      <TableRow>
                        <TableHead>词条</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>
                          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 md:grid-cols-2 xl:grid-cols-3">
                            {parsed.items.map((item) => (
                              <li
                                key={item.word}
                                className="min-w-0 whitespace-normal font-medium break-words"
                              >
                                {item.word}
                              </li>
                            ))}
                          </ul>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="grid h-80 place-items-center rounded-md border border-dashed px-4 text-center text-sm text-muted-foreground sm:h-96">
                  输入单词、词组或短语后将在这里显示识别结果
                </div>
              )}
            </section>
          </div>

          {hasParseErrors ? (
            <Alert variant="destructive">
              <FileSpreadsheetIcon aria-hidden="true" />
              <AlertTitle>请修正以下内容</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 list-disc pl-4">
                  {parsed.errors.slice(0, 5).map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
                {parsed.errors.length > 5 ? (
                  <p className="mt-1">另有 {parsed.errors.length - 5} 项错误。</p>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          {submitError ? (
            <Alert variant="destructive">
              <FileUpIcon aria-hidden="true" />
              <AlertTitle>导入失败</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}

          {lastResult ? (
            <Alert>
              <FileSpreadsheetIcon aria-hidden="true" />
              <AlertTitle>已完成部分导入</AlertTitle>
              <AlertDescription>
                已导入 {lastResult.words.length} 个，跳过 {lastResult.skipped.length}{" "}
                个，剩余 {lastResult.failures.length} 个待处理。
                <ul className="mt-1 list-disc pl-4">
                  {lastResult.failures.slice(0, 5).map((failure) => (
                    <li key={`${failure.word}-${failure.message}`}>
                      {failure.word}：{failure.message}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter className="m-0 shrink-0 rounded-none px-4 py-3">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => handleOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            disabled={isPending || hasParseErrors || parsed.items.length === 0}
            onClick={submit}
          >
            {isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <FileUpIcon data-icon="inline-start" aria-hidden="true" />
            )}
            导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
