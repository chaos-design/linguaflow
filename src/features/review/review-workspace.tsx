"use client"

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  CircleStopIcon,
  CircleXIcon,
  ClapperboardIcon,
  FlagIcon,
  KeyboardIcon,
  LayersIcon,
  ListChecksIcon,
  LoaderCircleIcon,
  MinusIcon,
  PartyPopperIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwIcon,
  ShuffleIcon,
} from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { EnglishPronunciation } from "../../components/english-pronunciation-buttons"
import { PageHeading } from "../../components/page-heading"
import { Badge } from "../../components/ui/badge"
import { Button, buttonVariants } from "../../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../../components/ui/empty"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "../../components/ui/popover"
import { Progress } from "../../components/ui/progress"
import { Separator } from "../../components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip"
import { VocabularyTermHighlight } from "../../components/vocabulary-term-highlight"
import { speakEnglish } from "../../lib/english-speech"
import { formatDuration } from "../../lib/format"
import { cn } from "../../lib/utils"
import {
  getVocabularyChineseDefinition,
  getVocabularyDefinitionLines,
} from "../../lib/vocabulary-display"
import { reviewVocabularyWord } from "../../server/learning/actions"
import type {
  DictionaryExample,
  DictionaryPhrase,
  LearningTag,
  VocabularyMastery,
  VocabularyWord,
} from "../../types/learning"
import {
  buildReviewChoiceOptions,
  buildReviewQueue,
  clampReviewTarget,
  createReviewClozePrompt,
  getContextReviewExamples,
  getEligibleReviewCards,
  getExampleReviewPhrases,
  getReviewExamples,
  isVocabularyPhrase,
  type ReviewChoiceOption,
  type ReviewFocus,
  type ReviewOrder,
  type ReviewPlan,
  requeueReviewCard,
  restoreDueReviewCard,
} from "./review-session"
import { ReviewTagFilter } from "./review-tag-filter"

type ReviewMode = "word" | "phrase" | "context" | "definition"
type ReviewStage = "choose" | "plan" | "review"
type ReviewSessionKind = "random" | "plan"
type ReviewRating = 1 | 2 | 3 | 4

interface ReviewHistoryEntry {
  id: string
  rating: ReviewRating
}

const ratings = [
  { label: "忘记", interval: "10 分钟", value: 1, className: "text-destructive" },
  {
    label: "模糊",
    interval: "1 天",
    value: 2,
    className: "text-warning-foreground",
  },
  { label: "记住", interval: "按计划", value: 3, className: "text-foreground" },
  {
    label: "掌握",
    interval: "延长间隔",
    value: 4,
    className: "text-primary-foreground",
  },
] as const

const reviewModeLabels: Record<ReviewMode, string> = {
  word: "单词卡",
  phrase: "词组填空",
  context: "语境选词",
  definition: "释义反查",
}

const masteryLabels: Record<VocabularyMastery, string> = {
  new: "新词",
  learning: "学习中",
  mastered: "已掌握",
}

const focusOptions: Array<{
  value: ReviewFocus
  label: string
}> = [
  { value: "all", label: "全部到期" },
  { value: "new", label: "新词" },
  { value: "learning", label: "学习中" },
  { value: "mastered", label: "已掌握" },
]

const shortcutItems = [
  { keys: ["Space"], label: "翻面 / 显示翻译" },
  { keys: ["1", "2", "3", "4"], label: "提交评分" },
  { keys: ["P"], label: "朗读当前单词" },
  { keys: ["Esc"], label: "结束本轮复习" },
  { keys: ["?"], label: "打开快捷键" },
]

export function ReviewWorkspace({
  cards: initialCards,
  defaultReviewTarget,
  reviewSeed,
}: {
  cards: VocabularyWord[]
  defaultReviewTarget: number
  reviewSeed: number
}) {
  const initialTarget = clampReviewTarget(defaultReviewTarget, initialCards.length)
  const [cards, setCards] = useState(initialCards)
  const [stage, setStage] = useState<ReviewStage>("choose")
  const [plan, setPlan] = useState<ReviewPlan>({
    focus: "all",
    order: "due-first",
    tagIds: [],
    targetCount: initialTarget,
  })
  const availableTags = useMemo(
    () => getAvailableReviewTags(initialCards),
    [initialCards],
  )
  const [sessionCards, setSessionCards] = useState<VocabularyWord[]>([])
  const [sessionReviewModes, setSessionReviewModes] = useState<
    Record<string, ReviewMode>
  >({})
  const [sessionKind, setSessionKind] = useState<ReviewSessionKind>("random")
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [history, setHistory] = useState<ReviewHistoryEntry[]>([])
  const [endedEarly, setEndedEarly] = useState(false)
  const [shortcutOpen, setShortcutOpen] = useState(false)
  const [pendingReviewCount, setPendingReviewCount] = useState(0)
  const pendingCardIdsRef = useRef(new Set<string>())
  const reviewAttemptCounterRef = useRef(0)

  const complete =
    stage === "review" &&
    (endedEarly || sessionCards.length === 0 || currentIndex >= sessionCards.length)
  const currentCard = sessionCards[currentIndex]
  const currentPhrases = currentCard ? getExampleReviewPhrases(currentCard) : []
  const currentPhrase =
    currentPhrases.length > 0
      ? currentPhrases[currentIndex % currentPhrases.length]
      : null
  const currentClozeExamples = currentCard ? getContextReviewExamples(currentCard) : []
  const currentExample =
    currentClozeExamples.length > 0
      ? currentClozeExamples[currentIndex % currentClozeExamples.length]
      : null
  const activeReviewMode = currentCard
    ? (sessionReviewModes[currentCard.id] ?? "word")
    : "word"
  const currentChoiceSet = useMemo(
    () =>
      currentCard
        ? getReviewChoiceSet({
            card: currentCard,
            cards: initialCards,
            mode: activeReviewMode,
            phrase: currentPhrase,
            seed: reviewSeed + currentIndex,
          })
        : null,
    [
      activeReviewMode,
      currentCard,
      currentIndex,
      currentPhrase,
      initialCards,
      reviewSeed,
    ],
  )

  const startSession = useCallback(
    (kind: ReviewSessionKind, nextPlan: ReviewPlan) => {
      const queue = buildReviewQueue(cards, nextPlan, reviewSeed)
      if (queue.length === 0) {
        toast.info("当前范围内没有到期卡片。")
        return
      }
      setSessionCards(queue)
      setSessionReviewModes(
        Object.fromEntries(
          queue.map((card, index) => [
            card.id,
            pickReviewMode(card, reviewSeed, index),
          ]),
        ),
      )
      setSessionKind(kind)
      setCurrentIndex(0)
      setShowAnswer(false)
      setShowTranslation(false)
      setSelectedOptionId(null)
      setHistory([])
      setEndedEarly(false)
      setShortcutOpen(false)
      setStage("review")
    },
    [cards, reviewSeed],
  )

  const startRandomReview = useCallback(() => {
    startSession("random", {
      focus: "all",
      order: "random",
      tagIds: plan.tagIds,
      targetCount: initialTarget,
    })
  }, [initialTarget, plan.tagIds, startSession])

  const rateCard = useCallback(
    (rating: ReviewRating) => {
      if (!currentCard || complete || pendingCardIdsRef.current.has(currentCard.id)) {
        return
      }

      const reviewedCard = currentCard
      reviewAttemptCounterRef.current += 1
      const historyEntry: ReviewHistoryEntry = {
        id: `${reviewedCard.id}:${reviewAttemptCounterRef.current}`,
        rating,
      }

      pendingCardIdsRef.current.add(reviewedCard.id)
      setPendingReviewCount((current) => current + 1)
      setCards((current) => current.filter((card) => card.id !== reviewedCard.id))
      setHistory((current) => [...current, historyEntry])
      setCurrentIndex((current) => current + 1)
      setShowAnswer(false)
      setShowTranslation(false)
      setSelectedOptionId(null)

      function restoreCard(message: string) {
        setCards((current) => restoreDueReviewCard(current, reviewedCard))
        setSessionCards((current) => requeueReviewCard(current, reviewedCard.id))
        setHistory((current) => current.filter((entry) => entry.id !== historyEntry.id))
        setCurrentIndex((current) => Math.max(0, current - 1))
        toast.error(message)
      }

      void reviewVocabularyWord({
        vocabularyId: reviewedCard.id,
        rating,
      })
        .then((result) => {
          if (result.ok) {
            return
          }
          restoreCard(`${result.message} 卡片已移到本轮末尾。`)
        })
        .catch(() => {
          restoreCard("复习进度保存失败，卡片已移到本轮末尾。")
        })
        .finally(() => {
          pendingCardIdsRef.current.delete(reviewedCard.id)
          setPendingReviewCount((current) => Math.max(0, current - 1))
        })
    },
    [complete, currentCard],
  )

  const pronounce = useCallback((word: string) => {
    void speakEnglish(word, "us").then((spoken) => {
      if (!spoken) {
        toast.error("当前浏览器不支持语音朗读。")
      }
    })
  }, [])

  const finishSession = useCallback(() => {
    setEndedEarly(true)
    toast.info("本轮复习已结束，未评分卡片仍保留在到期队列中。")
  }, [])

  const selectReviewOption = useCallback(
    (optionId: string) => {
      if (selectedOptionId) {
        return
      }
      setSelectedOptionId(optionId)
      setShowAnswer(true)
    },
    [selectedOptionId],
  )

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable) ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return
      }
      if (event.key === "?" && stage === "review" && !complete) {
        event.preventDefault()
        setShortcutOpen(true)
        return
      }
      if (stage !== "review" || complete || shortcutOpen) {
        return
      }
      if (event.key === "Escape") {
        event.preventDefault()
        finishSession()
        return
      }
      if (event.code === "KeyP" && currentCard) {
        event.preventDefault()
        pronounce(currentCard.word)
        return
      }
      if (event.code === "Space" && currentCard) {
        event.preventDefault()
        if (!showAnswer) {
          setShowAnswer(true)
        } else if (activeReviewMode !== "context") {
          setShowTranslation((current) => !current)
        }
        return
      }
      const rating = Number(event.key)
      if (rating >= 1 && rating <= 4) {
        event.preventDefault()
        rateCard(rating as ReviewRating)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    activeReviewMode,
    complete,
    currentCard,
    finishSession,
    pronounce,
    rateCard,
    shortcutOpen,
    showAnswer,
    stage,
  ])

  function updatePlan(nextPlan: ReviewPlan) {
    const availableCount = getEligibleReviewCards(
      cards,
      nextPlan.focus,
      nextPlan.tagIds,
    ).length
    setPlan({
      ...nextPlan,
      targetCount: clampReviewTarget(nextPlan.targetCount, availableCount),
    })
  }

  function returnToModeSelection() {
    setStage("choose")
    setSessionCards([])
    setSessionReviewModes({})
    setCurrentIndex(0)
    setShowAnswer(false)
    setShowTranslation(false)
    setSelectedOptionId(null)
    setHistory([])
    setEndedEarly(false)
    setShortcutOpen(false)
  }

  let content: React.ReactNode
  if (stage === "choose") {
    content = (
      <ReviewModeSelection
        availableTags={availableTags}
        cards={cards}
        defaultReviewTarget={defaultReviewTarget}
        selectedTagIds={plan.tagIds}
        onSelectedTagIdsChange={(tagIds) => updatePlan({ ...plan, tagIds })}
        onStartRandom={startRandomReview}
        onOpenPlan={() => setStage("plan")}
      />
    )
  } else if (stage === "plan") {
    content = (
      <ReviewPlanBuilder
        availableTags={availableTags}
        cards={cards}
        plan={plan}
        onPlanChange={updatePlan}
        onBack={() => setStage("choose")}
        onStart={() => startSession("plan", plan)}
      />
    )
  } else if (complete) {
    content = (
      <ReviewCompletion
        endedEarly={endedEarly}
        history={history}
        pendingReviewCount={pendingReviewCount}
        sessionCards={sessionCards}
        sessionKind={sessionKind}
        onReturn={returnToModeSelection}
      />
    )
  } else if (currentCard) {
    content = (
      <ActiveReviewSession
        activeReviewMode={activeReviewMode}
        choiceOptions={currentChoiceSet?.options ?? []}
        correctOptionId={currentChoiceSet?.correctOptionId ?? null}
        currentCard={currentCard}
        currentExample={currentExample}
        currentIndex={currentIndex}
        currentPhrase={currentPhrase}
        history={history}
        onFinish={finishSession}
        onRate={rateCard}
        onSelectOption={selectReviewOption}
        onShowAnswer={() => setShowAnswer(true)}
        onShortcutOpenChange={setShortcutOpen}
        onShowTranslation={() => setShowTranslation(true)}
        pendingReviewCount={pendingReviewCount}
        sessionCards={sessionCards}
        sessionKind={sessionKind}
        selectedOptionId={selectedOptionId}
        shortcutOpen={shortcutOpen}
        showAnswer={showAnswer}
        showTranslation={showTranslation}
      />
    )
  } else {
    content = null
  }

  return <>{content}</>
}

function ReviewModeSelection({
  availableTags,
  cards,
  defaultReviewTarget,
  selectedTagIds,
  onSelectedTagIdsChange,
  onStartRandom,
  onOpenPlan,
}: {
  availableTags: LearningTag[]
  cards: VocabularyWord[]
  defaultReviewTarget: number
  selectedTagIds: readonly string[]
  onSelectedTagIdsChange: (tagIds: string[]) => void
  onStartRandom: () => void
  onOpenPlan: () => void
}) {
  const filteredCards = getEligibleReviewCards(cards, "all", selectedTagIds)
  const dueCount = filteredCards.length
  const randomCount = clampReviewTarget(defaultReviewTarget, dueCount)
  const learningCount = filteredCards.filter(
    (card) => card.mastery === "learning",
  ).length
  const masteredCount = filteredCards.filter(
    (card) => card.mastery === "mastered",
  ).length

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-6 p-4 md:p-8 lg:p-10">
        <PageHeading
          eyebrow="REVIEW"
          title="复习闪卡"
          description="随机抽取到期卡片，或先设置本轮复习计划。"
          icon={LayersIcon}
          actions={
            <Link
              href="/workspace/vocabulary"
              className={buttonVariants({ variant: "outline" })}
            >
              <BookOpenIcon data-icon="inline-start" aria-hidden="true" />
              生词本
            </Link>
          }
        />

        <section
          aria-label="到期卡片概况"
          className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y py-3"
        >
          <ReviewMetric
            icon={CalendarClockIcon}
            label={selectedTagIds.length > 0 ? "筛选到期" : "今日到期"}
            value={dueCount}
          />
          <ReviewMetric icon={LayersIcon} label="学习中" value={learningCount} />
          <ReviewMetric icon={CheckCircle2Icon} label="已掌握" value={masteredCount} />
          <span className="text-xs text-muted-foreground">
            每日目标 {defaultReviewTarget} 张
          </span>
        </section>

        {cards.length === 0 ? (
          <Empty className="min-h-[420px] bg-card shadow-sm">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PartyPopperIcon />
              </EmptyMedia>
              <EmptyTitle>今天没有需要复习的卡片</EmptyTitle>
              <EmptyDescription>
                到期队列已经清空，可以继续观看视频或从生词本查看进度。
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/workspace/library" className={buttonVariants()}>
                  <PlayIcon data-icon="inline-start" aria-hidden="true" />
                  继续观看
                </Link>
                <Link
                  href="/workspace/vocabulary"
                  className={buttonVariants({ variant: "outline" })}
                >
                  <BookOpenIcon data-icon="inline-start" aria-hidden="true" />
                  打开生词本
                </Link>
              </div>
            </EmptyContent>
          </Empty>
        ) : (
          <section aria-labelledby="review-mode-title" className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-[11px] font-medium text-muted-foreground">
                  MODE
                </p>
                <h2 id="review-mode-title" className="mt-1 text-lg font-semibold">
                  选择复习模式
                </h2>
              </div>
              <ReviewTagFilter
                availableTags={availableTags}
                cards={cards}
                idPrefix="review-mode-tags"
                selectedTagIds={selectedTagIds}
                onSelectedTagIdsChange={onSelectedTagIdsChange}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                disabled={dueCount === 0}
                className="group flex min-h-44 flex-col items-start rounded-md bg-info/15 p-5 text-left text-foreground shadow-sm ring-1 ring-info/35 transition-transform hover:-translate-y-0.5 hover:bg-info/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                onClick={onStartRandom}
              >
                <span className="grid size-10 place-items-center rounded-md bg-info/25 text-info-foreground">
                  <ShuffleIcon className="size-5" aria-hidden="true" />
                </span>
                <span className="mt-5 text-lg font-semibold">随机复习</span>
                <span className="mt-1 text-sm text-muted-foreground">
                  {dueCount === 0
                    ? "当前标签没有到期卡片"
                    : `随机抽取 · ${randomCount} 张 · 约 ${estimateReviewMinutes(randomCount)} 分钟`}
                </span>
                <ArrowRightIcon
                  className="mt-auto size-5 self-end text-info-foreground transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                className="group flex min-h-44 flex-col items-start rounded-md bg-card p-5 text-left shadow-sm ring-1 ring-border transition-transform hover:-translate-y-0.5 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={onOpenPlan}
              >
                <span className="grid size-10 place-items-center rounded-md bg-muted">
                  <ListChecksIcon className="size-5" aria-hidden="true" />
                </span>
                <span className="mt-5 text-lg font-semibold">计划复习</span>
                <span className="mt-1 text-sm text-muted-foreground">
                  设置标签、范围、数量和卡片顺序
                </span>
                <ArrowRightIcon
                  className="mt-auto size-5 self-end text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground"
                  aria-hidden="true"
                />
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function ReviewPlanBuilder({
  availableTags,
  cards,
  plan,
  onPlanChange,
  onBack,
  onStart,
}: {
  availableTags: LearningTag[]
  cards: VocabularyWord[]
  plan: ReviewPlan
  onPlanChange: (plan: ReviewPlan) => void
  onBack: () => void
  onStart: () => void
}) {
  const masteryCards = getEligibleReviewCards(cards, plan.focus)
  const tagFilteredCards = getEligibleReviewCards(cards, "all", plan.tagIds)
  const eligibleCards = getEligibleReviewCards(cards, plan.focus, plan.tagIds)
  const availableCount = eligibleCards.length
  const targetCount = clampReviewTarget(plan.targetCount, availableCount)
  const counts = {
    all: tagFilteredCards.length,
    new: tagFilteredCards.filter((card) => card.mastery === "new").length,
    learning: tagFilteredCards.filter((card) => card.mastery === "learning").length,
    mastered: tagFilteredCards.filter((card) => card.mastery === "mastered").length,
  }

  function changeTarget(delta: number) {
    onPlanChange({
      ...plan,
      targetCount: clampReviewTarget(targetCount + delta, availableCount),
    })
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col p-4 md:p-8 lg:p-10">
        <header className="flex items-start gap-3">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label="返回模式选择"
                  onClick={onBack}
                />
              }
            >
              <ArrowLeftIcon aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>返回模式选择</TooltipContent>
          </Tooltip>
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-medium text-muted-foreground">
              REVIEW PLAN
            </p>
            <h1 className="mt-1 text-2xl font-semibold">设置本轮复习计划</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              当前共有 {cards.length} 张到期卡片。
            </p>
          </div>
        </header>

        <div className="mt-8 flex flex-col divide-y border-y">
          {availableTags.length > 0 ? (
            <PlanField
              label="复习标签"
              description="不选表示全部；多选时匹配任一标签。"
            >
              <ReviewTagFilter
                availableTags={availableTags}
                cards={masteryCards}
                idPrefix="review-plan-tags"
                selectedTagIds={plan.tagIds}
                onSelectedTagIdsChange={(tagIds) => onPlanChange({ ...plan, tagIds })}
              />
            </PlanField>
          ) : null}

          <PlanField label="复习范围" description="按当前掌握度筛选到期卡片。">
            <ToggleGroup
              value={[plan.focus]}
              onValueChange={(value) => {
                const nextFocus = value[0] as ReviewFocus | undefined
                if (nextFocus) {
                  onPlanChange({ ...plan, focus: nextFocus })
                }
              }}
              variant="outline"
              spacing={0}
              className="flex-wrap justify-end"
              aria-label="选择复习范围"
            >
              {focusOptions.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  disabled={counts[option.value] === 0}
                >
                  {option.label}
                  <span className="font-mono text-[10px] opacity-65">
                    {counts[option.value]}
                  </span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </PlanField>

          <PlanField
            label="本轮数量"
            description={`预计 ${estimateReviewMinutes(targetCount)} 分钟完成。`}
          >
            <div className="flex items-center gap-1 rounded-md bg-muted p-1">
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                aria-label="减少一张"
                disabled={targetCount <= 1}
                onClick={() => changeTarget(-1)}
              >
                <MinusIcon aria-hidden="true" />
              </Button>
              <span className="min-w-20 text-center font-mono text-sm">
                {targetCount} / {availableCount}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                aria-label="增加一张"
                disabled={targetCount >= availableCount}
                onClick={() => changeTarget(1)}
              >
                <PlusIcon aria-hidden="true" />
              </Button>
            </div>
          </PlanField>

          <PlanField
            label="卡片顺序"
            description="到期优先按时间排列，随机混合每轮保持稳定。"
          >
            <ToggleGroup
              value={[plan.order]}
              onValueChange={(value) => {
                const nextOrder = value[0] as ReviewOrder | undefined
                if (nextOrder) {
                  onPlanChange({ ...plan, order: nextOrder })
                }
              }}
              variant="outline"
              spacing={0}
              aria-label="选择卡片顺序"
            >
              <ToggleGroupItem value="due-first">
                <CalendarClockIcon aria-hidden="true" />
                到期优先
              </ToggleGroupItem>
              <ToggleGroupItem value="random">
                <ShuffleIcon aria-hidden="true" />
                随机混合
              </ToggleGroupItem>
            </ToggleGroup>
          </PlanField>
        </div>

        <footer className="mt-auto flex flex-col gap-3 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            已选择{" "}
            <span className="font-mono font-medium text-foreground">{targetCount}</span>{" "}
            张卡片
          </p>
          <div className="flex gap-2">
            <Button variant="outline" type="button" onClick={onBack}>
              取消
            </Button>
            <Button type="button" disabled={availableCount === 0} onClick={onStart}>
              <PlayIcon data-icon="inline-start" aria-hidden="true" />
              进入复习计划
            </Button>
          </div>
        </footer>
      </div>
    </div>
  )
}

function ActiveReviewSession({
  activeReviewMode,
  choiceOptions,
  correctOptionId,
  currentCard,
  currentExample,
  currentIndex,
  currentPhrase,
  history,
  onFinish,
  onRate,
  onSelectOption,
  onShowAnswer,
  onShortcutOpenChange,
  onShowTranslation,
  pendingReviewCount,
  sessionCards,
  sessionKind,
  selectedOptionId,
  shortcutOpen,
  showAnswer,
  showTranslation,
}: {
  activeReviewMode: ReviewMode
  choiceOptions: ReviewChoiceOption[]
  correctOptionId: string | null
  currentCard: VocabularyWord
  currentExample: DictionaryExample | null
  currentIndex: number
  currentPhrase: DictionaryPhrase | null
  history: ReviewHistoryEntry[]
  onFinish: () => void
  onRate: (rating: ReviewRating) => void
  onSelectOption: (optionId: string) => void
  onShowAnswer: () => void
  onShortcutOpenChange: (open: boolean) => void
  onShowTranslation: () => void
  pendingReviewCount: number
  sessionCards: VocabularyWord[]
  sessionKind: ReviewSessionKind
  selectedOptionId: string | null
  shortcutOpen: boolean
  showAnswer: boolean
  showTranslation: boolean
}) {
  const totalCards = sessionCards.length
  const reviewed = Math.min(currentIndex, totalCards)
  const remainingCards = Math.max(0, totalCards - reviewed)
  const progressValue = totalCards > 0 ? (reviewed / totalCards) * 100 : 100
  const remembered = history.filter((entry) => entry.rating >= 3).length
  const fuzzy = history.filter((entry) => entry.rating === 2).length
  const forgotten = history.filter((entry) => entry.rating === 1).length
  const contextTranslation =
    activeReviewMode === "context"
      ? (currentExample?.translation ?? "")
      : currentCard.translation

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/30">
      <header className="relative z-20 shrink-0 bg-background px-3 py-3 shadow-sm md:px-5">
        <div className="flex items-center gap-3">
          <div className="hidden min-w-32 sm:block">
            <div className="flex items-center gap-2">
              {sessionKind === "random" ? (
                <ShuffleIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              ) : (
                <ListChecksIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <span className="text-sm font-medium">
                {sessionKind === "random" ? "随机复习" : "计划复习"}
              </span>
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {reviewed} / {totalCards}
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>剩余 {remainingCards} 张</span>
              <span className="font-mono">{Math.round(progressValue)}%</span>
            </div>
            <Progress value={progressValue} />
          </div>
          <div className="hidden shrink-0 items-center gap-3 xl:flex">
            <ShortcutHint keys={["Space"]} label="翻面" />
            <ShortcutHint keys={["1", "2", "3", "4"]} label="评分" />
            <ShortcutHint keys={["P"]} label="朗读" />
          </div>
          {pendingReviewCount > 0 ? (
            <span
              className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
              aria-live="polite"
            >
              <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden="true" />
              <span className="hidden sm:inline">同步</span>
              {pendingReviewCount}
            </span>
          ) : null}
          <Popover open={shortcutOpen} onOpenChange={onShortcutOpenChange}>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label="查看快捷键"
                />
              }
            >
              <KeyboardIcon aria-hidden="true" />
            </PopoverTrigger>
            <ShortcutPopoverContent />
          </Popover>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label="结束本轮复习"
                  onClick={onFinish}
                />
              }
            >
              <CircleStopIcon aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>
              结束本轮复习 <kbd className="font-mono">Esc</kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden p-3 md:p-5 lg:p-6">
        <Card
          key={currentCard.id}
          className="mx-auto h-full min-h-0 w-full max-w-5xl border-0 shadow-md [--card-spacing:--spacing(5)] animate-in fade-in-0 duration-200"
        >
          <CardHeader>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {getReviewModeLabel(activeReviewMode, currentCard)}
              </Badge>
              <Badge variant="outline">{masteryLabels[currentCard.mastery]}</Badge>
              <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <ClapperboardIcon className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{currentCard.sourceTitle}</span>
                <span className="shrink-0">
                  · {formatDuration(currentCard.sourceTimestampSeconds)}
                </span>
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              data-slot="review-prompt"
              data-review-mode={activeReviewMode}
              className="grid shrink-0 place-items-center py-2"
            >
              <ReviewPrompt
                card={currentCard}
                example={currentExample}
                mode={activeReviewMode}
                phrase={currentPhrase}
              />
            </div>
            <Separator className="my-4" />
            <div
              data-slot="review-answer"
              className={cn(
                "min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1",
                !showAnswer && "grid place-items-center",
              )}
            >
              {showAnswer ? (
                <div className="flex flex-col gap-4 pb-1">
                  {correctOptionId && choiceOptions.length > 1 ? (
                    <>
                      <ReviewChoiceOptions
                        correctOptionId={correctOptionId}
                        options={choiceOptions}
                        selectedOptionId={selectedOptionId}
                        onSelectOption={onSelectOption}
                      />
                      <Separator />
                    </>
                  ) : null}
                  <ReviewAnswer
                    card={currentCard}
                    example={currentExample}
                    mode={activeReviewMode}
                    phrase={currentPhrase}
                  />
                  {activeReviewMode !== "context" && contextTranslation ? (
                    showTranslation ? (
                      <div className="flex flex-col gap-2 rounded-md bg-accent p-4">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {contextTranslation}
                        </p>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        type="button"
                        className="mx-auto"
                        onClick={onShowTranslation}
                      >
                        显示语境翻译
                      </Button>
                    )
                  ) : null}
                </div>
              ) : correctOptionId && choiceOptions.length > 1 ? (
                <div className="flex w-full flex-col gap-3 py-1">
                  <ReviewChoiceOptions
                    correctOptionId={correctOptionId}
                    options={choiceOptions}
                    selectedOptionId={selectedOptionId}
                    onSelectOption={onSelectOption}
                  />
                  <Button
                    variant="ghost"
                    type="button"
                    className="mx-auto"
                    onClick={onShowAnswer}
                  >
                    显示答案
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  type="button"
                  className="mx-auto"
                  onClick={onShowAnswer}
                >
                  显示答案
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="relative z-20 shrink-0 bg-background p-3 shadow-[0_-4px_18px_rgb(0_0_0/0.06)] md:px-5">
        <div className="mx-auto flex max-w-5xl flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground xl:hidden">
            <span>
              <kbd className="font-mono text-foreground">Space</kbd> 翻面 ·{" "}
              <kbd className="font-mono text-foreground">1–4</kbd> 评分
            </span>
            <span>
              记住 {remembered} · 模糊 {fuzzy} · 忘记 {forgotten}
            </span>
          </div>
          <div className="flex items-stretch gap-2">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
              {ratings.map((rating) => (
                <Button
                  key={rating.value}
                  variant={rating.value === 4 ? "default" : "outline"}
                  type="button"
                  className="h-14 min-w-0 flex-col gap-0 sm:h-16"
                  onClick={() => onRate(rating.value)}
                >
                  <span className="flex items-center gap-1.5">
                    <kbd className="font-mono text-[10px] opacity-60">
                      {rating.value}
                    </kbd>
                    <span className={rating.className}>{rating.label}</span>
                  </span>
                  <span className="font-mono text-[10px] opacity-65 sm:text-xs">
                    {rating.interval}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function ReviewCompletion({
  endedEarly,
  history,
  pendingReviewCount,
  sessionCards,
  sessionKind,
  onReturn,
}: {
  endedEarly: boolean
  history: ReviewHistoryEntry[]
  pendingReviewCount: number
  sessionCards: VocabularyWord[]
  sessionKind: ReviewSessionKind
  onReturn: () => void
}) {
  const remembered = history.filter((entry) => entry.rating >= 3).length
  const fuzzy = history.filter((entry) => entry.rating === 2).length
  const forgotten = history.filter((entry) => entry.rating === 1).length
  const remaining = sessionCards.length - history.length
  const isSyncing = pendingReviewCount > 0

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-4xl items-center p-4 md:p-8">
        <div className="w-full rounded-md bg-card p-6 text-center shadow-sm md:p-10">
          <div className="mx-auto grid size-11 place-items-center rounded-md bg-muted">
            {isSyncing ? (
              <LoaderCircleIcon className="size-5 animate-spin" aria-hidden="true" />
            ) : endedEarly ? (
              <FlagIcon className="size-5" aria-hidden="true" />
            ) : (
              <PartyPopperIcon className="size-5" aria-hidden="true" />
            )}
          </div>
          <Badge variant="secondary" className="mt-5">
            {sessionKind === "random" ? "随机复习" : "计划复习"}
          </Badge>
          <h1 className="mt-3 text-2xl font-semibold">
            {endedEarly ? "本轮复习已结束" : "本轮计划已完成"}
          </h1>
          <p
            className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground"
            aria-live="polite"
          >
            {isSyncing
              ? `本轮已完成，正在同步最后 ${pendingReviewCount} 条评分。`
              : endedEarly
                ? `已完成 ${history.length} 张，剩余 ${remaining} 张仍保留在到期队列中。`
                : "评分已保存，下一次复习时间已按结果更新。"}
          </p>

          <div className="mx-auto mt-8 grid max-w-xl grid-cols-3 divide-x border-y py-4">
            <CompletionMetric label="记住" value={remembered} />
            <CompletionMetric label="模糊" value={fuzzy} />
            <CompletionMetric label="忘记" value={forgotten} />
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Button type="button" disabled={isSyncing} onClick={onReturn}>
              <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
              选择复习模式
            </Button>
            <Link
              href="/workspace/vocabulary"
              aria-disabled={isSyncing}
              tabIndex={isSyncing ? -1 : undefined}
              className={cn(
                buttonVariants({ variant: "outline" }),
                isSyncing && "pointer-events-none opacity-50",
              )}
            >
              <BookOpenIcon data-icon="inline-start" aria-hidden="true" />
              打开生词本
            </Link>
            <Link
              href="/workspace/library"
              aria-disabled={isSyncing}
              tabIndex={isSyncing ? -1 : undefined}
              className={cn(
                buttonVariants({ variant: "outline" }),
                isSyncing && "pointer-events-none opacity-50",
              )}
            >
              <PlayIcon data-icon="inline-start" aria-hidden="true" />
              继续观看
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function ShortcutPopoverContent() {
  return (
    <PopoverContent side="bottom" align="end" sideOffset={8} className="w-80">
      <PopoverHeader>
        <PopoverTitle>复习快捷键</PopoverTitle>
        <PopoverDescription>本轮复习可用</PopoverDescription>
      </PopoverHeader>
      <ul className="divide-y">
        {shortcutItems.map((item) => (
          <li
            key={item.label}
            className="flex min-h-10 items-center justify-between gap-4 py-2"
          >
            <span className="text-sm">{item.label}</span>
            <span className="flex gap-1">
              {item.keys.map((key) => (
                <kbd
                  key={key}
                  className="min-w-7 rounded-md bg-muted px-2 py-1 text-center font-mono text-xs ring-1 ring-border"
                >
                  {key}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </PopoverContent>
  )
}

function PlanField({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-sm font-medium">{label}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="w-full shrink-0 sm:w-auto sm:max-w-[65%]">{children}</div>
    </section>
  )
}

function ReviewMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof LayersIcon
  label: string
  value: number
}) {
  return (
    <span className="flex items-center gap-2 text-sm">
      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </span>
  )
}

function CompletionMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-mono text-xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function ShortcutHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="flex gap-0.5">
        {keys.map((key) => (
          <kbd
            key={key}
            className="min-w-5 rounded bg-muted px-1 py-0.5 text-center font-mono text-[10px] text-foreground"
          >
            {key}
          </kbd>
        ))}
      </span>
      {label}
    </span>
  )
}

function estimateReviewMinutes(cardCount: number): number {
  return cardCount === 0 ? 0 : Math.max(1, Math.ceil(cardCount / 3))
}

function getAvailableReviewTags(cards: VocabularyWord[]): LearningTag[] {
  const tagsById = new Map<string, LearningTag>()
  for (const card of cards) {
    for (const tag of card.tags) {
      tagsById.set(tag.id, tag)
    }
  }
  return Array.from(tagsById.values()).toSorted((left, right) =>
    left.name.localeCompare(right.name, "zh-CN"),
  )
}

function pickReviewMode(
  card: VocabularyWord,
  reviewSeed: number,
  index: number,
): ReviewMode {
  const modes = getAvailableReviewModes(card)
  const hash = hashReviewKey(`${reviewSeed}:${index}:${card.id}:${card.word}`)
  return modes[hash % modes.length] ?? "word"
}

function getAvailableReviewModes(card: VocabularyWord): ReviewMode[] {
  const modes: ReviewMode[] = ["word"]
  if (getVocabularyChineseDefinition(card)) {
    modes.push("definition")
  }
  if (getExampleReviewPhrases(card).length > 0) {
    modes.push("phrase")
  }
  if (getContextReviewExamples(card).length > 0) {
    modes.push("context")
  }
  return modes
}

function getReviewModeLabel(mode: ReviewMode, card: VocabularyWord): string {
  if (mode === "context" && isVocabularyPhrase(card)) {
    return "词组填空"
  }
  return reviewModeLabels[mode]
}

interface ReviewChoiceSet {
  correctOptionId: string
  options: ReviewChoiceOption[]
}

function getReviewChoiceSet({
  card,
  cards,
  mode,
  phrase,
  seed,
}: {
  card: VocabularyWord
  cards: VocabularyWord[]
  mode: ReviewMode
  phrase: DictionaryPhrase | null
  seed: number
}): ReviewChoiceSet | null {
  if (mode === "phrase" && phrase) {
    const correctOption: ReviewChoiceOption = {
      id: `phrase:${card.id}:${phrase.text}`,
      text: phrase.text,
      translation: phrase.translation,
    }
    const options = buildReviewChoiceOptions(
      correctOption,
      cards.flatMap((candidateCard) =>
        candidateCard.commonPhrases.map((candidatePhrase) => ({
          id: `phrase:${candidateCard.id}:${candidatePhrase.text}`,
          text: candidatePhrase.text,
          translation: candidatePhrase.translation,
        })),
      ),
      seed,
    )
    return options.length > 1 ? { correctOptionId: correctOption.id, options } : null
  }

  if (mode !== "context") {
    return null
  }

  const correctOption: ReviewChoiceOption = {
    id: `word:${card.id}`,
    text: card.word,
    translation: getVocabularyChineseDefinition(card),
  }
  const sameKindCards = cards.filter(
    (candidate) => isVocabularyPhrase(candidate) === isVocabularyPhrase(card),
  )
  const candidateCards = sameKindCards.length >= 4 ? sameKindCards : cards
  const options = buildReviewChoiceOptions(
    correctOption,
    candidateCards.map((candidate) => ({
      id: `word:${candidate.id}`,
      text: candidate.word,
      translation: getVocabularyChineseDefinition(candidate),
    })),
    seed,
  )
  return options.length > 1 ? { correctOptionId: correctOption.id, options } : null
}

function hashReviewKey(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function ReviewPrompt({
  card,
  example,
  mode,
  phrase,
}: {
  card: VocabularyWord
  example: DictionaryExample | null
  mode: ReviewMode
  phrase: DictionaryPhrase | null
}) {
  const chineseDefinition = getVocabularyChineseDefinition(card)
  if (mode === "phrase" && phrase) {
    const clozePrompt = createReviewClozePrompt(phrase.example, phrase.text)
    return (
      <div className="text-center">
        <CardTitle className="text-2xl leading-tight md:text-3xl">
          {clozePrompt === "_____" ? phrase.example : clozePrompt}
        </CardTitle>
      </div>
    )
  }

  if (mode === "context" && example) {
    return (
      <div className="text-center">
        <CardTitle className="text-2xl leading-tight md:text-3xl">
          {createReviewClozePrompt(example.text, card.word)}
        </CardTitle>
      </div>
    )
  }

  if (mode === "definition") {
    return (
      <div className="text-center">
        <CardTitle className="text-2xl leading-tight md:text-3xl">
          {chineseDefinition || "暂无中文释义"}
        </CardTitle>
      </div>
    )
  }

  return (
    <div className="text-center">
      <CardTitle className="text-4xl md:text-5xl">
        <ReviewTerm card={card} text={card.word} />
      </CardTitle>
      <PronunciationLine card={card} />
    </div>
  )
}

const reviewChoiceLabels = ["A", "B", "C", "D"] as const

function ReviewChoiceOptions({
  correctOptionId,
  onSelectOption,
  options,
  selectedOptionId,
}: {
  correctOptionId: string
  onSelectOption: (optionId: string) => void
  options: ReviewChoiceOption[]
  selectedOptionId: string | null
}) {
  const answered = selectedOptionId !== null
  const selectedCorrectly = selectedOptionId === correctOptionId

  return (
    <section aria-label="选择答案" className="w-full">
      <p className="sr-only" aria-live="polite">
        {answered
          ? selectedCorrectly
            ? "选择正确"
            : `选择错误，正确答案是 ${
                options.find((option) => option.id === correctOptionId)?.text ?? ""
              }`
          : ""}
      </p>
      <fieldset>
        <legend className="sr-only">选择对应词汇</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option, index) => {
            const isCorrect = option.id === correctOptionId
            const isSelected = option.id === selectedOptionId
            return (
              <label
                key={option.id}
                className={cn(
                  "min-h-14 w-full rounded-md border bg-background px-3 py-2.5 text-left whitespace-normal outline-none transition-colors has-focus-visible:border-ring has-focus-visible:ring-2 has-focus-visible:ring-ring/35",
                  !answered && "cursor-pointer hover:bg-muted/60",
                  answered && "cursor-default",
                  answered && isCorrect && "border-success bg-success/10",
                  answered && !isCorrect && "bg-muted/35 text-muted-foreground",
                  answered &&
                    isSelected &&
                    !isCorrect &&
                    "border-destructive/60 bg-destructive/5 text-foreground",
                )}
              >
                <input
                  type="radio"
                  name="review-choice"
                  value={option.id}
                  checked={isSelected}
                  disabled={answered}
                  className="sr-only"
                  onChange={() => onSelectOption(option.id)}
                />
                <span className="flex min-w-0 items-start gap-2.5">
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded border font-mono text-[11px] font-semibold",
                      answered && isCorrect
                        ? "border-success/60 bg-success/15 text-foreground"
                        : answered && isSelected
                          ? "border-destructive/50 bg-destructive/10 text-destructive"
                          : "border-border bg-muted/50 text-muted-foreground",
                    )}
                  >
                    {reviewChoiceLabels[index] ?? index + 1}
                  </span>
                  <span className="min-w-0 flex-1 break-words pt-0.5 text-sm font-medium text-foreground">
                    {option.text}
                  </span>
                  {answered && isCorrect ? (
                    <CheckCircle2Icon
                      className="mt-0.5 size-4 shrink-0 text-success"
                      aria-hidden="true"
                    />
                  ) : null}
                  {answered && isSelected && !isCorrect ? (
                    <CircleXIcon
                      className="mt-0.5 size-4 shrink-0 text-destructive"
                      aria-hidden="true"
                    />
                  ) : null}
                </span>
                {answered ? (
                  <span className="mt-1.5 block pl-8 text-xs leading-relaxed text-muted-foreground">
                    {isCorrect ? "正确答案" : "中文释义"} ·{" "}
                    {option.translation || "暂无中文释义"}
                  </span>
                ) : null}
              </label>
            )
          })}
        </div>
      </fieldset>
    </section>
  )
}

function ReviewAnswer({
  card,
  example,
  mode,
  phrase,
}: {
  card: VocabularyWord
  example: DictionaryExample | null
  mode: ReviewMode
  phrase: DictionaryPhrase | null
}) {
  return (
    <>
      {mode === "phrase" && phrase ? (
        <>
          <ReviewPhraseDetails card={card} phrase={phrase} />
          <Separator />
        </>
      ) : null}
      {mode === "context" && example ? (
        <section
          aria-label="单词例句"
          className="flex flex-col rounded-md bg-muted p-4"
        >
          <p className="text-sm leading-relaxed">
            <ReviewTerm card={card} text={example.text} />
          </p>
          {example.translation ? (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {example.translation}
            </p>
          ) : null}
        </section>
      ) : null}
      {mode === "definition" ? (
        <div className="text-center">
          <p className="text-4xl font-semibold">
            <ReviewTerm card={card} text={card.word} />
          </p>
          <PronunciationLine card={card} />
        </div>
      ) : null}
      <WordAnswerSummary
        card={card}
        excludedExample={mode === "context" ? example?.text : undefined}
      />
      <ReviewPhraseList
        card={card}
        phrases={card.commonPhrases}
        excludedPhrase={mode === "phrase" ? phrase?.text : undefined}
      />
      {mode === "word" && card.sourceSentence ? (
        <section aria-label="视频语境" className="rounded-md bg-muted p-4">
          <p className="text-sm leading-relaxed">
            <ReviewTerm card={card} text={card.sourceSentence} />
          </p>
        </section>
      ) : null}
    </>
  )
}

function WordAnswerSummary({
  card,
  excludedExample,
}: {
  card: VocabularyWord
  excludedExample?: string
}) {
  const definitionLines = getVocabularyDefinitionLines(card)
  const examples = getReviewExamples(card).filter(
    (example) => example.text !== excludedExample,
  )
  return (
    <div className="flex flex-col gap-4">
      <section aria-label="词性与释义" className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">词性与释义</h3>
        {definitionLines.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {definitionLines.slice(0, 4).map((definition) => (
              <li
                key={`${definition.partOfSpeech}-${definition.translation}`}
                className="flex items-start gap-2 text-sm leading-relaxed"
              >
                {definition.partOfSpeech ? (
                  <span className="mt-0.5 shrink-0 font-mono text-xs font-semibold text-foreground">
                    {definition.partOfSpeech}
                  </span>
                ) : null}
                <span className="text-base font-medium">{definition.translation}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-base text-muted-foreground">暂无中文释义</p>
        )}
        {card.definition ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            <ReviewTerm card={card} text={card.definition} />
          </p>
        ) : null}
      </section>
      {examples.length > 0 ? (
        <section aria-label="例句" className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">例句</h3>
          <ul className="flex flex-col gap-2 text-sm">
            {examples.slice(0, 3).map((example) => (
              <li key={example.text} className="leading-relaxed">
                <p>
                  <ReviewTerm card={card} text={example.text} />
                </p>
                {example.translation ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {example.translation}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function ReviewPhraseList({
  card,
  excludedPhrase,
  phrases,
}: {
  card: VocabularyWord
  excludedPhrase?: string
  phrases: DictionaryPhrase[]
}) {
  const visiblePhrases = phrases
    .filter((phrase) => phrase.text !== excludedPhrase)
    .slice(0, 3)
  if (visiblePhrases.length === 0) {
    return null
  }
  return (
    <section aria-label="常用词组" className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">常用词组</h3>
      <ul className="flex flex-col divide-y text-sm">
        {visiblePhrases.map((phrase) => (
          <li key={phrase.text} className="py-2 first:pt-0 last:pb-0">
            <ReviewPhraseContent card={card} phrase={phrase} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function ReviewPhraseDetails({
  card,
  phrase,
}: {
  card: VocabularyWord
  phrase: DictionaryPhrase
}) {
  return (
    <section aria-label="当前词组" className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">词组</h3>
      <ReviewPhraseContent card={card} phrase={phrase} emphasize />
    </section>
  )
}

function ReviewPhraseContent({
  card,
  emphasize = false,
  phrase,
}: {
  card: VocabularyWord
  emphasize?: boolean
  phrase: DictionaryPhrase
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className={cn(emphasize ? "text-lg font-medium" : "font-medium")}>
        <ReviewTerm card={card} text={phrase.text} />
      </p>
      {phrase.translation ? (
        <p className="text-sm leading-relaxed text-foreground/80">
          {phrase.translation}
        </p>
      ) : null}
      {phrase.note ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{phrase.note}</p>
      ) : null}
      {phrase.example ? (
        <div className="mt-1 border-l-2 border-border pl-2.5">
          <p className="text-sm leading-relaxed">
            <ReviewTerm card={card} text={phrase.example} />
          </p>
          {phrase.exampleTranslation ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {phrase.exampleTranslation}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ReviewTerm({ card, text }: { card: VocabularyWord; text: string }) {
  return (
    <VocabularyTermHighlight
      text={text}
      word={card.word}
      inflections={card.inflections.map((inflection) => inflection.value)}
    />
  )
}

function PronunciationLine({ card }: { card: VocabularyWord }) {
  return (
    <EnglishPronunciation
      className="mt-2 justify-center text-sm"
      text={card.word}
      phoneticUk={card.phoneticUk}
      phoneticUs={card.phoneticUs}
    />
  )
}
