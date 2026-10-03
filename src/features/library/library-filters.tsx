"use client"

import { FilterXIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { type FormEvent, useState, useTransition } from "react"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../../components/ui/input-group"
import { Spinner } from "../../components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip"

interface LibraryFiltersProps {
  categories: string[]
  tags: string[]
  initialQuery: string
  initialCategory: string
  initialTag: string
  initialStatus: string
  initialSource: string
  initialCaptions: string
}

const statusItems = [
  { label: "全部进度", value: "all" },
  { label: "未开始", value: "not-started" },
  { label: "学习中", value: "in-progress" },
  { label: "已完成", value: "completed" },
]

const sourceItems = [
  { label: "全部来源", value: "all" },
  { label: "链接导入", value: "link" },
  { label: "本地文件", value: "local" },
  { label: "历史私有上传", value: "upload" },
]

const captionItems = [
  { label: "全部字幕", value: "all" },
  { label: "已有字幕", value: "with-captions" },
  { label: "待补字幕", value: "without-captions" },
]

interface FilterValues {
  category: string
  tag: string
  status: string
  source: string
  captions: string
}

export function LibraryFilters({
  categories,
  tags,
  initialQuery,
  initialCategory,
  initialTag,
  initialStatus,
  initialSource,
  initialCaptions,
}: LibraryFiltersProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState(initialQuery)
  const [category, setCategory] = useState(initialCategory || "all")
  const [tag, setTag] = useState(initialTag || "all")
  const [status, setStatus] = useState(initialStatus || "all")
  const [source, setSource] = useState(initialSource || "all")
  const [captions, setCaptions] = useState(initialCaptions || "all")
  const categoryItems = [
    { label: "全部分类", value: "all" },
    ...categories.map((name) => ({ label: name, value: name })),
  ]
  const tagItems = [
    { label: "全部标签", value: "all" },
    ...tags.map((name) => ({ label: name, value: name })),
  ]
  const filters = { category, tag, status, source, captions }
  const activeFilterCount = Object.values(filters).filter(
    (value) => value !== "all",
  ).length

  function navigate(nextFilters: FilterValues, nextQuery = query) {
    const searchParams = new URLSearchParams()
    if (nextQuery.trim()) {
      searchParams.set("q", nextQuery.trim())
    }
    for (const [key, value] of [
      ["category", nextFilters.category],
      ["tag", nextFilters.tag],
      ["status", nextFilters.status],
      ["source", nextFilters.source],
      ["captions", nextFilters.captions],
    ]) {
      if (value !== "all") {
        searchParams.set(key, value)
      }
    }
    const search = searchParams.toString()
    startTransition(() => {
      router.push(search ? `/workspace/library?${search}` : "/workspace/library")
    })
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate(filters)
  }

  function updateFilter(key: keyof FilterValues, value: string) {
    const nextFilters = { ...filters, [key]: value }
    if (key === "category") {
      setCategory(value)
    } else if (key === "tag") {
      setTag(value)
    } else if (key === "status") {
      setStatus(value)
    } else if (key === "source") {
      setSource(value)
    } else {
      setCaptions(value)
    }
    navigate(nextFilters)
  }

  function resetFilters() {
    setQuery("")
    setCategory("all")
    setTag("all")
    setStatus("all")
    setSource("all")
    setCaptions("all")
    startTransition(() => router.push("/workspace/library"))
  }

  return (
    <search className="block w-full min-w-0">
      <form className="flex w-full min-w-0 items-center gap-2" onSubmit={applyFilters}>
        <InputGroup className="h-9 min-w-0 flex-1">
          <InputGroupInput
            aria-label="搜索视频资源"
            placeholder="搜索标题、简介或标签"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
        </InputGroup>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                type="button"
                className="shrink-0"
                disabled={isPending}
              />
            }
          >
            {isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <SlidersHorizontalIcon data-icon="inline-start" aria-hidden="true" />
            )}
            筛选
            {activeFilterCount > 0 ? (
              <Badge variant="secondary">{activeFilterCount}</Badge>
            ) : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel>筛选资源</DropdownMenuLabel>
              <LibraryFilterSubmenu
                label="分类"
                items={categoryItems}
                value={category}
                onValueChange={(value) => updateFilter("category", value)}
              />
              <LibraryFilterSubmenu
                label="标签"
                items={tagItems}
                value={tag}
                onValueChange={(value) => updateFilter("tag", value)}
              />
              <LibraryFilterSubmenu
                label="学习进度"
                items={statusItems}
                value={status}
                onValueChange={(value) => updateFilter("status", value)}
              />
              <LibraryFilterSubmenu
                label="视频来源"
                items={sourceItems}
                value={source}
                onValueChange={(value) => updateFilter("source", value)}
              />
              <LibraryFilterSubmenu
                label="字幕状态"
                items={captionItems}
                value={captions}
                onValueChange={(value) => updateFilter("captions", value)}
              />
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {query || activeFilterCount > 0 ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="重置资源筛选"
                  disabled={isPending}
                  onClick={resetFilters}
                />
              }
            >
              <FilterXIcon aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>重置筛选</TooltipContent>
          </Tooltip>
        ) : null}
      </form>
    </search>
  )
}

function LibraryFilterSubmenu({
  label,
  items,
  value,
  onValueChange,
}: {
  label: string
  items: Array<{ label: string; value: string }>
  value: string
  onValueChange: (value: string) => void
}) {
  const selectedLabel = items.find((item) => item.value === value)?.label
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="grid w-full grid-cols-[minmax(0,1fr)_7rem_auto]">
        <span className="min-w-0">{label}</span>
        <span className="truncate text-left text-xs text-muted-foreground">
          {selectedLabel}
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
            {items.map((item) => (
              <DropdownMenuRadioItem key={item.value} value={item.value}>
                {item.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
