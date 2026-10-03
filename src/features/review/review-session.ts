import type {
  DictionaryExample,
  DictionaryPhrase,
  VocabularyMastery,
  VocabularyReviewProgress,
  VocabularyWord,
} from "../../types/learning"

export type ReviewFocus = "all" | VocabularyMastery
export type ReviewOrder = "due-first" | "random"

export interface ReviewPlan {
  focus: ReviewFocus
  order: ReviewOrder
  tagIds: readonly string[]
  targetCount: number
}

export interface ReviewChoiceOption {
  id: string
  text: string
  translation: string
}

export function getEligibleReviewCards(
  cards: VocabularyWord[],
  focus: ReviewFocus,
  tagIds: readonly string[] = [],
): VocabularyWord[] {
  const selectedTagIds = new Set(tagIds)
  return cards.filter(
    (card) =>
      (focus === "all" || card.mastery === focus) &&
      (selectedTagIds.size === 0 ||
        card.tags.some((tag) => selectedTagIds.has(tag.id))),
  )
}

export function clampReviewTarget(targetCount: number, availableCount: number): number {
  if (availableCount <= 0) {
    return 0
  }
  return Math.min(availableCount, Math.max(1, Math.round(targetCount)))
}

export function buildReviewQueue(
  cards: VocabularyWord[],
  plan: ReviewPlan,
  seed: number,
): VocabularyWord[] {
  const eligibleCards = getEligibleReviewCards(cards, plan.focus, plan.tagIds)
  const targetCount = clampReviewTarget(plan.targetCount, eligibleCards.length)
  const orderedCards =
    plan.order === "random"
      ? eligibleCards
          .map((card) => ({
            card,
            score: hashReviewKey(`${seed}:${card.id}:${card.word}`),
          }))
          .sort((left, right) => left.score - right.score)
          .map(({ card }) => card)
      : eligibleCards.toSorted(
          (left, right) =>
            new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime(),
        )

  return orderedCards.slice(0, targetCount)
}

export function updateReviewedCard(
  cards: VocabularyWord[],
  vocabularyId: string,
  progress: VocabularyReviewProgress,
): VocabularyWord[] {
  return cards.map((card) =>
    card.id === vocabularyId ? { ...card, ...progress } : card,
  )
}

export function requeueReviewCard(
  cards: VocabularyWord[],
  vocabularyId: string,
): VocabularyWord[] {
  const cardIndex = cards.findIndex((card) => card.id === vocabularyId)
  const card = cards[cardIndex]
  if (cardIndex < 0 || !card) {
    return cards
  }
  return [...cards.slice(0, cardIndex), ...cards.slice(cardIndex + 1), card]
}

export function restoreDueReviewCard(
  cards: VocabularyWord[],
  restoredCard: VocabularyWord,
): VocabularyWord[] {
  if (cards.some((card) => card.id === restoredCard.id)) {
    return cards
  }
  return [...cards, restoredCard].toSorted(
    (left, right) => new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime(),
  )
}

export function getReviewExamples(
  card: Pick<VocabularyWord, "examples" | "exampleTranslations">,
): DictionaryExample[] {
  const examples =
    card.exampleTranslations.length > 0
      ? card.exampleTranslations
      : card.examples.map((text) => ({ text, translation: "" }))
  return examples.filter((example) => example.text.trim())
}

export function getClozeReviewExamples(
  card: Pick<VocabularyWord, "examples" | "exampleTranslations" | "word">,
): DictionaryExample[] {
  const wordPattern = createWordPattern(card.word)
  return getReviewExamples(card).filter((example) => wordPattern.test(example.text))
}

export function isVocabularyPhrase(
  card: Pick<VocabularyWord, "partOfSpeech" | "word">,
): boolean {
  return (
    card.word.trim().split(/\s+/u).length > 1 ||
    /\b(?:phrase|phrasal)\b|词组|短语/iu.test(card.partOfSpeech)
  )
}

export function getContextReviewExamples(
  card: Pick<
    VocabularyWord,
    "examples" | "exampleTranslations" | "partOfSpeech" | "word"
  >,
): DictionaryExample[] {
  return isVocabularyPhrase(card)
    ? getReviewExamples(card)
    : getClozeReviewExamples(card)
}

export function getExampleReviewPhrases(
  card: Pick<VocabularyWord, "commonPhrases">,
): DictionaryPhrase[] {
  return card.commonPhrases.filter((phrase) => phrase.example.trim())
}

export function createClozePrompt(sentence: string, word: string): string {
  if (!sentence.trim()) {
    return "_____"
  }
  const prompt = sentence.replace(createWordPattern(word), "_____")
  return prompt === sentence ? "_____" : prompt
}

export function createReviewClozePrompt(sentence: string, term: string): string {
  const exactPrompt = createClozePrompt(sentence, term)
  if (exactPrompt !== "_____") {
    return exactPrompt
  }

  const phrasePattern = createPhraseVariantPattern(term)
  if (!phrasePattern) {
    return exactPrompt
  }
  const prompt = sentence.replace(phrasePattern, "_____")
  return prompt === sentence ? exactPrompt : prompt
}

export function buildReviewChoiceOptions(
  correctOption: ReviewChoiceOption,
  candidates: readonly ReviewChoiceOption[],
  seed: number,
  maximumCount = 4,
): ReviewChoiceOption[] {
  const normalizedCorrectText = normalizeChoiceText(correctOption.text)
  if (!normalizedCorrectText || maximumCount < 1) {
    return []
  }

  const uniqueCandidates = new Map<string, ReviewChoiceOption>()
  for (const candidate of candidates) {
    const normalizedText = normalizeChoiceText(candidate.text)
    if (
      !normalizedText ||
      normalizedText === normalizedCorrectText ||
      !candidate.translation.trim() ||
      uniqueCandidates.has(normalizedText)
    ) {
      continue
    }
    uniqueCandidates.set(normalizedText, candidate)
  }

  const distractors = Array.from(uniqueCandidates.values())
    .toSorted(
      (left, right) =>
        hashReviewKey(`${seed}:candidate:${left.id}:${left.text}`) -
          hashReviewKey(`${seed}:candidate:${right.id}:${right.text}`) ||
        left.text.localeCompare(right.text, "en"),
    )
    .slice(0, Math.max(0, maximumCount - 1))

  return [correctOption, ...distractors].toSorted(
    (left, right) =>
      hashReviewKey(`${seed}:position:${left.id}:${left.text}`) -
        hashReviewKey(`${seed}:position:${right.id}:${right.text}`) ||
      left.text.localeCompare(right.text, "en"),
  )
}

function hashReviewKey(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function createWordPattern(word: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(word.trim())}\\b`, "iu")
}

function createPhraseVariantPattern(term: string): RegExp | null {
  const words = term.trim().split(/\s+/u)
  if (words.length < 2) {
    return null
  }
  const [, ...trailingWords] = words
  const trailingPattern = trailingWords
    .map((word) => createPhraseTokenPattern(word))
    .join("\\s+")
  return new RegExp(
    `\\b${createPhraseTokenPattern(words[0] ?? "", true)}\\s+${trailingPattern}\\b`,
    "iu",
  )
}

function createPhraseTokenPattern(word: string, allowInflection = false): string {
  if (/^one['’]s$/iu.test(word)) {
    return "(?:one['’]s|my|your|his|her|its|our|their)"
  }
  if (allowInflection) {
    return "[A-Za-z][A-Za-z'-]*"
  }
  return escapeRegExp(word)
}

function normalizeChoiceText(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("en")
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
}
