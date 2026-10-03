"use client"

import { TagsIcon } from "lucide-react"
import { type FormEvent, useEffect, useMemo, useState } from "react"
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
import { Field, FieldGroup, FieldLabel } from "../../components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../../components/ui/input-group"
import { Spinner } from "../../components/ui/spinner"
import {
  maximumLearningTagCount,
  normalizeLearningTagNames,
} from "../../lib/learning-tags"
import { cn } from "../../lib/utils"
import type { LearningTag, VocabularyWord } from "../../types/learning"
import { VocabularyTagInput } from "./vocabulary-tag-input"

export function VocabularyTagBadges({
  tags,
  className,
}: {
  tags: LearningTag[]
  className?: string
}) {
  const visibleTags = tags.filter((tag) => !isVocabularyLevelTagName(tag.name))
  if (visibleTags.length === 0) {
    return null
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {visibleTags.map((tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className="h-auto max-w-full whitespace-normal break-all text-left"
        >
          {tag.name}
        </Badge>
      ))}
    </div>
  )
}

function isVocabularyLevelTagName(value: string): boolean {
  return /^(?:CEFR\s*)?(?:A1|A2|B1|B2|C1|C2)$/iu.test(value.trim())
}

export function VocabularyTagDialog({
  open,
  word,
  availableTags,
  isSaving,
  onOpenChange,
  onSave,
}: {
  open: boolean
  word: VocabularyWord | null
  availableTags: LearningTag[]
  isSaving: boolean
  onOpenChange: (open: boolean) => void
  onSave: (tagNames: string[]) => void
}) {
  const allTags = useMemo(() => {
    const tagsById = new Map(availableTags.map((tag) => [tag.id, tag]))
    for (const tag of word?.tags ?? []) {
      tagsById.set(tag.id, tag)
    }
    return Array.from(tagsById.values()).toSorted((left, right) =>
      left.name.localeCompare(right.name, "zh-CN"),
    )
  }, [availableTags, word])
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set())
  const [newTagNames, setNewTagNames] = useState("")

  useEffect(() => {
    if (!open) {
      return
    }
    setSelectedTagIds(new Set(word?.tags.map((tag) => tag.id) ?? []))
    setNewTagNames("")
  }, [open, word])

  const nextTagNames = normalizeLearningTagNames([
    ...allTags.filter((tag) => selectedTagIds.has(tag.id)).map((tag) => tag.name),
    newTagNames,
  ])
  const currentTagNames = normalizeLearningTagNames(
    word?.tags.map((tag) => tag.name) ?? [],
  )
  const hasChanges =
    nextTagNames
      .map((name) => name.toLocaleLowerCase("zh-CN"))
      .toSorted()
      .join("\n") !==
    currentTagNames
      .map((name) => name.toLocaleLowerCase("zh-CN"))
      .toSorted()
      .join("\n")

  function toggleTag(tagId: string, checked: boolean) {
    setSelectedTagIds((current) => {
      const next = new Set(current)
      if (checked) {
        next.add(tagId)
      } else {
        next.delete(tagId)
      }
      return next
    })
  }

  function saveTags(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (word && hasChanges) {
      onSave(nextTagNames)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSaving) {
          onOpenChange(nextOpen)
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form className="contents" onSubmit={saveTags}>
          <DialogHeader>
            <DialogTitle>编辑生词标签</DialogTitle>
            <DialogDescription>
              {word ? `“${word.word}”的标签将同步到当前账户。` : "选择生词标签。"}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="gap-4">
            {allTags.length > 0 ? (
              <Field>
                <FieldLabel>已有标签</FieldLabel>
                <FieldGroup className="max-h-52 gap-2 overflow-y-auto rounded-md border p-3">
                  {allTags.map((tag) => {
                    const checkboxId = `vocabulary-tag-${tag.id}`
                    return (
                      <Field key={tag.id} orientation="horizontal">
                        <Checkbox
                          id={checkboxId}
                          checked={selectedTagIds.has(tag.id)}
                          disabled={isSaving}
                          onCheckedChange={(checked) => toggleTag(tag.id, checked)}
                        />
                        <FieldLabel
                          htmlFor={checkboxId}
                          className="min-w-0 break-words"
                        >
                          {tag.name}
                        </FieldLabel>
                      </Field>
                    )
                  })}
                </FieldGroup>
              </Field>
            ) : null}

            <Field>
              <FieldLabel htmlFor="new-vocabulary-tags">新标签</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <TagsIcon aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupInput
                  id="new-vocabulary-tags"
                  value={newTagNames}
                  maxLength={maximumLearningTagCount * 42}
                  autoComplete="off"
                  placeholder="例如：商务英语，写作"
                  disabled={isSaving}
                  onChange={(event) => setNewTagNames(event.target.value)}
                />
              </InputGroup>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={!word || !hasChanges || isSaving}>
              {isSaving ? <Spinner data-icon="inline-start" /> : null}
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function VocabularyBatchTagDialog({
  open,
  selectedCount,
  availableTags,
  isSaving,
  onOpenChange,
  onSave,
}: {
  open: boolean
  selectedCount: number
  availableTags: LearningTag[]
  isSaving: boolean
  onOpenChange: (open: boolean) => void
  onSave: (tagNames: string[]) => void
}) {
  const [tagValue, setTagValue] = useState("")
  const tagNames = normalizeLearningTagNames(tagValue)

  useEffect(() => {
    if (open) {
      setTagValue("")
    }
  }, [open])

  function saveTags(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedCount > 0 && tagNames.length > 0) {
      onSave(tagNames)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSaving) {
          onOpenChange(nextOpen)
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form className="contents" onSubmit={saveTags}>
          <DialogHeader>
            <DialogTitle>批量添加标签</DialogTitle>
            <DialogDescription>
              将标签添加到已选的 {selectedCount} 个生词，原有标签会保留。
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="batch-vocabulary-tags">标签</FieldLabel>
              <VocabularyTagInput
                id="batch-vocabulary-tags"
                availableTags={availableTags}
                value={tagValue}
                disabled={isSaving}
                onValueChange={setTagValue}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={selectedCount === 0 || tagNames.length === 0 || isSaving}
            >
              {isSaving ? <Spinner data-icon="inline-start" /> : null}
              添加标签
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
