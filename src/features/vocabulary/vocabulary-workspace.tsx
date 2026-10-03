"use client"

import {
  BookMarkedIcon,
  BookPlusIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  CheckSquareIcon,
  CircleDotIcon,
  ClapperboardIcon,
  FileUpIcon,
  FilterXIcon,
  LayersIcon,
  LibraryIcon,
  type LucideIcon,
  PanelRightOpenIcon,
  PlayIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  TagsIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { EnglishPronunciation } from "../../components/english-pronunciation-buttons"
import { PageHeading } from "../../components/page-heading"
import { Badge } from "../../components/ui/badge"
import { Button, buttonVariants } from "../../components/ui/button"
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
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
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../../components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../../components/ui/input-group"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../../components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select"
import { Spinner } from "../../components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip"
import { VocabularyTermHighlight } from "../../components/vocabulary-term-highlight"
import { formatDuration } from "../../lib/format"
import { cn } from "../../lib/utils"
import {
  getVocabularyContextItems,
  getVocabularyDefinitionLines,
  type VocabularyContextItem,
} from "../../lib/vocabulary-display"
import { getVocabularySourceValues } from "../../lib/vocabulary-sources"
import {
  addTagsToVocabularyWords,
  cleanVocabularyData,
  deleteVocabularyWord,
  deleteVocabularyWords,
  generateVocabularyAiAnalysis,
  readVocabularyWordDetail,
  setVocabularyWordTags,
} from "../../server/learning/actions"
import {
  defaultAiModelConfig,
  readStoredAiModelConfig,
} from "../../shared/ai-model-config"
import type {
  LearningTag,
  VocabularyMastery,
  VocabularyWord,
} from "../../types/learning"
import { VocabularyBatchImportDialog } from "./vocabulary-import-dialogs"
import { VocabularyPackDialog } from "./vocabulary-pack-dialog"
import {
  VocabularyBatchTagDialog,
  VocabularyTagBadges,
  VocabularyTagDialog,
} from "./vocabulary-tag-dialog"
import { WordDetailSheet } from "./word-detail-sheet"

const masteryItems = [
  { value: "new", label: "新词" },
  { value: "learning", label: "学习中" },
  { value: "mastered", label: "已掌握" },
] satisfies Array<{ value: VocabularyMastery; label: string }>

const dateItems = [
  { value: "all", label: "全部时间" },
  { value: "today", label: "今天加入" },
  { value: "7d", label: "最近 7 天" },
  { value: "30d", label: "最近 30 天" },
]

const sortItems = [
  { value: "added-desc", label: "最近加入" },
  { value: "due-asc", label: "复习到期" },
  { value: "word-asc", label: "字母顺序" },
]
const pageSizeItems = [20, 50, 100].map((value) => ({
  label: `${value} 条`,
  value: String(value),
}))

const masteryLabels: Record<VocabularyMastery, string> = {
  new: "新词",
  learning: "学习中",
  mastered: "已掌握",
}

function mergeVocabularyWord(
  current: VocabularyWord[],
  nextWord: VocabularyWord,
): VocabularyWord[] {
  const exists = current.some((word) => word.id === nextWord.id)
  return exists
    ? current.map((word) => (word.id === nextWord.id ? nextWord : word))
    : [nextWord, ...current]
}

function mergeVocabularyWords(
  current: VocabularyWord[],
  nextWords: VocabularyWord[],
): VocabularyWord[] {
  const nextIds = new Set(nextWords.map((word) => word.id))
  return [...nextWords, ...current.filter((word) => !nextIds.has(word.id))]
}

function mergeLearningTags(
  current: LearningTag[],
  additions: LearningTag[],
): LearningTag[] {
  const tagsById = new Map(current.map((tag) => [tag.id, tag]))
  for (const tag of additions) {
    if (!tagsById.has(tag.id)) {
      tagsById.set(tag.id, tag)
    }
  }
  return Array.from(tagsById.values()).toSorted((left, right) =>
    left.name.localeCompare(right.name, "zh-CN"),
  )
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
  }).format(new Date(value))
}

function matchesDate(word: VocabularyWord, filter: string, now: number): boolean {
  if (filter === "all") {
    return true
  }
  const addedAt = new Date(word.addedAt).getTime()
  if (filter === "today") {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return addedAt >= start.getTime()
  }
  const days = filter === "7d" ? 7 : 30
  return addedAt >= now - days * 24 * 60 * 60 * 1000
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest("a, button, input, [role='checkbox'], [data-vocabulary-status]"),
    )
  )
}

function getPaginationItems(
  currentPage: number,
  totalPages: number,
): Array<number | "start-ellipsis" | "end-ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }
  const visiblePages = new Set([
    1,
    totalPages,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ])
  if (currentPage <= 4) {
    for (const page of [2, 3, 4, 5]) {
      visiblePages.add(page)
    }
  }
  if (currentPage >= totalPages - 3) {
    for (const page of [
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
    ]) {
      visiblePages.add(page)
    }
  }
  const pages = Array.from(visiblePages)
    .filter((page) => page > 0 && page <= totalPages)
    .toSorted((left, right) => left - right)
  const items: Array<number | "start-ellipsis" | "end-ellipsis"> = []
  pages.forEach((page, index) => {
    const previousPage = pages[index - 1]
    if (previousPage && page - previousPage > 1) {
      items.push(previousPage === 1 ? "start-ellipsis" : "end-ellipsis")
    }
    items.push(page)
  })
  return items
}

export function VocabularyWorkspace({
  initialWords,
  initialTags,
}: {
  initialWords: VocabularyWord[]
  initialTags: LearningTag[]
}) {
  const [words, setWords] = useState(initialWords)
  const [knownTags, setKnownTags] = useState(initialTags)
  const [query, setQuery] = useState("")
  const [selectedMasteries, setSelectedMasteries] = useState<VocabularyMastery[]>([])
  const [date, setDate] = useState("all")
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [selectedTagValues, setSelectedTagValues] = useState<string[]>([])
  const [sort, setSort] = useState("added-desc")
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)
  const [managing, setManaging] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set<string>())
  const [deleteIds, setDeleteIds] = useState<string[]>([])
  const [pendingWordId, setPendingWordId] = useState<string | null>(null)
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null)
  const [detailWord, setDetailWord] = useState<VocabularyWord | null>(null)
  const [tagEditorWordId, setTagEditorWordId] = useState<string | null>(null)
  const [batchTagDialogOpen, setBatchTagDialogOpen] = useState(false)
  const [batchImportDialogOpen, setBatchImportDialogOpen] = useState(false)
  const [packDialogOpen, setPackDialogOpen] = useState(false)
  const [aiModelConfig, setAiModelConfig] = useState(defaultAiModelConfig)
  const detailRequestId = useRef(0)
  const cleanupStarted = useRef(false)
  const [isPending, startTransition] = useTransition()
  const [isDetailPending, startDetailTransition] = useTransition()
  const [isAiPending, startAiTransition] = useTransition()
  const [isTagPending, startTagTransition] = useTransition()
  const [isBatchTagPending, startBatchTagTransition] = useTransition()
  const [now] = useState(() => Date.now())

  useEffect(() => {
    setAiModelConfig(readStoredAiModelConfig())
  }, [])
  useEffect(() => {
    if (cleanupStarted.current) {
      return
    }
    cleanupStarted.current = true

    async function cleanExistingVocabulary() {
      const failedIds: string[] = []
      let cleanedCount = 0
      let failureCount = 0
      let hasMore = true

      while (hasMore) {
        const result = await cleanVocabularyData({ skipIds: failedIds })
        if (!result.ok || !result.data) {
          toast.error(result.message)
          return
        }
        cleanedCount += result.data.cleanedCount
        failureCount += result.data.failures.length
        failedIds.push(...result.data.failedIds)
        hasMore = result.data.hasMore
        if (result.data.cleanedCount === 0 && result.data.failedIds.length === 0) {
          break
        }
        if (result.data.words.length > 0) {
          setWords((current) => mergeVocabularyWords(current, result.data?.words ?? []))
        }
      }

      if (cleanedCount > 0) {
        toast.success(`已更新 ${cleanedCount} 条生词的词组、例句和释义。`)
      }
      if (failureCount > 0) {
        toast.warning(`${failureCount} 条生词暂未查询到可用词典数据。`)
      }
    }

    void cleanExistingVocabulary()
  }, [])
  const sources = useMemo(
    () =>
      Array.from(new Set(words.flatMap(getVocabularySourceValues))).toSorted((a, b) =>
        a.localeCompare(b, "zh-CN"),
      ),
    [words],
  )
  const tagItems = useMemo(
    () => [
      { value: "untagged", label: "未标记" },
      ...knownTags.map((item) => ({ value: item.id, label: item.name })),
    ],
    [knownTags],
  )
  const filteredWords = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("en")
    const masterySet = new Set(selectedMasteries)
    const sourceSet = new Set(selectedSources)
    const tagValueSet = new Set(selectedTagValues)
    return words
      .filter((word) => {
        const matchesQuery =
          !normalizedQuery ||
          [
            word.word,
            word.partOfSpeech,
            word.definition,
            word.definitionTranslation,
            ...word.examples,
            ...word.exampleTranslations.flatMap((example) => [
              example.text,
              example.translation,
            ]),
            ...word.commonPhrases.flatMap((phrase) => [
              phrase.text,
              phrase.translation,
              phrase.note,
              phrase.example,
              phrase.exampleTranslation,
            ]),
            word.wordAnalysis.etymology,
            word.wordAnalysis.etymologyTranslation,
            ...word.wordAnalysis.relatedWords,
            ...word.tags.map((tag) => tag.name),
            ...(word.aiAnalysis?.partsOfSpeech.flatMap((item) => [
              item.term,
              item.en,
              item.zh,
            ]) ?? []),
            word.sourceSentence,
            word.sourceTitle,
          ]
            .join(" ")
            .toLocaleLowerCase("en")
            .includes(normalizedQuery)
        const matchesTags =
          tagValueSet.size === 0 ||
          (tagValueSet.has("untagged") && word.tags.length === 0) ||
          word.tags.some((item) => tagValueSet.has(item.id))
        const matchesSource =
          sourceSet.size === 0 ||
          getVocabularySourceValues(word).some((item) => sourceSet.has(item))
        return (
          matchesQuery &&
          (masterySet.size === 0 || masterySet.has(word.mastery)) &&
          matchesSource &&
          matchesTags &&
          matchesDate(word, date, now)
        )
      })
      .toSorted((left, right) => {
        if (sort === "word-asc") {
          return left.word.localeCompare(right.word, "en")
        }
        if (sort === "due-asc") {
          return left.dueAt.localeCompare(right.dueAt)
        }
        return right.addedAt.localeCompare(left.addedAt)
      })
  }, [
    date,
    now,
    query,
    selectedMasteries,
    selectedSources,
    selectedTagValues,
    sort,
    words,
  ])
  const counts = {
    new: words.filter((word) => word.mastery === "new").length,
    learning: words.filter((word) => word.mastery === "learning").length,
    mastered: words.filter((word) => word.mastery === "mastered").length,
    due: words.filter((word) => new Date(word.dueAt).getTime() <= now).length,
  }
  const sourceItems = sources.map((item) => ({ value: item, label: item }))
  const activeFilterCount = [
    selectedMasteries.length > 0,
    date !== "all",
    selectedSources.length > 0,
    selectedTagValues.length > 0,
    sort !== "added-desc",
  ].filter(Boolean).length
  const selectedWord = selectedWordId ? detailWord : null
  const tagEditorWord = tagEditorWordId
    ? (words.find((word) => word.id === tagEditorWordId) ?? null)
    : null
  const totalPages = Math.max(1, Math.ceil(filteredWords.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedWords = useMemo(() => {
    const offset = (currentPage - 1) * pageSize
    return filteredWords.slice(offset, offset + pageSize)
  }, [currentPage, filteredWords, pageSize])
  const selectedPageCount = paginatedWords.reduce(
    (count, word) => count + Number(selectedIds.has(word.id)),
    0,
  )
  const allPageSelected =
    paginatedWords.length > 0 && selectedPageCount === paginatedWords.length
  const paginationItems = getPaginationItems(currentPage, totalPages)
  const aiModelConfigured = Boolean(
    aiModelConfig.enabled &&
      aiModelConfig.baseUrl.trim() &&
      aiModelConfig.model.trim() &&
      aiModelConfig.apiKey.trim().length >= 8,
  )

  function removeWord(word: VocabularyWord) {
    setPendingWordId(word.id)
    startTransition(async () => {
      const result = await deleteVocabularyWord(word.id)
      setPendingWordId(null)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setWords((current) => current.filter((item) => item.id !== word.id))
      if (selectedWordId === word.id) {
        setSelectedWordId(null)
        setDetailWord(null)
      }
      if (tagEditorWordId === word.id) {
        setTagEditorWordId(null)
      }
      toast.success(result.message)
    })
  }

  function toggleManaging() {
    setManaging((current) => !current)
    setSelectedIds(new Set())
    setDeleteIds([])
    setBatchTagDialogOpen(false)
  }

  function toggleWord(wordId: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(wordId)) {
        next.delete(wordId)
      } else {
        next.add(wordId)
      }
      return next
    })
  }

  function toggleCurrentPage() {
    setSelectedIds((current) => {
      const next = new Set(current)
      for (const word of paginatedWords) {
        if (allPageSelected) {
          next.delete(word.id)
        } else {
          next.add(word.id)
        }
      }
      return next
    })
  }

  function confirmBatchDelete() {
    startTransition(async () => {
      const result = await deleteVocabularyWords(deleteIds)
      if (!result.ok || !result.data) {
        toast.error(result.message)
        return
      }
      const deletedIds = new Set(result.data.deletedIds)
      setWords((current) => current.filter((word) => !deletedIds.has(word.id)))
      setSelectedIds((current) => {
        const next = new Set(current)
        for (const id of deletedIds) {
          next.delete(id)
        }
        return next
      })
      if (selectedWordId && deletedIds.has(selectedWordId)) {
        closeWordDetails()
      }
      if (tagEditorWordId && deletedIds.has(tagEditorWordId)) {
        setTagEditorWordId(null)
      }
      if (words.every((word) => deletedIds.has(word.id))) {
        setManaging(false)
      }
      setDeleteIds([])
      toast.success(result.message)
    })
  }

  function openWordDetails(wordId: string) {
    const requestId = detailRequestId.current + 1
    detailRequestId.current = requestId
    setSelectedWordId(wordId)
    setDetailWord(null)
    startDetailTransition(async () => {
      const result = await readVocabularyWordDetail(wordId)
      if (detailRequestId.current !== requestId) {
        return
      }
      if (!result.ok || !result.data) {
        toast.error(result.message)
        setSelectedWordId(null)
        setDetailWord(null)
        return
      }
      const latestWord = result.data
      setWords((current) => mergeVocabularyWord(current, latestWord))
      setDetailWord(latestWord)
    })
  }

  function closeWordDetails() {
    detailRequestId.current += 1
    setSelectedWordId(null)
    setDetailWord(null)
  }

  function generateAiAnalysis(word: VocabularyWord) {
    startAiTransition(async () => {
      const result = await generateVocabularyAiAnalysis({
        vocabularyId: word.id,
        config: aiModelConfig,
      })
      if (!result.ok || !result.data) {
        toast.error(result.message)
        return
      }
      const updatedWord = result.data
      setWords((current) => mergeVocabularyWord(current, updatedWord))
      setDetailWord((current) =>
        current?.id === updatedWord.id ? updatedWord : current,
      )
      toast.success(result.message)
    })
  }

  function saveWordTags(tagNames: string[]) {
    if (!tagEditorWordId) {
      return
    }
    const vocabularyId = tagEditorWordId
    startTagTransition(async () => {
      const result = await setVocabularyWordTags({ vocabularyId, tagNames })
      if (!result.ok || !result.data) {
        toast.error(result.message)
        return
      }
      const nextTags = result.data.tags
      setWords((current) =>
        current.map((word) =>
          word.id === vocabularyId ? { ...word, tags: nextTags } : word,
        ),
      )
      setDetailWord((current) =>
        current?.id === vocabularyId ? { ...current, tags: nextTags } : current,
      )
      setKnownTags((current) => {
        return mergeLearningTags(current, nextTags)
      })
      setTagEditorWordId(null)
      toast.success(result.message)
    })
  }

  function addTagsToSelected(tagNames: string[]) {
    const vocabularyIds = Array.from(selectedIds)
    startBatchTagTransition(async () => {
      const result = await addTagsToVocabularyWords({ vocabularyIds, tagNames })
      if (!result.ok || !result.data) {
        toast.error(result.message)
        return
      }
      const updatedIds = new Set(result.data.updatedIds)
      const addedTags = result.data.tags
      setWords((current) =>
        current.map((word) =>
          updatedIds.has(word.id)
            ? { ...word, tags: mergeLearningTags(word.tags, addedTags) }
            : word,
        ),
      )
      setDetailWord((current) =>
        current && updatedIds.has(current.id)
          ? { ...current, tags: mergeLearningTags(current.tags, addedTags) }
          : current,
      )
      setKnownTags((current) => mergeLearningTags(current, addedTags))
      setSelectedIds(new Set())
      setBatchTagDialogOpen(false)
      toast.success(result.message)
    })
  }

  function resetFilters() {
    setQuery("")
    setSelectedMasteries([])
    setDate("all")
    setSelectedSources([])
    setSelectedTagValues([])
    setSort("added-desc")
    setPage(1)
  }

  function addImportedWords(importedWords: VocabularyWord[]) {
    setWords((current) => mergeVocabularyWords(current, importedWords))
    setKnownTags((current) =>
      mergeLearningTags(
        current,
        importedWords.flatMap((word) => word.tags),
      ),
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <PageHeading
        eyebrow="VOCABULARY"
        title="生词本"
        description="集中查看收藏与导入的词汇、上下文和复习状态，并按来源快速筛选。"
        icon={BookMarkedIcon}
        actions={
          <>
            <Link
              href="/workspace/review"
              className={buttonVariants({ variant: "outline" })}
            >
              <LayersIcon data-icon="inline-start" aria-hidden="true" />
              开始复习
            </Link>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPackDialogOpen(true)}
            >
              <LibraryIcon data-icon="inline-start" aria-hidden="true" />
              内置词库
            </Button>
            <Button type="button" onClick={() => setBatchImportDialogOpen(true)}>
              <FileUpIcon data-icon="inline-start" aria-hidden="true" />
              导入生词
            </Button>
          </>
        }
      />

      <section
        aria-label="生词概况"
        className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y py-2"
      >
        <VocabularyMetric icon={BookMarkedIcon} label="全部生词" value={words.length} />
        <VocabularyMetric icon={CircleDotIcon} label="新词" value={counts.new} />
        <VocabularyMetric
          icon={CalendarClockIcon}
          label="今日到期"
          value={counts.due}
        />
        <VocabularyMetric
          icon={CheckCircle2Icon}
          label="已掌握"
          value={counts.mastered}
        />
        <span className="text-xs text-muted-foreground">
          {sources.length} 个词汇来源 · {counts.learning} 个学习中
        </span>
      </section>

      <section aria-label="筛选生词" className="flex items-center gap-2">
        <InputGroup className="h-9 min-w-0 flex-1">
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="搜索生词"
            value={query}
            placeholder="搜索词条、释义、标签、例句或来源"
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
          />
        </InputGroup>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" type="button" className="shrink-0" />}
          >
            <SlidersHorizontalIcon data-icon="inline-start" aria-hidden="true" />
            筛选
            {activeFilterCount > 0 ? (
              <Badge variant="secondary">{activeFilterCount}</Badge>
            ) : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>筛选与排序</DropdownMenuLabel>
              <VocabularyMultiFilterSubmenu
                label="标签"
                allLabel="全部标签"
                items={tagItems}
                values={selectedTagValues}
                onValuesChange={(values) => {
                  setSelectedTagValues(values)
                  setPage(1)
                }}
              />
              <VocabularyMultiFilterSubmenu
                label="掌握状态"
                allLabel="全部状态"
                items={masteryItems}
                values={selectedMasteries}
                onValuesChange={(values) => {
                  setSelectedMasteries(values)
                  setPage(1)
                }}
              />
              <VocabularySingleFilterSubmenu
                label="加入时间"
                items={dateItems}
                value={date}
                onValueChange={(value) => {
                  setDate(value)
                  setPage(1)
                }}
              />
              <VocabularyMultiFilterSubmenu
                label="词汇来源"
                allLabel="全部来源"
                items={sourceItems}
                values={selectedSources}
                onValuesChange={(values) => {
                  setSelectedSources(values)
                  setPage(1)
                }}
              />
              <VocabularySingleFilterSubmenu
                label="排序方式"
                items={sortItems}
                value={sort}
                onValueChange={(value) => {
                  setSort(value)
                  setPage(1)
                }}
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
                  aria-label="重置生词筛选"
                  onClick={resetFilters}
                />
              }
            >
              <FilterXIcon aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>重置筛选</TooltipContent>
          </Tooltip>
        ) : null}
      </section>

      <section id="vocabulary-list" className="flex flex-col gap-3">
        <div className="flex min-h-9 items-center gap-2 overflow-x-auto overscroll-x-contain">
          <h2 className="mr-auto shrink-0 text-base font-semibold">词汇明细</h2>
          <div
            role="toolbar"
            aria-label="词汇操作"
            className="ml-auto flex shrink-0 items-center justify-end gap-2"
          >
            {managing ? (
              <>
                <Checkbox
                  className="md:hidden"
                  aria-label="选择当前页全部生词"
                  checked={allPageSelected}
                  indeterminate={selectedPageCount > 0 && !allPageSelected}
                  onCheckedChange={toggleCurrentPage}
                />
                <span
                  className="text-xs whitespace-nowrap text-muted-foreground"
                  aria-live="polite"
                >
                  已选 {selectedIds.size}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={selectedIds.size === 0 || isBatchTagPending}
                  onClick={() => setBatchTagDialogOpen(true)}
                >
                  <TagsIcon data-icon="inline-start" aria-hidden="true" />
                  添加标签
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  type="button"
                  disabled={selectedIds.size === 0 || isPending}
                  onClick={() => setDeleteIds(Array.from(selectedIds))}
                >
                  <Trash2Icon data-icon="inline-start" aria-hidden="true" />
                  删除
                </Button>
              </>
            ) : null}
            {words.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={toggleManaging}
              >
                {managing ? (
                  <XIcon data-icon="inline-start" aria-hidden="true" />
                ) : (
                  <CheckSquareIcon data-icon="inline-start" aria-hidden="true" />
                )}
                {managing ? "完成管理" : "批量管理"}
              </Button>
            ) : null}
          </div>
        </div>

        {filteredWords.length > 0 ? (
          <>
            <div className="hidden max-h-[60svh] overflow-auto overscroll-contain rounded-md border [&_[data-slot=table-container]]:overflow-visible md:block">
              <Table className="table-fixed">
                <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-background [&_th]:shadow-[inset_0_-1px_0_var(--border)]">
                  <TableRow>
                    {managing ? (
                      <TableHead className="w-10">
                        <Checkbox
                          aria-label="选择当前页全部生词"
                          checked={allPageSelected}
                          indeterminate={selectedPageCount > 0 && !allPageSelected}
                          onCheckedChange={toggleCurrentPage}
                        />
                      </TableHead>
                    ) : null}
                    <TableHead className="w-[16%]">词条</TableHead>
                    <TableHead className="w-[27%]">释义</TableHead>
                    <TableHead className="w-[27%]">词组 / 例句</TableHead>
                    <TableHead className="w-[13%]">来源</TableHead>
                    <TableHead className="w-[11%]">掌握状态</TableHead>
                    {!managing ? (
                      <TableHead className="w-28 text-right">操作</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedWords.map((word) => (
                    <TableRow
                      key={word.id}
                      data-state={selectedIds.has(word.id) ? "selected" : undefined}
                      className={cn("align-top", managing && "cursor-pointer")}
                      onClick={(event) => {
                        if (managing && !isInteractiveTarget(event.target)) {
                          toggleWord(word.id)
                        }
                      }}
                    >
                      {managing ? (
                        <TableCell className="py-4">
                          <Checkbox
                            aria-label={`选择 ${word.word}`}
                            checked={selectedIds.has(word.id)}
                            onCheckedChange={() => toggleWord(word.id)}
                          />
                        </TableCell>
                      ) : null}
                      <TableCell className="overflow-hidden py-4">
                        <div className="flex min-w-0 flex-col items-start gap-1">
                          <WordTitleButton
                            word={word}
                            className="w-full flex-none"
                            onOpen={managing ? toggleWord : openWordDetails}
                          />
                          <EnglishPronunciation
                            text={word.word}
                            phoneticUk={word.phoneticUk}
                            phoneticUs={word.phoneticUs}
                          />
                          <VocabularyTagBadges tags={word.tags} />
                        </div>
                      </TableCell>
                      <TableCell className="overflow-hidden whitespace-normal py-4 break-words">
                        <VocabularyMeaning word={word} />
                      </TableCell>
                      <TableCell className="overflow-hidden whitespace-normal py-4 break-words">
                        <VocabularyContext word={word} />
                      </TableCell>
                      <TableCell className="overflow-hidden py-4">
                        <SourceLink word={word} />
                      </TableCell>
                      <TableCell className="overflow-hidden py-4 whitespace-normal">
                        <VocabularyStatus word={word} />
                      </TableCell>
                      {!managing ? (
                        <TableCell className="overflow-hidden py-4">
                          <div className="flex justify-end gap-1">
                            <WordDetailsButton word={word} onOpen={openWordDetails} />
                            <WordTagsButton word={word} onOpen={setTagEditorWordId} />
                            <WordDeleteButton
                              word={word}
                              pending={isPending && pendingWordId === word.id}
                              onDelete={removeWord}
                            />
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y rounded-md border md:hidden">
              {paginatedWords.map((word) => (
                <article
                  key={word.id}
                  data-state={selectedIds.has(word.id) ? "selected" : undefined}
                  className={cn(
                    "flex flex-col gap-3 p-4 transition-colors data-[state=selected]:bg-muted",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    {managing ? (
                      <Checkbox
                        className="mt-0.5"
                        aria-label={`选择 ${word.word}`}
                        checked={selectedIds.has(word.id)}
                        onCheckedChange={() => toggleWord(word.id)}
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <WordTitleButton
                          word={word}
                          className="flex-1 text-base"
                          onOpen={managing ? toggleWord : openWordDetails}
                        />
                        <VocabularyStatus word={word} />
                      </div>
                      <EnglishPronunciation
                        className="mt-1"
                        text={word.word}
                        phoneticUk={word.phoneticUk}
                        phoneticUs={word.phoneticUs}
                      />
                      <VocabularyTagBadges className="mt-2" tags={word.tags} />
                    </div>
                    {!managing ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <WordDetailsButton word={word} onOpen={openWordDetails} />
                        <WordTagsButton word={word} onOpen={setTagEditorWordId} />
                        <WordDeleteButton
                          word={word}
                          pending={isPending && pendingWordId === word.id}
                          onDelete={removeWord}
                        />
                      </div>
                    ) : null}
                  </div>
                  <VocabularyMeaning word={word} mobile />
                  <VocabularyContext word={word} />
                  <div className="min-w-0">
                    <SourceLink word={word} />
                  </div>
                </article>
              ))}
            </div>
            <div className="flex flex-col items-center justify-between gap-3 border-t pt-3 sm:flex-row">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>每页</span>
                <Select
                  items={pageSizeItems}
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    const nextPageSize = Number(value)
                    if ([20, 50, 100].includes(nextPageSize)) {
                      setPageSize(nextPageSize)
                      setPage(1)
                    }
                  }}
                >
                  <SelectTrigger size="sm" aria-label="每页生词数量">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {pageSizeItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <span>共 {filteredWords.length} 条</span>
              </div>
              <Pagination className="mx-0 w-auto">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#vocabulary-list"
                      aria-disabled={currentPage === 1}
                      tabIndex={currentPage === 1 ? -1 : undefined}
                      className={cn(
                        currentPage === 1 && "pointer-events-none opacity-50",
                      )}
                      onClick={(event) => {
                        event.preventDefault()
                        setPage((current) => Math.max(1, current - 1))
                      }}
                    />
                  </PaginationItem>
                  {paginationItems.map((item) =>
                    typeof item === "number" ? (
                      <PaginationItem key={item}>
                        <PaginationLink
                          href="#vocabulary-list"
                          isActive={item === currentPage}
                          aria-label={`第 ${item} 页`}
                          onClick={(event) => {
                            event.preventDefault()
                            setPage(item)
                          }}
                        >
                          {item}
                        </PaginationLink>
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={item}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ),
                  )}
                  <PaginationItem>
                    <PaginationNext
                      href="#vocabulary-list"
                      aria-disabled={currentPage === totalPages}
                      tabIndex={currentPage === totalPages ? -1 : undefined}
                      className={cn(
                        currentPage === totalPages && "pointer-events-none opacity-50",
                      )}
                      onClick={(event) => {
                        event.preventDefault()
                        setPage((current) => Math.min(totalPages, current + 1))
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </>
        ) : (
          <Empty className="min-h-96 border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookMarkedIcon />
              </EmptyMedia>
              <EmptyTitle>
                {words.length === 0 ? "生词本还是空的" : "没有匹配的生词"}
              </EmptyTitle>
              <EmptyDescription>
                {words.length === 0
                  ? "导入带字幕的视频后，在字幕中点击英文单词即可收藏。"
                  : "重置部分筛选条件后再试一次。"}
              </EmptyDescription>
            </EmptyHeader>
            {words.length === 0 ? (
              <EmptyContent>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button type="button" onClick={() => setBatchImportDialogOpen(true)}>
                    <FileUpIcon data-icon="inline-start" aria-hidden="true" />
                    导入生词
                  </Button>
                  <Link
                    href="/workspace/library"
                    className={buttonVariants({ variant: "outline" })}
                  >
                    <PlayIcon data-icon="inline-start" aria-hidden="true" />
                    去学习
                  </Link>
                  <Link
                    href="/workspace/import"
                    className={buttonVariants({ variant: "outline" })}
                  >
                    导入带字幕视频
                  </Link>
                </div>
              </EmptyContent>
            ) : null}
          </Empty>
        )}
      </section>
      <WordDetailSheet
        open={Boolean(selectedWordId)}
        word={selectedWord}
        aiModelConfigured={aiModelConfigured}
        aiModelName={aiModelConfig.model}
        isLoading={isDetailPending}
        isGenerating={isAiPending}
        onClose={closeWordDetails}
        onEditTags={(word) => setTagEditorWordId(word.id)}
        onGenerate={generateAiAnalysis}
      />
      <VocabularyTagDialog
        open={Boolean(tagEditorWordId)}
        word={tagEditorWord}
        availableTags={knownTags}
        isSaving={isTagPending}
        onOpenChange={(open) => {
          if (!open) {
            setTagEditorWordId(null)
          }
        }}
        onSave={saveWordTags}
      />
      <VocabularyBatchTagDialog
        open={batchTagDialogOpen}
        selectedCount={selectedIds.size}
        availableTags={knownTags}
        isSaving={isBatchTagPending}
        onOpenChange={setBatchTagDialogOpen}
        onSave={addTagsToSelected}
      />
      <VocabularyBatchImportDialog
        open={batchImportDialogOpen}
        availableTags={knownTags}
        onOpenChange={setBatchImportDialogOpen}
        onImported={addImportedWords}
      />
      <VocabularyPackDialog
        open={packDialogOpen}
        availableSources={sources}
        onOpenChange={setPackDialogOpen}
        onImported={addImportedWords}
      />
      <Dialog
        open={deleteIds.length > 0}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setDeleteIds([])
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除选中的生词？</DialogTitle>
            <DialogDescription>
              将永久删除 {deleteIds.length}{" "}
              个生词。删除后无法继续复习这些词汇，此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              disabled={isPending}
              onClick={() => setDeleteIds([])}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              type="button"
              disabled={isPending}
              onClick={confirmBatchDelete}
            >
              {isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Trash2Icon data-icon="inline-start" aria-hidden="true" />
              )}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function WordTitleButton({
  word,
  className,
  onOpen,
}: {
  word: VocabularyWord
  className?: string
  onOpen: (wordId: string) => void
}) {
  return (
    <button
      type="button"
      className={cn("group min-w-0 flex-1 text-left", className)}
      onClick={() => onOpen(word.id)}
    >
      <span className="min-w-0 break-words font-semibold group-hover:underline group-hover:underline-offset-2">
        {word.word}
      </span>
    </button>
  )
}

function VocabularyMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: number
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
      <strong className="font-mono text-sm text-foreground">{value}</strong>
    </span>
  )
}

function VocabularyMultiFilterSubmenu<Value extends string>({
  label,
  allLabel,
  items,
  values,
  onValuesChange,
}: {
  label: string
  allLabel: string
  items: Array<{ label: string; value: Value }>
  values: Value[]
  onValuesChange: (values: Value[]) => void
}) {
  const selectedValueSet = new Set(values)
  const selectedLabels = items
    .filter((item) => selectedValueSet.has(item.value))
    .map((item) => item.label)
  const summary =
    selectedLabels.length === 0
      ? allLabel
      : selectedLabels.length === 1
        ? selectedLabels[0]
        : `已选 ${selectedLabels.length} 项`

  function toggleValue(value: Value, checked: boolean) {
    const nextValueSet = new Set(values)
    if (checked) {
      nextValueSet.add(value)
    } else {
      nextValueSet.delete(value)
    }
    onValuesChange(
      items.filter((item) => nextValueSet.has(item.value)).map((item) => item.value),
    )
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="grid w-full grid-cols-[minmax(0,1fr)_6rem_auto]">
        <span className="min-w-0">{label}</span>
        <span className="truncate text-left text-xs text-muted-foreground">
          {summary}
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuCheckboxItem
            aria-label={allLabel}
            checked={values.length === 0}
            onCheckedChange={() => onValuesChange([])}
          >
            <span>{allLabel}</span>
          </DropdownMenuCheckboxItem>
          {items.map((item) => (
            <DropdownMenuCheckboxItem
              key={item.value}
              checked={selectedValueSet.has(item.value)}
              onCheckedChange={(checked) => toggleValue(item.value, checked)}
            >
              <span className="min-w-0 whitespace-normal break-words">
                {item.label}
              </span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

function VocabularySingleFilterSubmenu({
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
      <DropdownMenuSubTrigger className="grid w-full grid-cols-[minmax(0,1fr)_6rem_auto]">
        <span className="min-w-0">{label}</span>
        <span className="truncate text-left text-xs text-muted-foreground">
          {selectedLabel}
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-40">
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

function SourceLink({ word }: { word: VocabularyWord }) {
  const triggerClassName =
    "flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          word.sourceVideoId ? (
            <Link
              href={`/workspace/videos/${word.sourceVideoId}`}
              className={triggerClassName}
            />
          ) : (
            <span className={triggerClassName} />
          )
        }
      >
        {word.sourceVideoId ? (
          <ClapperboardIcon className="size-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <BookPlusIcon className="size-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="truncate">{word.sourceTitle}</span>
        {word.sourceVideoId ? (
          <span className="shrink-0 font-mono">
            {formatDuration(word.sourceTimestampSeconds)}
          </span>
        ) : null}
      </TooltipTrigger>
      <TooltipContent align="start" className="max-w-sm">
        {word.sourceTitle}
        {word.sourceVideoId ? ` · ${formatDuration(word.sourceTimestampSeconds)}` : ""}
      </TooltipContent>
    </Tooltip>
  )
}

function VocabularyMeaning({
  word,
  mobile = false,
}: {
  word: VocabularyWord
  mobile?: boolean
}) {
  const definitions = getVocabularyDefinitionLines(word)
  return (
    <div className="flex flex-col gap-1">
      {definitions.length > 0 ? (
        <ul className="flex flex-col gap-1 text-xs leading-relaxed">
          {definitions.slice(0, mobile ? 4 : 3).map((definition) => (
            <li key={`${definition.partOfSpeech}-${definition.translation}`}>
              {definition.partOfSpeech ? (
                <span className="mr-1 font-mono font-semibold text-foreground">
                  {definition.partOfSpeech}
                </span>
              ) : null}
              <span>{definition.translation}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">暂无中文释义</p>
      )}
    </div>
  )
}

function VocabularyContext({ word }: { word: VocabularyWord }) {
  const contexts = getVocabularyDisplayContextItems(word)
  if (contexts.length === 0) {
    return <p className="text-xs text-muted-foreground">暂无例句</p>
  }
  return (
    <ul className="flex flex-col gap-2 text-xs">
      {contexts.map((context) => (
        <li key={`${context.kind}-${context.text}`} className="min-w-0 leading-relaxed">
          <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
              {context.kind === "phrase" ? "词组" : "例句"}
            </span>
            <span className={cn(context.kind === "phrase" && "font-medium")}>
              <VocabularyTermHighlight
                text={context.text}
                word={word.word}
                inflections={word.inflections.map((inflection) => inflection.value)}
                highlightPhrase={context.kind === "phrase"}
              />
            </span>
          </p>
          {context.translation ? (
            <p className="text-muted-foreground">{context.translation}</p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function getVocabularyDisplayContextItems(
  word: VocabularyWord,
): VocabularyContextItem[] {
  const contexts = getVocabularyContextItems(word)
  if (contexts.some((context) => context.kind === "example")) {
    return contexts
  }
  const sourceExample = getVocabularySourceContextItem(word)
  return sourceExample ? [...contexts.slice(0, 3), sourceExample] : contexts
}

function getVocabularySourceContextItem(
  word: VocabularyWord,
): VocabularyContextItem | null {
  const text = word.sourceSentence.trim().replace(/\s+/gu, " ")
  if (!text) {
    return null
  }
  return {
    kind: "example",
    text,
    translation: word.translation.trim().replace(/\s+/gu, " "),
  }
}

function MasteryBadge({ mastery }: { mastery: VocabularyMastery }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        mastery === "new" && "text-muted-foreground",
        mastery === "learning" && "border-info/30 text-info-foreground",
        mastery === "mastered" && "border-success/40 text-foreground",
      )}
    >
      {masteryLabels[mastery]}
    </Badge>
  )
}

function getVocabularyLevelLabel(word: VocabularyWord): string {
  if (word.aiAnalysis?.cefrLevel) {
    return word.aiAnalysis.cefrLevel
  }
  for (const label of word.examLabels) {
    const match = label
      .trim()
      .toLocaleUpperCase("en")
      .match(/^(?:CEFR\s+)?(A1|A2|B1|B2|C1|C2)$/u)
    if (match?.[1]) {
      return match[1]
    }
  }
  return ""
}

function VocabularyStatus({ word }: { word: VocabularyWord }) {
  const level = getVocabularyLevelLabel(word)
  const details = [
    masteryLabels[word.mastery],
    level ? `等级 ${level}` : "",
    `${formatDate(word.addedAt)} 加入`,
  ].filter(Boolean)

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            data-vocabulary-status=""
            aria-label={details.join("，")}
            className="inline-flex w-fit cursor-default rounded-full bg-transparent p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
          />
        }
      >
        <MasteryBadge mastery={word.mastery} />
      </TooltipTrigger>
      <TooltipContent side="top" className="flex-col items-start gap-0.5">
        <span>{masteryLabels[word.mastery]}</span>
        {level ? <span>等级 {level}</span> : null}
        <span>{formatDate(word.addedAt)} 加入</span>
      </TooltipContent>
    </Tooltip>
  )
}

function WordDetailsButton({
  word,
  onOpen,
}: {
  word: VocabularyWord
  onOpen: (wordId: string) => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label={`查看 ${word.word} 的词汇明细`}
            onClick={() => onOpen(word.id)}
          />
        }
      >
        <PanelRightOpenIcon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>词汇明细</TooltipContent>
    </Tooltip>
  )
}

function WordTagsButton({
  word,
  onOpen,
}: {
  word: VocabularyWord
  onOpen: (wordId: string) => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label={`编辑 ${word.word} 的标签`}
            onClick={() => onOpen(word.id)}
          />
        }
      >
        <TagsIcon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>编辑标签</TooltipContent>
    </Tooltip>
  )
}

function WordDeleteButton({
  word,
  pending,
  onDelete,
}: {
  word: VocabularyWord
  pending: boolean
  onDelete: (word: VocabularyWord) => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label={`删除 ${word.word}`}
            disabled={pending}
            onClick={() => onDelete(word)}
          />
        }
      >
        {pending ? <Spinner /> : <Trash2Icon aria-hidden="true" />}
      </TooltipTrigger>
      <TooltipContent>删除生词</TooltipContent>
    </Tooltip>
  )
}
