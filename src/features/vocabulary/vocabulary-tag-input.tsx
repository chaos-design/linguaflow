"use client"

import { ChevronsUpDownIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../../components/ui/input-group"
import {
  maximumLearningTagCount,
  normalizeLearningTagNames,
} from "../../lib/learning-tags"
import type { LearningTag } from "../../types/learning"

export function VocabularyTagInput({
  id,
  availableTags,
  value,
  disabled = false,
  onValueChange,
}: {
  id: string
  availableTags: LearningTag[]
  value: string
  disabled?: boolean
  onValueChange: (value: string) => void
}) {
  const selectedNames = normalizeLearningTagNames(value)
  const selectedKeys = new Set(
    selectedNames.map((name) => name.toLocaleLowerCase("zh-CN")),
  )

  function toggleTag(tagName: string, checked: boolean) {
    const tagKey = tagName.toLocaleLowerCase("zh-CN")
    const nextNames = checked
      ? normalizeLearningTagNames([...selectedNames, tagName])
      : selectedNames.filter((name) => name.toLocaleLowerCase("zh-CN") !== tagKey)
    onValueChange(nextNames.join("，"))
  }

  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        value={value}
        maxLength={maximumLearningTagCount * 42}
        autoComplete="off"
        placeholder="选择已有标签或输入新标签"
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <InputGroupAddon>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <InputGroupButton
                size="icon-sm"
                aria-label="选择已有生词标签"
                disabled={disabled}
              />
            }
          >
            <ChevronsUpDownIcon aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>已有标签</DropdownMenuLabel>
              {availableTags.length > 0 ? (
                availableTags.map((tag) => (
                  <DropdownMenuCheckboxItem
                    key={tag.id}
                    checked={selectedKeys.has(tag.name.toLocaleLowerCase("zh-CN"))}
                    onCheckedChange={(checked) => toggleTag(tag.name, checked)}
                  >
                    <span className="min-w-0 whitespace-normal break-words">
                      {tag.name}
                    </span>
                  </DropdownMenuCheckboxItem>
                ))
              ) : (
                <DropdownMenuCheckboxItem disabled>
                  暂无已有标签
                </DropdownMenuCheckboxItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </InputGroupAddon>
    </InputGroup>
  )
}
