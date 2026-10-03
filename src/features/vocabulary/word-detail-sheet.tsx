"use client"

import {
  BlocksIcon,
  BookOpenIcon,
  BookPlusIcon,
  BotIcon,
  BrainCircuitIcon,
  CaptionsIcon,
  Clock3Icon,
  HistoryIcon,
  type LucideIcon,
  MessageSquareQuoteIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  TagsIcon,
  WaypointsIcon,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { EnglishPronunciation } from "../../components/english-pronunciation-buttons"
import { Badge } from "../../components/ui/badge"
import { Button, buttonVariants } from "../../components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet"
import { Spinner } from "../../components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip"
import { VocabularyTermHighlight } from "../../components/vocabulary-term-highlight"
import { formatDuration } from "../../lib/format"
import { cn } from "../../lib/utils"
import {
  getVocabularyChineseDefinition,
  getVocabularyMeanings,
  getVocabularyPartOfSpeech,
  isUsefulVocabularyExample,
  isUsefulVocabularyPhrase,
  normalizePartOfSpeechAbbreviation,
} from "../../lib/vocabulary-display"
import type {
  AiEtymologyNode,
  AiVocabularyAnalysis,
  AiVocabularyExample,
  AiVocabularyItem,
  BilingualText,
  VocabularyWord,
} from "../../types/learning"
import { VocabularyTagBadges } from "./vocabulary-tag-dialog"

type ItemTone = "neutral" | "info" | "success" | "warning" | "destructive"

export function WordDetailSheet({
  open,
  word,
  aiModelConfigured,
  aiModelName,
  isLoading,
  isGenerating,
  onClose,
  onEditTags,
  onGenerate,
}: {
  open: boolean
  word: VocabularyWord | null
  aiModelConfigured: boolean
  aiModelName: string
  isLoading: boolean
  isGenerating: boolean
  onClose: () => void
  onEditTags: (word: VocabularyWord) => void
  onGenerate: (word: VocabularyWord) => void
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <SheetContent className="w-full max-w-none gap-0 overflow-hidden data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:md:w-1/2">
        {isLoading ? (
          <WordDetailLoading />
        ) : word ? (
          <>
            <SheetHeader className="shrink-0 gap-1.5 px-4 py-3 pr-14 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <SheetTitle className="text-xl font-semibold">
                      {word.word}
                    </SheetTitle>
                    <Badge
                      variant="outline"
                      className={cn(
                        word.mastery === "learning" &&
                          "border-info/30 bg-info/15 text-info-foreground",
                        word.mastery === "mastered" &&
                          "border-success/30 bg-success/15",
                      )}
                    >
                      {word.mastery === "new"
                        ? "新词"
                        : word.mastery === "learning"
                          ? "学习中"
                          : "已掌握"}
                    </Badge>
                    {word.aiAnalysis?.cefrLevel ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-md border-l-[3px] font-mono",
                          getCefrLevelBadgeClasses(word.aiAnalysis.cefrLevel),
                        )}
                      >
                        CEFR {word.aiAnalysis.cefrLevel}
                      </Badge>
                    ) : null}
                  </div>
                  <EnglishPronunciation
                    className="mt-1"
                    text={word.word}
                    phoneticUk={word.phoneticUk}
                    phoneticUs={word.phoneticUs}
                  />
                  <VocabularyTagBadges className="mt-2" tags={word.tags} />
                </div>
              </div>
              <SourceDescription word={word} />
              <div className="flex w-full min-w-0 flex-col gap-1.5 pt-0.5 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isLoading}
                    onClick={() => onEditTags(word)}
                  >
                    <TagsIcon data-icon="inline-start" aria-hidden="true" />
                    编辑标签
                  </Button>
                  {aiModelConfigured ? (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isGenerating || isLoading}
                            onClick={() => onGenerate(word)}
                          />
                        }
                      >
                        {isGenerating ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
                        )}
                        重新生成
                      </TooltipTrigger>
                      <TooltipContent>
                        新结果会先与已有词性、词形、词根词缀和词源事实校验
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Link
                      href="/workspace/settings#ai-model"
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <BotIcon data-icon="inline-start" aria-hidden="true" />
                      去配置
                    </Link>
                  )}
                  {word.sourceVideoId ? (
                    <Link
                      href={`/workspace/videos/${word.sourceVideoId}`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      <CaptionsIcon data-icon="inline-start" aria-hidden="true" />
                      进入视频语境
                    </Link>
                  ) : null}
                  {aiModelConfigured && word.aiAnalysis ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ShieldCheckIcon className="size-3.5" aria-hidden="true" />
                      重生成前校验一致性
                    </span>
                  ) : null}
                </div>
                {word.aiAnalysis ? (
                  <GenerationMetadata analysis={word.aiAnalysis} model={aiModelName} />
                ) : null}
              </div>
            </SheetHeader>

            <WordDetailContent word={word} />
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

type DetailSection = {
  value: string
  title: string
  detail?: string
  icon: LucideIcon
  children: React.ReactNode
}

function WordDetailLoading() {
  return (
    <>
      <SheetHeader className="shrink-0 gap-1.5 px-4 py-3 pr-14 shadow-sm">
        <SheetTitle className="text-xl font-semibold">读取词汇明细</SheetTitle>
        <SheetDescription>正在从库中同步最新记录。</SheetDescription>
      </SheetHeader>
      <div className="flex min-h-80 flex-1 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          同步中
        </div>
      </div>
    </>
  )
}

function WordDetailContent({ word }: { word: VocabularyWord }) {
  const sections = useMemo(() => createDetailSections(word), [word])
  const [activeSection, setActiveSection] = useState(sections[0]?.value ?? "")
  const [indicatorLeft, setIndicatorLeft] = useState<number | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const navigationRef = useRef<HTMLElement>(null)
  const navigationButtonRefs = useRef(new Map<string, HTMLButtonElement>())
  const programmaticScrollTargetRef = useRef<string | null>(null)
  const scrollIdleTimerRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    const navigation = navigationRef.current
    const activeButton = navigationButtonRefs.current.get(activeSection)
    if (!navigation || !activeButton) {
      setIndicatorLeft(null)
      return
    }
    const indicatorTarget = activeButton

    function updateIndicator() {
      setIndicatorLeft(
        indicatorTarget.offsetLeft + (indicatorTarget.offsetWidth - 40) / 2,
      )
    }

    updateIndicator()
    const resizeObserver = new ResizeObserver(updateIndicator)
    resizeObserver.observe(navigation)
    resizeObserver.observe(indicatorTarget)
    return () => resizeObserver.disconnect()
  }, [activeSection])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || sections.length === 0) {
      return
    }
    const scrollContainer = container

    let animationFrame = 0
    function syncActiveSection() {
      cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(() => {
        const navigationHeight = navigationRef.current?.offsetHeight ?? 0
        const anchor =
          scrollContainer.getBoundingClientRect().top + navigationHeight + 12
        let nextSection = sections[0]?.value ?? ""
        for (const section of sections) {
          const element = document.getElementById(`word-detail-${section.value}`)
          if (!element || element.getBoundingClientRect().top > anchor) {
            break
          }
          nextSection = section.value
        }
        const reachedBottom =
          Math.ceil(scrollContainer.scrollTop + scrollContainer.clientHeight) >=
          scrollContainer.scrollHeight - 2
        if (reachedBottom) {
          nextSection = sections.at(-1)?.value ?? nextSection
        }
        setActiveSection((current) => (current === nextSection ? current : nextSection))
      })
    }

    function handleScroll() {
      if (programmaticScrollTargetRef.current) {
        if (scrollIdleTimerRef.current !== null) {
          window.clearTimeout(scrollIdleTimerRef.current)
        }
        scrollIdleTimerRef.current = window.setTimeout(() => {
          scrollIdleTimerRef.current = null
          programmaticScrollTargetRef.current = null
          syncActiveSection()
        }, 120)
        return
      }
      syncActiveSection()
    }

    syncActiveSection()
    scrollContainer.addEventListener("scroll", handleScroll, {
      passive: true,
    })
    window.addEventListener("resize", syncActiveSection)
    return () => {
      cancelAnimationFrame(animationFrame)
      if (scrollIdleTimerRef.current !== null) {
        window.clearTimeout(scrollIdleTimerRef.current)
        scrollIdleTimerRef.current = null
      }
      programmaticScrollTargetRef.current = null
      scrollContainer.removeEventListener("scroll", handleScroll)
      window.removeEventListener("resize", syncActiveSection)
    }
  }, [sections])

  function scrollToSection(value: string) {
    const container = scrollContainerRef.current
    const target = document.getElementById(`word-detail-${value}`)
    if (!container || !target) {
      return
    }
    const navigationHeight = navigationRef.current?.offsetHeight ?? 0
    const targetTop =
      container.scrollTop +
      target.getBoundingClientRect().top -
      container.getBoundingClientRect().top -
      navigationHeight
    if (scrollIdleTimerRef.current !== null) {
      window.clearTimeout(scrollIdleTimerRef.current)
      scrollIdleTimerRef.current = null
    }
    programmaticScrollTargetRef.current =
      Math.abs(container.scrollTop - targetTop) > 1 ? value : null
    setActiveSection(value)
    container.scrollTo({ top: targetTop, behavior: "smooth" })
  }

  return (
    <div
      ref={scrollContainerRef}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3"
    >
      <nav
        ref={navigationRef}
        aria-label="词汇明细分类"
        className="sticky top-0 z-20 -mx-4 flex gap-1 overflow-x-auto bg-popover/95 px-4 py-2 shadow-sm backdrop-blur [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute bottom-2 left-0 z-10 h-0.5 w-10 rounded-full bg-info transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none",
            indicatorLeft === null ? "opacity-0" : "opacity-100",
          )}
          style={{
            transform: `translate3d(${indicatorLeft ?? 0}px, 0, 0)`,
          }}
        />
        {sections.map((section) => (
          <Button
            key={section.value}
            ref={(button) => {
              if (button) {
                navigationButtonRefs.current.set(section.value, button)
              } else {
                navigationButtonRefs.current.delete(section.value)
              }
            }}
            variant="ghost"
            size="sm"
            type="button"
            className="relative shrink-0 rounded-none bg-transparent shadow-none ring-0 hover:bg-muted/40 aria-[current=location]:text-foreground"
            aria-current={activeSection === section.value ? "location" : undefined}
            onClick={() => scrollToSection(section.value)}
          >
            <section.icon data-icon="inline-start" aria-hidden="true" />
            {section.title}
          </Button>
        ))}
      </nav>
      <div className="divide-y">
        {sections.map((section) => (
          <section
            key={section.value}
            id={`word-detail-${section.value}`}
            className="scroll-mt-20"
          >
            <header className="sticky top-12 z-10 -mx-4 bg-popover/95 px-4 py-2.5 shadow-xs backdrop-blur">
              <span className="flex min-w-0 items-center gap-2">
                <section.icon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="truncate">{section.title}</span>
                {section.detail ? (
                  <Badge
                    variant="secondary"
                    className="max-w-40 shrink-0 truncate font-normal"
                  >
                    {section.detail}
                  </Badge>
                ) : null}
              </span>
            </header>
            <div className="flex flex-col gap-4 pt-3 pb-4 [&_p:not(:last-child)]:mb-0">
              {section.children}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function createDetailSections(word: VocabularyWord): DetailSection[] {
  const sections: DetailSection[] = []
  if (
    hasBilingualText(word.aiAnalysis?.explanation) ||
    hasBilingualText(word.aiAnalysis?.wordPartMemory)
  ) {
    sections.push({
      value: "ai",
      title: "AI 双语解析",
      icon: BrainCircuitIcon,
      children: <AiExplanationSection word={word} />,
    })
  }
  sections.push({
    value: "core",
    title: "核心释义与语境",
    icon: BookOpenIcon,
    children: <DefinitionSection word={word} />,
  })
  const structureCount = getStructureCount(word)
  if (structureCount > 0) {
    sections.push({
      value: "structure",
      title: "词形结构",
      detail: `${structureCount} 项`,
      icon: BlocksIcon,
      children: <StructureSection word={word} />,
    })
  }
  if (hasEtymologyContent(word)) {
    sections.push({
      value: "etymology",
      title: "词源脉络",
      icon: HistoryIcon,
      children: <EtymologySection word={word} />,
    })
  }
  const usageCount = getUsageCount(word)
  if (usageCount > 0) {
    sections.push({
      value: "usage",
      title: "例句与用法",
      detail: `${usageCount} 项`,
      icon: MessageSquareQuoteIcon,
      children: <UsageSection word={word} />,
    })
  }
  const relationCount = getRelationCount(word)
  if (relationCount > 0) {
    sections.push({
      value: "relations",
      title: "语义关系",
      detail: `${relationCount} 项`,
      icon: WaypointsIcon,
      children: <RelationSection word={word} />,
    })
  }
  return sections
}

function DefinitionSection({ word }: { word: VocabularyWord }) {
  const chineseDefinition = getVocabularyChineseDefinition(word)
  const meanings = getVocabularyMeanings(word)
  return (
    <>
      {word.examLabels.length > 0 ? (
        <ContentGroup title="考试范围">
          <div className="flex flex-wrap gap-1.5">
            {word.examLabels.map((label) => (
              <Badge
                key={label}
                variant="outline"
                className={cn(
                  "rounded-md border-l-[3px]",
                  getExamLabelBadgeClasses(label),
                )}
              >
                {label}
              </Badge>
            ))}
          </div>
        </ContentGroup>
      ) : null}
      <ContentGroup title="核心释义">
        {meanings.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {meanings.map((meaning) => (
              <li
                key={`${meaning.partOfSpeech}-${meaning.definition}-${meaning.translation}`}
                className="grid gap-1 text-sm leading-relaxed sm:grid-cols-[2.5rem_minmax(0,1fr)]"
              >
                <span className="font-semibold text-muted-foreground">
                  {normalizePartOfSpeechAbbreviation(meaning.partOfSpeech)}
                </span>
                <span>
                  {meaning.translation ? (
                    <span className="block font-medium">{meaning.translation}</span>
                  ) : null}
                  {meaning.definition ? (
                    <span className="block text-xs text-muted-foreground">
                      {meaning.definition}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : chineseDefinition ? (
          <p className="text-sm leading-relaxed font-medium">{chineseDefinition}</p>
        ) : (
          <p className="text-sm text-muted-foreground">暂无中文释义</p>
        )}
        {meanings.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {word.definition}
          </p>
        ) : null}
      </ContentGroup>
      {word.inflections.length > 0 ? (
        <ContentGroup title="词形变化">
          <dl className="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
            {word.inflections.map((item) => (
              <div
                key={`${item.label}-${item.value}`}
                className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2"
              >
                <dt className="text-muted-foreground">{item.label}</dt>
                <dd className="font-mono font-medium">{item.value}</dd>
              </div>
            ))}
          </dl>
        </ContentGroup>
      ) : null}
      {word.sourceSentence ? (
        <ContentGroup title="视频语境">
          <div className="text-sm leading-relaxed">
            <p className="text-sm font-medium">
              <VocabularyTermHighlight
                text={word.sourceSentence}
                word={word.word}
                inflections={word.inflections.map((inflection) => inflection.value)}
              />
            </p>
            {word.translation ? (
              <p className="mt-1 text-sm text-muted-foreground">{word.translation}</p>
            ) : null}
          </div>
        </ContentGroup>
      ) : null}
    </>
  )
}

function StructureSection({ word }: { word: VocabularyWord }) {
  const analysis = word.aiAnalysis
  const partOfSpeech = getVocabularyPartOfSpeech(word)
  return (
    <>
      {analysis?.partsOfSpeech.length ? (
        <ContentGroup title="词性">
          <PartsOfSpeechList items={analysis.partsOfSpeech} />
        </ContentGroup>
      ) : partOfSpeech ? (
        <ContentGroup title="词性">
          <div className="flex flex-col items-start gap-1">
            <Badge
              variant="outline"
              className="w-fit border-info/30 bg-info/15 text-info-foreground"
            >
              {partOfSpeech.label}
            </Badge>
            {partOfSpeech.inferred ? (
              <span className="text-xs text-muted-foreground">根据英文释义判断</span>
            ) : null}
          </div>
        </ContentGroup>
      ) : null}
      {analysis?.tenses.length ? (
        <ContentGroup title="时态与词形">
          <AiItemList items={analysis.tenses} tone="warning" />
        </ContentGroup>
      ) : null}
      {word.wordAnalysis.parts.length || analysis?.wordParts.length ? (
        <ContentGroup title="词根词缀">
          <WordPartTree word={word} />
        </ContentGroup>
      ) : null}
      {analysis?.derivatives.length ? (
        <ContentGroup title="派生词">
          <AiItemList items={analysis.derivatives} tone="success" />
        </ContentGroup>
      ) : null}
    </>
  )
}

function EtymologySection({ word }: { word: VocabularyWord }) {
  const hasDescription =
    hasBilingualText(word.aiAnalysis?.etymology) || Boolean(word.wordAnalysis.etymology)
  const nodes = word.aiAnalysis?.etymologyTree ?? []
  return (
    <>
      {hasDescription ? (
        <ContentGroup title="词源说明">
          <BilingualCopy value={word.aiAnalysis?.etymology} />
          {word.wordAnalysis.etymology ? (
            <BilingualCopy
              value={{
                en: word.wordAnalysis.etymology,
                zh: word.wordAnalysis.etymologyTranslation,
              }}
            />
          ) : null}
        </ContentGroup>
      ) : null}
      {nodes.length > 0 ? (
        <ContentGroup title="演变路径">
          <EtymologyTree nodes={nodes} />
        </ContentGroup>
      ) : null}
    </>
  )
}

function UsageSection({ word }: { word: VocabularyWord }) {
  const analysis = word.aiAnalysis
  const aiExamples =
    analysis?.examples.filter((example) =>
      isUsefulVocabularyExample(example.term, word.word, word.sourceSentence),
    ) ?? []
  const aiPhrases =
    analysis?.phrases.filter((phrase) =>
      isUsefulVocabularyPhrase(phrase.term, word.word),
    ) ?? []
  return (
    <>
      {hasExistingExamples(word) || aiExamples.length > 0 ? (
        <ContentGroup title="例句">
          <ExistingExamples word={word} />
          <AiExamplesList items={aiExamples} word={word} />
        </ContentGroup>
      ) : null}
      {analysis?.collocations.length ? (
        <ContentGroup title="搭配">
          <AiItemList
            items={analysis.collocations}
            tone="info"
            highlightTermsFor={word}
          />
        </ContentGroup>
      ) : null}
      {hasExistingPhrases(word) || aiPhrases.length > 0 ? (
        <ContentGroup title="词组">
          <ExistingPhrases word={word} />
          <AiPhraseList items={aiPhrases} word={word} />
        </ContentGroup>
      ) : null}
      {analysis?.idioms.length ? (
        <ContentGroup title="习惯用语">
          <AiItemList items={analysis.idioms} tone="warning" highlightTermsFor={word} />
        </ContentGroup>
      ) : null}
    </>
  )
}

function RelationSection({ word }: { word: VocabularyWord }) {
  const analysis = word.aiAnalysis
  if (!analysis) {
    return null
  }
  return (
    <>
      {analysis.synonyms.length ? (
        <ContentGroup title="近义词">
          <AiItemList items={analysis.synonyms} tone="success" />
        </ContentGroup>
      ) : null}
      {analysis.antonyms.length ? (
        <ContentGroup title="反义词">
          <AiItemList items={analysis.antonyms} tone="destructive" />
        </ContentGroup>
      ) : null}
      {analysis.replacements.length ? (
        <ContentGroup title="替换表达">
          <AiItemList items={analysis.replacements} tone="info" />
        </ContentGroup>
      ) : null}
      {analysis.newMeanings.length ? (
        <ContentGroup title="单词新解">
          <AiItemList items={analysis.newMeanings} tone="warning" />
        </ContentGroup>
      ) : null}
    </>
  )
}

function AiExplanationSection({ word }: { word: VocabularyWord }) {
  if (!word.aiAnalysis) {
    return null
  }
  return (
    <>
      {hasBilingualText(word.aiAnalysis.wordPartMemory) ? (
        <ContentGroup title="构词画面">
          <div className="rounded-md border-l-2 border-warning bg-warning/10 px-3 py-2.5">
            <BilingualCopy value={word.aiAnalysis.wordPartMemory} />
          </div>
        </ContentGroup>
      ) : null}
      {hasBilingualText(word.aiAnalysis.explanation) ? (
        <ContentGroup title="含义解析">
          <BilingualCopy value={word.aiAnalysis.explanation} />
        </ContentGroup>
      ) : null}
    </>
  )
}

function ContentGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-2 sm:grid-cols-[5rem_minmax(0,1fr)] sm:items-start">
      <h3 className="pt-1 text-xs font-medium text-muted-foreground">{title}</h3>
      <div className="flex min-w-0 flex-col gap-2">{children}</div>
    </section>
  )
}

function hasBilingualText(value?: BilingualText): boolean {
  return Boolean(value?.en || value?.zh)
}

function hasExistingExamples(word: VocabularyWord): boolean {
  return getExistingExamples(word).length > 0
}

function hasExistingPhrases(word: VocabularyWord): boolean {
  return word.commonPhrases.some((phrase) =>
    isUsefulVocabularyPhrase(phrase.text, word.word),
  )
}

function getStructureCount(word: VocabularyWord): number {
  const analysis = word.aiAnalysis
  return (
    (getVocabularyPartOfSpeech(word) ? 1 : 0) +
    word.wordAnalysis.parts.length +
    (analysis?.partsOfSpeech.length ?? 0) +
    (analysis?.tenses.length ?? 0) +
    (analysis?.wordParts.length ?? 0) +
    (analysis?.derivatives.length ?? 0)
  )
}

function hasEtymologyContent(word: VocabularyWord): boolean {
  return Boolean(
    hasBilingualText(word.aiAnalysis?.etymology) ||
      word.wordAnalysis.etymology ||
      word.aiAnalysis?.etymologyTree.length,
  )
}

function getUsageCount(word: VocabularyWord): number {
  const analysis = word.aiAnalysis
  return (
    getExistingExamples(word).length +
    word.commonPhrases.filter((phrase) =>
      isUsefulVocabularyPhrase(phrase.text, word.word),
    ).length +
    (analysis?.examples.filter((example) =>
      isUsefulVocabularyExample(example.term, word.word, word.sourceSentence),
    ).length ?? 0) +
    (analysis?.collocations.length ?? 0) +
    (analysis?.phrases.filter((phrase) =>
      isUsefulVocabularyPhrase(phrase.term, word.word),
    ).length ?? 0) +
    (analysis?.idioms.length ?? 0)
  )
}

function getRelationCount(word: VocabularyWord): number {
  const analysis = word.aiAnalysis
  if (!analysis) {
    return 0
  }
  return (
    analysis.synonyms.length +
    analysis.antonyms.length +
    analysis.replacements.length +
    analysis.newMeanings.length
  )
}

function AiItemList({
  items,
  tone,
  emptyText,
  highlightTermsFor,
}: {
  items: AiVocabularyItem[]
  tone: ItemTone
  emptyText?: string
  highlightTermsFor?: VocabularyWord
}) {
  if (items.length === 0) {
    return emptyText ? (
      <p className="text-xs text-muted-foreground">{emptyText}</p>
    ) : null
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <li
          key={`${item.term}-${item.en}-${item.zh}`}
          className={cn(
            "flex flex-col gap-1 rounded-md border-l-2 bg-muted/45 px-2.5 py-2",
            tone === "neutral" && "border-border",
            tone === "info" && "border-info",
            tone === "success" && "border-success",
            tone === "warning" && "border-warning",
            tone === "destructive" && "border-destructive",
          )}
        >
          <p className="text-base leading-snug font-semibold">
            {highlightTermsFor ? (
              <VocabularyTermHighlight
                text={item.term}
                word={highlightTermsFor.word}
                highlightPhrase
              />
            ) : (
              item.term
            )}
          </p>
          <span className="min-w-0 text-xs leading-relaxed">
            {item.en ? <span className="block">{item.en}</span> : null}
            {item.zh ? (
              <span className="mt-0.5 block text-muted-foreground">{item.zh}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  )
}

function AiPhraseList({
  items,
  word,
}: {
  items: AiVocabularyItem[]
  word: VocabularyWord
}) {
  if (items.length === 0) {
    return null
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li
          key={`${item.term}-${item.en}-${item.zh}`}
          className="flex flex-col gap-0.5 text-sm leading-relaxed"
        >
          <p className="min-w-0">
            <span className="font-semibold">
              <VocabularyTermHighlight
                text={item.term}
                word={word.word}
                highlightPhrase
              />
            </span>
            {item.zh ? (
              <span className="ml-1.5 text-muted-foreground">{item.zh}</span>
            ) : null}
          </p>
          {item.en ? <p className="text-xs text-foreground/80">{item.en}</p> : null}
        </li>
      ))}
    </ul>
  )
}

const partOfSpeechBadgeClasses = {
  noun: "border-info/30 bg-info/15 text-info-foreground",
  verb: "border-success/40 bg-success/20 text-foreground",
  adjective: "border-warning/40 bg-warning/20 text-warning-foreground",
  adverb: "border-destructive/30 bg-destructive/10 text-destructive",
  other: "border-border bg-secondary text-secondary-foreground",
} as const

function PartsOfSpeechList({ items }: { items: AiVocabularyItem[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <li
          key={`${item.term}-${item.en}-${item.zh}`}
          className="flex flex-col items-start gap-1.5 rounded-md border-l-2 border-transparent bg-muted/45 px-2.5 py-2"
        >
          <Badge
            variant="outline"
            className={partOfSpeechBadgeClasses[getPartOfSpeechTone(item)]}
          >
            {normalizePartOfSpeechAbbreviation(item.term)}
          </Badge>
          {item.en ? <p className="text-xs leading-relaxed">{item.en}</p> : null}
          {item.zh ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{item.zh}</p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function getPartOfSpeechTone(
  item: AiVocabularyItem,
): keyof typeof partOfSpeechBadgeClasses {
  const abbreviation = normalizePartOfSpeechAbbreviation(item.term)
  if (/(^| \/ )n\./u.test(abbreviation)) {
    return "noun"
  }
  if (/(^| \/ )(v|vi|vt|phr\. v)\./u.test(abbreviation)) {
    return "verb"
  }
  if (/(^| \/ )adj\./u.test(abbreviation)) {
    return "adjective"
  }
  if (/(^| \/ )adv\./u.test(abbreviation)) {
    return "adverb"
  }
  return "other"
}

function AiExamplesList({
  items,
  word,
}: {
  items: AiVocabularyExample[]
  word: VocabularyWord
}) {
  if (items.length === 0) {
    return null
  }
  return (
    <ul className="flex flex-col gap-4">
      {items.slice(0, 3).map((item) => (
        <li
          key={`${item.term}-${item.en}-${item.zh}`}
          className="flex flex-col gap-1.5"
        >
          <p className="text-base leading-relaxed font-medium">
            <VocabularyTermHighlight
              text={item.term}
              word={word.word}
              inflections={word.inflections.map((inflection) => inflection.value)}
            />
          </p>
          {item.translation ? (
            <p className="text-sm leading-relaxed">{item.translation}</p>
          ) : null}
          {item.en || item.zh ? (
            <div className="flex flex-col gap-0.5 border-l-2 border-info pl-2.5">
              <span className="text-xs font-medium text-muted-foreground">
                用法解析
              </span>
              {item.en ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {item.en}
                </p>
              ) : null}
              {item.zh ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {item.zh}
                </p>
              ) : null}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function ExistingExamples({ word }: { word: VocabularyWord }) {
  const examples = getExistingExamples(word)
  if (examples.length === 0) {
    return null
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {examples.slice(0, 3).map((example) => (
        <li key={example.text} className="leading-relaxed">
          <p className="text-base font-medium">
            <VocabularyTermHighlight
              text={example.text}
              word={word.word}
              inflections={word.inflections.map((inflection) => inflection.value)}
            />
          </p>
          {example.translation ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {example.translation}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function ExistingPhrases({ word }: { word: VocabularyWord }) {
  const phrases = word.commonPhrases.filter((phrase) =>
    isUsefulVocabularyPhrase(phrase.text, word.word),
  )
  if (phrases.length === 0) {
    return null
  }
  return (
    <ul className="flex flex-col">
      {phrases.slice(0, 4).map((phrase) => {
        const showExample = isUsefulVocabularyExample(
          phrase.example,
          word.word,
          word.sourceSentence,
        )
        return (
          <li
            key={phrase.text}
            className="flex flex-col gap-0.5 border-b py-2.5 text-sm leading-relaxed first:pt-0 last:border-b-0 last:pb-0"
          >
            <p className="min-w-0">
              <span className="font-semibold">
                <VocabularyTermHighlight
                  text={phrase.text}
                  word={word.word}
                  highlightPhrase
                />
              </span>
              {phrase.translation ? (
                <span className="ml-1.5 text-muted-foreground">
                  {phrase.translation}
                </span>
              ) : null}
            </p>
            {showExample ? (
              <>
                <p className="text-xs text-foreground/80">
                  <VocabularyTermHighlight
                    text={phrase.example}
                    word={word.word}
                    inflections={word.inflections.map((inflection) => inflection.value)}
                  />
                </p>
                {phrase.exampleTranslation ? (
                  <p className="text-xs text-muted-foreground">
                    {phrase.exampleTranslation}
                  </p>
                ) : null}
              </>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function getExistingExamples(word: VocabularyWord) {
  const examples =
    word.exampleTranslations.length > 0
      ? word.exampleTranslations
      : word.examples.map((text) => ({ text, translation: "" }))
  return examples.filter((example) =>
    isUsefulVocabularyExample(example.text, word.word, word.sourceSentence),
  )
}

function getCefrLevelBadgeClasses(level: string): string {
  if (level === "A1" || level === "A2") {
    return "border-border/70 border-l-success bg-success/15 text-foreground"
  }
  if (level === "B1" || level === "B2") {
    return "border-border/70 border-l-info bg-info/15 text-info-foreground"
  }
  if (level === "C1") {
    return "border-border/70 border-l-warning bg-warning/15 text-warning-foreground"
  }
  return "border-border/70 border-l-destructive bg-destructive/10 text-destructive"
}

function getExamLabelBadgeClasses(label: string): string {
  const normalizedLabel = label.toLocaleUpperCase("en").replaceAll("-", "")
  if (normalizedLabel === "CET4" || normalizedLabel.includes("商务")) {
    return "border-border/70 border-l-success bg-success/15 text-foreground"
  }
  if (normalizedLabel === "CET6" || normalizedLabel === "TOEFL") {
    return "border-border/70 border-l-info bg-info/15 text-info-foreground"
  }
  if (normalizedLabel === "IELTS" || normalizedLabel.includes("考研")) {
    return "border-border/70 border-l-warning bg-warning/15 text-warning-foreground"
  }
  if (normalizedLabel === "GRE" || normalizedLabel === "GMAT") {
    return "border-border/70 border-l-destructive bg-destructive/10 text-destructive"
  }
  return "border-border bg-secondary text-secondary-foreground"
}

type WordPartTreeNode = {
  key: string
  kind: string
  term: string
  en: string
  zh: string
  source: string
  phrase: string
  phraseTranslation: string
  example: string
  exampleTranslation: string
}

const wordPartKindLabels: Record<string, string> = {
  prefix: "前缀",
  root: "词根",
  suffix: "后缀",
  base: "词基",
  stem: "词干",
}

function WordPartTree({ word }: { word: VocabularyWord }) {
  const nodes = getWordPartTreeNodes(word)
  if (nodes.length === 0) {
    return null
  }
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-0">
        {nodes.map((node) => (
          <li
            key={node.key}
            className="relative grid grid-cols-[2rem_1rem_minmax(0,1fr)] gap-x-2 pb-6 before:absolute before:top-0 before:left-[3rem] before:h-1.5 before:w-px before:bg-info/50 after:absolute after:top-1.5 after:bottom-0 after:left-[3rem] after:w-px after:bg-info/50 first:before:hidden last:pb-0 last:after:hidden"
          >
            <span className="text-left text-xs font-medium text-muted-foreground">
              {node.kind}
            </span>
            <span className="relative flex justify-center">
              <span className="relative z-10 size-3 rounded-full border-2 border-info bg-popover" />
            </span>
            <div className="min-w-0">
              <p className="self-start font-mono text-base leading-none font-semibold">
                {node.term}
              </p>
              {node.en ? (
                <p className="mt-1 text-xs leading-relaxed">{node.en}</p>
              ) : null}
              {node.zh ? (
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {node.zh}
                </p>
              ) : null}
              {node.source ? (
                <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                  <HistoryIcon
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>来源：{node.source}</span>
                </p>
              ) : null}
              {node.phrase ? (
                <div className="mt-2 border-l-2 border-success/60 pl-2.5 text-xs leading-relaxed">
                  <p className="font-medium">
                    <VocabularyTermHighlight
                      text={node.phrase}
                      word={word.word}
                      highlightPhrase
                    />
                  </p>
                  {node.phraseTranslation ? (
                    <p className="text-muted-foreground">{node.phraseTranslation}</p>
                  ) : null}
                </div>
              ) : null}
              {node.example ? (
                <div className="mt-2 text-xs leading-relaxed">
                  <p>
                    <VocabularyTermHighlight
                      text={node.example}
                      word={word.word}
                      inflections={word.inflections.map(
                        (inflection) => inflection.value,
                      )}
                    />
                  </p>
                  {node.exampleTranslation ? (
                    <p className="text-muted-foreground">{node.exampleTranslation}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function getWordPartTreeNodes(word: VocabularyWord): WordPartTreeNode[] {
  const nodes: WordPartTreeNode[] = []
  const nodeIndexes = new Map<string, number>()
  const aiWordParts = word.aiAnalysis?.wordParts ?? []
  const phrase =
    word.commonPhrases.find((item) => item.text.includes(word.word)) ??
    word.commonPhrases[0]
  const example =
    (phrase?.example
      ? {
          text: phrase.example,
          translation: phrase.exampleTranslation,
        }
      : undefined) ??
    word.exampleTranslations.find((item) =>
      phrase
        ? item.text
            .toLocaleLowerCase("en")
            .includes(phrase.text.toLocaleLowerCase("en"))
        : false,
    ) ??
    word.exampleTranslations[0] ??
    (word.examples[0] ? { text: word.examples[0], translation: "" } : undefined)
  for (const part of aiWordParts.length > 0 ? [] : word.wordAnalysis.parts) {
    const key = normalizeWordPartKey(part.text)
    if (!key || nodeIndexes.has(key)) {
      continue
    }
    nodeIndexes.set(key, nodes.length)
    nodes.push({
      key: `${part.kind}-${key}`,
      kind: wordPartKindLabels[part.kind] ?? "构词",
      term: part.text,
      en: part.meaning,
      zh: part.meaningTranslation,
      source: part.source,
      phrase: "phrase" in part ? part.phrase : (phrase?.text ?? ""),
      phraseTranslation:
        "phraseTranslation" in part
          ? part.phraseTranslation
          : (phrase?.translation ?? ""),
      example: "example" in part ? part.example : (example?.text ?? ""),
      exampleTranslation:
        "exampleTranslation" in part
          ? part.exampleTranslation
          : (example?.translation ?? ""),
    })
  }
  for (const item of aiWordParts) {
    const parsed = parseAiWordPartTerm(item.term)
    const key = normalizeWordPartKey(parsed.term)
    if (!key) {
      continue
    }
    const existingIndex = nodeIndexes.get(key)
    if (existingIndex !== undefined) {
      const existing = nodes[existingIndex]
      if (existing) {
        nodes[existingIndex] = {
          ...existing,
          kind: wordPartKindLabels[parsed.kind] ?? existing.kind,
          en: item.en || existing.en,
          zh: item.zh || existing.zh,
          source: item.source || existing.source,
          phrase: item.phrase || existing.phrase,
          phraseTranslation: item.phraseTranslation || existing.phraseTranslation,
          example: item.example || existing.example,
          exampleTranslation: item.exampleTranslation || existing.exampleTranslation,
        }
      }
      continue
    }
    nodeIndexes.set(key, nodes.length)
    nodes.push({
      key: `${parsed.kind}-${key}`,
      kind: wordPartKindLabels[parsed.kind] ?? "构词",
      term: parsed.term,
      en: item.en,
      zh: item.zh,
      source: item.source,
      phrase: item.phrase,
      phraseTranslation: item.phraseTranslation,
      example: item.example,
      exampleTranslation: item.exampleTranslation,
    })
  }
  return nodes
}

function parseAiWordPartTerm(value: string): { kind: string; term: string } {
  const match = value.match(/^\s*(prefix|root|suffix|base|stem)\s*[:：]\s*(.+)$/iu)
  if (!match) {
    return { kind: "part", term: value }
  }
  return {
    kind: match[1]?.toLocaleLowerCase("en") ?? "part",
    term: match[2]?.trim() || value,
  }
}

function normalizeWordPartKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}*]+/gu, "")
}

function EtymologyTree({ nodes }: { nodes: AiEtymologyNode[] }) {
  const timelineNodes = flattenEtymologyNodes(nodes)
  if (timelineNodes.length === 0) {
    return null
  }
  return (
    <ol className="flex flex-col">
      {timelineNodes.map((node) => (
        <li
          key={node.key}
          className="relative pb-6 pl-8 before:absolute before:top-0 before:left-[0.3125rem] before:h-1.5 before:w-px before:bg-info/50 after:absolute after:top-1.5 after:bottom-0 after:left-[0.3125rem] after:w-px after:bg-info/50 first:before:hidden last:pb-0 last:after:hidden"
        >
          <span className="absolute top-0 left-0 z-10 size-3 rounded-full border-2 border-info bg-popover" />
          <div className="min-w-0">
            <p className="text-base font-semibold">{node.label}</p>
            {node.en ? <p className="mt-1 text-xs leading-relaxed">{node.en}</p> : null}
            {node.zh ? (
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {node.zh}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

function flattenEtymologyNodes(
  nodes: AiEtymologyNode[],
): Array<AiEtymologyNode & { key: string }> {
  const result: Array<AiEtymologyNode & { key: string }> = []
  function append(items: AiEtymologyNode[], path: string) {
    items.forEach((item, index) => {
      const key = `${path}-${index}-${item.label}`
      result.push({ ...item, key })
      append(item.children, key)
    })
  }
  append(nodes, "origin")
  return result
}

function BilingualCopy({ value }: { value?: BilingualText }) {
  if (!value?.en && !value?.zh) {
    return null
  }
  return (
    <div className="flex flex-col gap-1 text-sm leading-relaxed">
      {value.en ? <p>{value.en}</p> : null}
      {value.zh ? <p className="text-muted-foreground">{value.zh}</p> : null}
    </div>
  )
}

function SourceDescription({ word }: { word: VocabularyWord }) {
  return (
    <SheetDescription className="flex min-w-0 items-center gap-2">
      {word.sourceVideoId ? (
        <Badge className="shrink-0 font-mono">
          {formatDuration(word.sourceTimestampSeconds)}
        </Badge>
      ) : (
        <BookPlusIcon className="size-3.5 shrink-0" aria-hidden="true" />
      )}
      <Tooltip>
        <TooltipTrigger
          render={<span className="min-w-0 truncate text-left text-muted-foreground" />}
        >
          {word.sourceTitle}
        </TooltipTrigger>
        <TooltipContent align="start" side="bottom">
          {word.sourceTitle}
        </TooltipContent>
      </Tooltip>
    </SheetDescription>
  )
}

function GenerationMetadata({
  analysis,
  model,
}: {
  analysis: AiVocabularyAnalysis
  model: string
}) {
  const generatedAt = new Date(analysis.generatedAt)
  const formattedDate = new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(generatedAt)
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="flex shrink-0 items-center justify-end gap-1.5 self-end text-right text-xs text-muted-foreground sm:ml-auto sm:self-center" />
        }
      >
        <Clock3Icon className="size-3.5" aria-hidden="true" />
        <time dateTime={analysis.generatedAt}>{formattedDate}</time>
        <BotIcon className="hidden" aria-hidden="true" />
        <span className="hidden">{model || "AI 解析"}</span>
      </TooltipTrigger>
      <TooltipContent>当前本地模型：{model || "未配置"}</TooltipContent>
    </Tooltip>
  )
}
