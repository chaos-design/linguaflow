"use client"

import { ChevronDownIcon, TagsIcon } from "lucide-react"
import { Button } from "../../components/ui/button"
import { Checkbox } from "../../components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "../../components/ui/popover"
import type { LearningTag, VocabularyWord } from "../../types/learning"

export function ReviewTagFilter({
  availableTags,
  cards,
  idPrefix,
  selectedTagIds,
  onSelectedTagIdsChange,
}: {
  availableTags: LearningTag[]
  cards: VocabularyWord[]
  idPrefix: string
  selectedTagIds: readonly string[]
  onSelectedTagIdsChange: (tagIds: string[]) => void
}) {
  const selectedTagIdSet = new Set(selectedTagIds)
  const selectedTags = availableTags.filter((tag) => selectedTagIdSet.has(tag.id))
  const cardCountsByTag = new Map<string, number>()

  for (const card of cards) {
    for (const tagId of new Set(card.tags.map((tag) => tag.id))) {
      cardCountsByTag.set(tagId, (cardCountsByTag.get(tagId) ?? 0) + 1)
    }
  }

  const summary =
    selectedTags.length === 0
      ? "全部标签"
      : selectedTags.length === 1
        ? (selectedTags[0]?.name ?? "已选 1 个标签")
        : `已选 ${selectedTags.length} 个标签`

  function toggleTag(tagId: string, checked: boolean) {
    const nextTagIds = new Set(selectedTagIds)
    if (checked) {
      nextTagIds.add(tagId)
    } else {
      nextTagIds.delete(tagId)
    }
    onSelectedTagIdsChange(
      availableTags.filter((tag) => nextTagIds.has(tag.id)).map((tag) => tag.id),
    )
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-9 w-full justify-between py-2 sm:w-auto sm:min-w-52"
            aria-label="选择复习标签"
            disabled={availableTags.length === 0}
          />
        }
      >
        <TagsIcon data-icon="inline-start" aria-hidden="true" />
        <span className="min-w-0 flex-1 whitespace-normal break-words text-left">
          {availableTags.length === 0 ? "暂无可选标签" : summary}
        </span>
        <ChevronDownIcon data-icon="inline-end" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-2rem))]"
      >
        <PopoverHeader>
          <PopoverTitle>复习标签</PopoverTitle>
          <PopoverDescription>多选时复习匹配任一标签的生词</PopoverDescription>
        </PopoverHeader>
        <div className="max-h-64 overflow-y-auto rounded-md border">
          <div className="flex min-h-10 cursor-pointer items-center gap-3 border-b px-3 py-2 hover:bg-muted/50">
            <Checkbox
              id={`${idPrefix}-all`}
              checked={selectedTags.length === 0}
              onCheckedChange={() => onSelectedTagIdsChange([])}
            />
            <label
              htmlFor={`${idPrefix}-all`}
              className="min-w-0 flex-1 cursor-pointer break-words text-sm"
            >
              全部标签
            </label>
            <span className="font-mono text-xs text-muted-foreground">
              {cards.length}
            </span>
          </div>
          {availableTags.map((tag) => {
            const count = cardCountsByTag.get(tag.id) ?? 0
            const isSelected = selectedTagIdSet.has(tag.id)
            const checkboxId = `${idPrefix}-${tag.id}`
            return (
              <div
                key={tag.id}
                className="flex min-h-10 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50 has-disabled:cursor-not-allowed has-disabled:opacity-50"
              >
                <Checkbox
                  id={checkboxId}
                  checked={isSelected}
                  disabled={count === 0 && !isSelected}
                  onCheckedChange={(checked) => toggleTag(tag.id, checked)}
                />
                <label
                  htmlFor={checkboxId}
                  className="min-w-0 flex-1 cursor-pointer break-words text-sm"
                >
                  {tag.name}
                </label>
                <span className="font-mono text-xs text-muted-foreground">{count}</span>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
