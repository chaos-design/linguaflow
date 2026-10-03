"use client"

import {
  ArrowRightIcon,
  BarChart3Icon,
  BookMarkedIcon,
  CaptionsIcon,
  CirclePlayIcon,
  LayersIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  ListVideoIcon,
  SearchIcon,
  SettingsIcon,
  UploadIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "./ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./ui/command"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"

interface SearchEntry {
  label: string
  description: string
  href: string
  icon: typeof SearchIcon
  keywords: string
}

const pageEntries: SearchEntry[] = [
  {
    label: "学习概览",
    description: "继续观看、学习数据与最近资源",
    href: "/workspace",
    icon: LayoutDashboardIcon,
    keywords: "首页 仪表盘 dashboard overview",
  },
  {
    label: "导入视频",
    description: "解析链接、公开字幕与本地视频",
    href: "/workspace/import",
    icon: UploadIcon,
    keywords: "本地 文件 链接 字幕 import local",
  },
  {
    label: "视频资源库",
    description: "查看、筛选和管理全部视频",
    href: "/workspace/library",
    icon: LibraryIcon,
    keywords: "视频 标签 分类 字幕 library",
  },
  {
    label: "播放列表",
    description: "按课程和目标组织视频",
    href: "/workspace/playlists",
    icon: ListVideoIcon,
    keywords: "合集 课程 路径 playlist",
  },
  {
    label: "生词本",
    description: "查看收藏词汇与掌握状态",
    href: "/workspace/vocabulary",
    icon: BookMarkedIcon,
    keywords: "单词 词汇 vocabulary",
  },
  {
    label: "复习闪卡",
    description: "开始到期词汇的间隔复习",
    href: "/workspace/review",
    icon: LayersIcon,
    keywords: "卡片 记忆 sm2 review",
  },
  {
    label: "学习统计",
    description: "查看时长、进度和学习趋势",
    href: "/workspace/stats",
    icon: BarChart3Icon,
    keywords: "数据 图表 趋势 stats",
  },
  {
    label: "设置",
    description: "调整字幕、复习和同步偏好",
    href: "/workspace/settings",
    icon: SettingsIcon,
    keywords: "配置 偏好 主题 settings",
  },
]

const actionEntries: SearchEntry[] = [
  {
    label: "批量导入视频",
    description: "一次解析最多 50 个视频链接",
    href: "/workspace/import/batch",
    icon: UploadIcon,
    keywords: "批量 链接 batch import",
  },
  {
    label: "继续学习",
    description: "筛选所有正在学习的视频",
    href: "/workspace/library?status=in-progress",
    icon: CirclePlayIcon,
    keywords: "播放 进度 继续观看 resume",
  },
  {
    label: "查找待补字幕视频",
    description: "筛选尚未导入字幕的资源",
    href: "/workspace/library?captions=without-captions",
    icon: CaptionsIcon,
    keywords: "字幕 srt vtt caption",
  },
  {
    label: "开始词汇复习",
    description: "打开今天到期的复习队列",
    href: "/workspace/review",
    icon: LayersIcon,
    keywords: "单词 闪卡 到期 review",
  },
]

export function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim()

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key.toLocaleLowerCase("en") === "k" &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  function navigate(href: string) {
    setOpen(false)
    setQuery("")
    router.push(href)
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setQuery("")
    }
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="bg-muted/60 text-muted-foreground hover:bg-muted sm:w-full sm:justify-start sm:px-2.5 sm:font-normal"
              aria-label="打开全局搜索"
              aria-keyshortcuts="Meta+K Control+K"
              onClick={() => setOpen(true)}
            />
          }
        >
          <SearchIcon aria-hidden="true" />
          <span className="hidden min-w-0 flex-1 truncate text-left sm:block">
            搜索页面、功能与资源
          </span>
          <kbd className="hidden rounded bg-background px-1.5 py-0.5 font-mono text-[10px] leading-none md:inline-flex">
            ⌘ K
          </kbd>
        </TooltipTrigger>
        <TooltipContent className="sm:hidden">全局搜索</TooltipContent>
      </Tooltip>

      <CommandDialog open={open} onOpenChange={handleOpenChange}>
        <Command>
          <CommandInput
            value={query}
            placeholder="搜索页面、功能或视频关键词..."
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>没有匹配的页面或功能</CommandEmpty>

            {normalizedQuery ? (
              <>
                <CommandGroup heading="资源搜索">
                  <CommandItem
                    value={`在资源库搜索 ${normalizedQuery}`}
                    onSelect={() =>
                      navigate(
                        `/workspace/library?q=${encodeURIComponent(normalizedQuery)}`,
                      )
                    }
                  >
                    <SearchIcon aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        搜索“{normalizedQuery}”
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        在视频标题、简介、分类和标签中查找
                      </span>
                    </span>
                    <CommandShortcut>
                      <ArrowRightIcon className="size-3.5" aria-hidden="true" />
                    </CommandShortcut>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            ) : null}

            <SearchEntryGroup
              heading="页面"
              entries={pageEntries}
              onNavigate={navigate}
            />
            <CommandSeparator />
            <SearchEntryGroup
              heading="快捷功能"
              entries={actionEntries}
              onNavigate={navigate}
            />
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}

function SearchEntryGroup({
  heading,
  entries,
  onNavigate,
}: {
  heading: string
  entries: SearchEntry[]
  onNavigate: (href: string) => void
}) {
  return (
    <CommandGroup heading={heading}>
      {entries.map((entry) => {
        const Icon = entry.icon
        return (
          <CommandItem
            key={`${heading}-${entry.label}`}
            value={`${entry.label} ${entry.description} ${entry.keywords}`}
            onSelect={() => onNavigate(entry.href)}
          >
            <Icon aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{entry.label}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {entry.description}
              </span>
            </span>
            <CommandShortcut>
              <ArrowRightIcon className="size-3.5" aria-hidden="true" />
            </CommandShortcut>
          </CommandItem>
        )
      })}
    </CommandGroup>
  )
}
