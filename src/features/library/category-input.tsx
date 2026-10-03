"use client"

import { CheckIcon, ChevronsUpDownIcon, FolderIcon } from "lucide-react"
import type { ComponentProps } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../../components/ui/input-group"
import type { LearningCategory } from "../../types/learning"

interface CategoryInputProps
  extends Omit<ComponentProps<typeof InputGroupInput>, "onChange" | "value"> {
  categories: LearningCategory[]
  value: string
  onValueChange: (value: string) => void
}

export function CategoryInput({
  categories,
  value,
  onValueChange,
  ...props
}: CategoryInputProps) {
  const normalizedValue = value.trim().toLocaleLowerCase("zh-CN")

  return (
    <InputGroup>
      <InputGroupInput
        value={value}
        autoComplete="off"
        onChange={(event) => onValueChange(event.target.value)}
        {...props}
      />
      <InputGroupAddon>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<InputGroupButton size="icon-sm" aria-label="选择已有分类" />}
          >
            <ChevronsUpDownIcon aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>已有分类</DropdownMenuLabel>
              {categories.length > 0 ? (
                categories.map((category) => {
                  const selected =
                    normalizedValue === category.name.toLocaleLowerCase("zh-CN")
                  return (
                    <DropdownMenuItem
                      key={category.id}
                      onClick={() => onValueChange(category.name)}
                    >
                      {selected ? (
                        <CheckIcon aria-hidden="true" />
                      ) : (
                        <FolderIcon aria-hidden="true" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{category.name}</span>
                    </DropdownMenuItem>
                  )
                })
              ) : (
                <DropdownMenuItem disabled>暂无分类，可直接输入新分类</DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </InputGroupAddon>
    </InputGroup>
  )
}
