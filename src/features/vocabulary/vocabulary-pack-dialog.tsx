"use client"

import { BookOpenIcon, CheckCircle2Icon, LibraryIcon } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { Checkbox } from "../../components/ui/checkbox"
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
  FieldGroup,
  FieldLabel,
} from "../../components/ui/field"
import { Input } from "../../components/ui/input"
import { Progress, ProgressLabel, ProgressValue } from "../../components/ui/progress"
import { Spinner } from "../../components/ui/spinner"
import { importVocabularyPackBatch } from "../../server/learning/actions"
import {
  type VocabularyPackId,
  vocabularyPackSummaries,
} from "../../shared/vocabulary-packs"
import type { VocabularyWord } from "../../types/learning"

interface VocabularyPackDialogProps {
  open: boolean
  availableSources: string[]
  onOpenChange: (open: boolean) => void
  onImported: (words: VocabularyWord[]) => void
}

interface PackProgress {
  processedCount: number
  insertedCount: number
  existingCount: number
  totalCount: number
  complete: boolean
}

export function VocabularyPackDialog({
  open,
  availableSources,
  onOpenChange,
  onImported,
}: VocabularyPackDialogProps) {
  const [selectedPackIds, setSelectedPackIds] = useState<Set<VocabularyPackId>>(
    () => new Set(vocabularyPackSummaries.map((pack) => pack.id)),
  )
  const [progressByPack, setProgressByPack] = useState<
    Partial<Record<VocabularyPackId, PackProgress>>
  >({})
  const [sourceTitle, setSourceTitle] = useState("")
  const [submitError, setSubmitError] = useState("")
  const [complete, setComplete] = useState(false)
  const [isPending, startTransition] = useTransition()
  const selectedPacks = useMemo(
    () => vocabularyPackSummaries.filter((pack) => selectedPackIds.has(pack.id)),
    [selectedPackIds],
  )
  const selectedItemCount = selectedPacks.reduce(
    (total, pack) => total + pack.itemCount,
    0,
  )
  const processedItemCount = Object.values(progressByPack).reduce(
    (total, progress) => total + (progress?.processedCount ?? 0),
    0,
  )

  function resetDialog() {
    setSelectedPackIds(new Set(vocabularyPackSummaries.map((pack) => pack.id)))
    setProgressByPack({})
    setSourceTitle("")
    setSubmitError("")
    setComplete(false)
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

  function togglePack(packId: VocabularyPackId) {
    if (isPending || complete) {
      return
    }
    setSelectedPackIds((current) => {
      const next = new Set(current)
      if (next.has(packId)) {
        next.delete(packId)
      } else {
        next.add(packId)
      }
      return next
    })
  }

  function startImport() {
    if (selectedPacks.length === 0) {
      toast.error("请至少选择一个词库。")
      return
    }
    setSubmitError("")
    setComplete(false)
    setProgressByPack({})
    const submittedSourceTitle = sourceTitle.trim()

    startTransition(async () => {
      let totalInserted = 0
      let totalExisting = 0
      for (const pack of selectedPacks) {
        let offset: number | null = 0
        while (offset !== null) {
          const result = await importVocabularyPackBatch({
            packId: pack.id,
            offset,
            sourceTitle: submittedSourceTitle,
          })
          if (!result.ok || !result.data) {
            setSubmitError(result.message)
            toast.error(result.message)
            return
          }

          const batch = result.data
          totalInserted += batch.insertedCount
          totalExisting += batch.existingCount
          onImported(batch.words)
          setProgressByPack((current) => {
            const previous = current[pack.id]
            return {
              ...current,
              [pack.id]: {
                processedCount: (previous?.processedCount ?? 0) + batch.processedCount,
                insertedCount: (previous?.insertedCount ?? 0) + batch.insertedCount,
                existingCount: (previous?.existingCount ?? 0) + batch.existingCount,
                totalCount: batch.totalCount,
                complete: batch.nextOffset === null,
              },
            }
          })
          offset = batch.nextOffset
        }
      }

      setComplete(true)
      toast.success(
        `词库导入完成：新增 ${totalInserted} 条，更新 ${totalExisting} 条已有词汇。`,
      )
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!isPending}
        className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <DialogHeader className="border-b p-4 pr-12">
          <DialogTitle>导入内置词库</DialogTitle>
          <DialogDescription>
            导入公开分级词表中的全部有效词条；已有词汇保留原来源，仅追加词库标签。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto p-4">
          <FieldGroup className="gap-0 divide-y rounded-md border">
            {vocabularyPackSummaries.map((pack) => {
              const progress = progressByPack[pack.id]
              const checked = selectedPackIds.has(pack.id)
              const percent = progress
                ? Math.round((progress.processedCount / progress.totalCount) * 100)
                : 0
              return (
                <Field
                  key={pack.id}
                  orientation="horizontal"
                  data-disabled={isPending || complete}
                  className="items-start gap-3 p-4 transition-colors hover:bg-muted/40 data-[disabled=true]:opacity-60"
                >
                  <Checkbox
                    id={`vocabulary-pack-${pack.id}`}
                    className="mt-1"
                    checked={checked}
                    disabled={isPending || complete}
                    onCheckedChange={() => togglePack(pack.id)}
                  />
                  <FieldLabel
                    htmlFor={`vocabulary-pack-${pack.id}`}
                    className="min-w-0 flex-1 cursor-pointer flex-col items-stretch gap-0 group-data-[disabled=true]/field:cursor-not-allowed"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{pack.shortLabel}</span>
                      <Badge variant="secondary">
                        {pack.itemCount.toLocaleString("zh-CN")} 条
                      </Badge>
                      {progress?.complete ? (
                        <CheckCircle2Icon
                          className="size-4 text-primary"
                          aria-label="已完成"
                        />
                      ) : null}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {pack.description}
                    </span>
                    {progress ? (
                      <Progress value={percent} className="mt-3 gap-2">
                        <ProgressLabel className="text-xs">
                          {progress.complete ? "已完成" : "正在导入"}
                        </ProgressLabel>
                        <ProgressValue className="text-xs">
                          {() =>
                            `${progress.processedCount.toLocaleString(
                              "zh-CN",
                            )} / ${progress.totalCount.toLocaleString("zh-CN")}`
                          }
                        </ProgressValue>
                      </Progress>
                    ) : null}
                  </FieldLabel>
                </Field>
              )
            })}
          </FieldGroup>

          <Field className="mt-4">
            <FieldLabel htmlFor="vocabulary-pack-source">词汇来源</FieldLabel>
            <Input
              id="vocabulary-pack-source"
              list="vocabulary-pack-source-options"
              value={sourceTitle}
              maxLength={200}
              autoComplete="off"
              placeholder="例如：雅思备考词表"
              disabled={isPending || complete}
              onChange={(event) => setSourceTitle(event.target.value)}
            />
            <datalist id="vocabulary-pack-source-options">
              {availableSources.map((source) => (
                <option key={source} value={source} />
              ))}
            </datalist>
            <FieldDescription>
              可选，应用到本次新导入的全部词条；留空时按所选内置词库分别记录。
            </FieldDescription>
          </Field>

          <Alert className="mt-4">
            <BookOpenIcon aria-hidden="true" />
            <AlertTitle>复习安排</AlertTitle>
            <AlertDescription>
              新词会依据设置中的每日新词上限错峰进入复习队列。所选词库共{" "}
              {selectedItemCount.toLocaleString("zh-CN")} 条，跨词库重复项会自动合并。
            </AlertDescription>
          </Alert>

          {submitError ? (
            <Alert variant="destructive" className="mt-4">
              <LibraryIcon aria-hidden="true" />
              <AlertTitle>导入中断</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter className="m-0 shrink-0 rounded-none px-4 py-3">
          {isPending ? (
            <span className="mr-auto text-sm text-muted-foreground" aria-live="polite">
              已处理 {processedItemCount.toLocaleString("zh-CN")} /{" "}
              {selectedItemCount.toLocaleString("zh-CN")}
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => handleOpenChange(false)}
          >
            {complete ? "完成" : "取消"}
          </Button>
          {!complete ? (
            <Button
              type="button"
              disabled={isPending || selectedPacks.length === 0}
              onClick={startImport}
            >
              {isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <LibraryIcon data-icon="inline-start" aria-hidden="true" />
              )}
              {isPending ? "正在导入" : "导入所选词库"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
