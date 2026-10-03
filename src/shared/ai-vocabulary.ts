import type {
  AiEtymologyNode,
  AiVocabularyAnalysis,
  AiVocabularyExample,
  AiVocabularyItem,
  AiVocabularyWordPart,
  BilingualText,
  EnglishLevel,
} from "../types/learning"

const analysisListKeys = [
  "meanings",
  "inflections",
  "partsOfSpeech",
  "tenses",
  "derivatives",
  "collocations",
  "phrases",
  "idioms",
  "synonyms",
  "antonyms",
  "replacements",
  "newMeanings",
] as const

export function parseAiVocabularyAnalysis(
  value: unknown,
  metadata?: { generatedAt: string },
): AiVocabularyAnalysis | null {
  const record = asRecord(value)
  if (!record) {
    return null
  }

  const explanation = toBilingualText(record.explanation)
  const etymology = toBilingualText(record.etymology)
  const wordPartMemory = toBilingualText(record.wordPartMemory)
  const examples = toVocabularyExamples(record.examples)
  const wordParts = toVocabularyWordParts(record.wordParts)
  const examLabels = toStringList(record.examLabels, 12, 40)
  const lists = Object.fromEntries(
    analysisListKeys.map((key) => [key, toVocabularyItems(record[key])]),
  ) as Record<(typeof analysisListKeys)[number], AiVocabularyItem[]>
  const hasContent =
    explanation.en ||
    explanation.zh ||
    etymology.en ||
    etymology.zh ||
    wordPartMemory.en ||
    wordPartMemory.zh ||
    examples.length > 0 ||
    wordParts.length > 0 ||
    examLabels.length > 0 ||
    analysisListKeys.some((key) => lists[key].length > 0)
  if (!hasContent) {
    return null
  }

  return {
    generatedAt:
      metadata?.generatedAt ??
      readString(record, "generatedAt") ??
      new Date(0).toISOString(),
    cefrLevel: toEnglishLevel(record.cefrLevel),
    examLabels,
    meanings: lists.meanings,
    inflections: lists.inflections,
    explanation,
    partsOfSpeech: lists.partsOfSpeech,
    tenses: lists.tenses,
    etymology,
    etymologyTree: toEtymologyNodes(record.etymologyTree),
    wordParts,
    wordPartMemory,
    derivatives: lists.derivatives,
    examples,
    collocations: lists.collocations,
    phrases: lists.phrases,
    idioms: lists.idioms,
    synonyms: lists.synonyms,
    antonyms: lists.antonyms,
    replacements: lists.replacements,
    newMeanings: lists.newMeanings,
  }
}

function toStringList(
  value: unknown,
  maximumItems: number,
  maximumLength: number,
): string[] {
  return Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim().slice(0, maximumLength))
            .filter(Boolean),
        ),
      ).slice(0, maximumItems)
    : []
}

function toEnglishLevel(value: unknown): EnglishLevel | "" {
  if (typeof value !== "string") {
    return ""
  }
  const normalized = value.trim().toLocaleUpperCase("en")
  return /^(A1|A2|B1|B2|C1|C2)$/u.test(normalized) ? (normalized as EnglishLevel) : ""
}

function toBilingualText(value: unknown): BilingualText {
  const record = asRecord(value)
  return {
    en: record ? (readString(record, "en") ?? "") : "",
    zh: record ? (readString(record, "zh") ?? "") : "",
  }
}

function toVocabularyWordParts(value: unknown): AiVocabularyWordPart[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((item) => {
      const record = asRecord(item)
      const term = record ? readString(record, "term") : null
      if (!record || !term) {
        return null
      }
      return {
        term: term.slice(0, 240),
        en: (readString(record, "en") ?? "").slice(0, 800),
        zh: (readString(record, "zh") ?? "").slice(0, 800),
        source: (readString(record, "source") ?? "").slice(0, 300),
        phrase: (readString(record, "phrase") ?? "").slice(0, 240),
        phraseTranslation: (readString(record, "phraseTranslation") ?? "").slice(
          0,
          400,
        ),
        example: (readString(record, "example") ?? "").slice(0, 500),
        exampleTranslation: (readString(record, "exampleTranslation") ?? "").slice(
          0,
          500,
        ),
      }
    })
    .filter((item): item is AiVocabularyWordPart => item !== null)
    .slice(0, 8)
}

function toVocabularyItems(value: unknown): AiVocabularyItem[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((item) => {
      const record = asRecord(item)
      const term = record ? readString(record, "term") : null
      if (!record || !term) {
        return null
      }
      return {
        term: term.slice(0, 240),
        en: (readString(record, "en") ?? "").slice(0, 800),
        zh: (readString(record, "zh") ?? "").slice(0, 800),
      }
    })
    .filter((item): item is AiVocabularyItem => item !== null)
    .slice(0, 12)
}

function toVocabularyExamples(value: unknown): AiVocabularyExample[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((item) => {
      const record = asRecord(item)
      const term = record ? readString(record, "term") : null
      if (!record || !term) {
        return null
      }
      return {
        term: term.slice(0, 240),
        en: (readString(record, "en") ?? "").slice(0, 800),
        zh: (readString(record, "zh") ?? "").slice(0, 800),
        translation: (readString(record, "translation") ?? "").slice(0, 800),
      }
    })
    .filter((item): item is AiVocabularyExample => item !== null)
    .slice(0, 3)
}

function toEtymologyNodes(value: unknown, depth = 0): AiEtymologyNode[] {
  if (!Array.isArray(value) || depth > 3) {
    return []
  }
  return value
    .map((item) => {
      const record = asRecord(item)
      const label = record ? readString(record, "label") : null
      if (!record || !label) {
        return null
      }
      return {
        label: label.slice(0, 160),
        en: (readString(record, "en") ?? "").slice(0, 500),
        zh: (readString(record, "zh") ?? "").slice(0, 500),
        children: toEtymologyNodes(record.children, depth + 1),
      }
    })
    .filter((item): item is AiEtymologyNode => item !== null)
    .slice(0, 8)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readString(value: Record<string, unknown>, key: string): string | null {
  const result = value[key]
  return typeof result === "string" && result.trim() ? result.trim() : null
}
