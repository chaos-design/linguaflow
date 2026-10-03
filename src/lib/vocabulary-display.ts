import type { DictionaryMeaning, VocabularyWord } from "../types/learning"
import { getVocabularyWordForms } from "./vocabulary-word-forms"

type VocabularyDefinitionSource = Pick<
  VocabularyWord,
  "aiAnalysis" | "definitionTranslation"
> &
  Partial<Pick<VocabularyWord, "definition" | "meanings" | "word">>
type VocabularyPartOfSpeechSource = Pick<
  VocabularyWord,
  "aiAnalysis" | "definition" | "partOfSpeech"
>
type VocabularyDefinitionLineSource = VocabularyDefinitionSource &
  VocabularyPartOfSpeechSource
type VocabularyContextSource = Pick<
  VocabularyWord,
  | "aiAnalysis"
  | "commonPhrases"
  | "examples"
  | "exampleTranslations"
  | "meanings"
  | "sourceSentence"
  | "translation"
  | "word"
>

export interface VocabularyDefinitionLine {
  partOfSpeech: string
  translation: string
}

export interface VocabularyContextItem {
  kind: "phrase" | "example"
  text: string
  translation: string
}

const chineseCharacterPattern = /\p{Script=Han}/u
const maximumVocabularyContextItems = 4
const maximumVocabularyExampleLength = 220
const maximumVocabularyExampleWords = 32
const ignoredPhrasePattern =
  /\b(?:the\s+)?(?:context|sentence|learners?)\b|carefully$|^a clear\b|\bwhether to continue$/iu
const ignoredExamplePattern =
  /\b(?:the\s+)?(?:context|sentence|learners?)\b|^please\b.*\bbefore (?:making|continuing)\b/iu
const partOfSpeechAbbreviations = [
  { pattern: /\bintransitive(?:\s+verb)?\b|\bvi\.?\b|不及物动词/iu, label: "vi." },
  { pattern: /\btransitive(?:\s+verb)?\b|\bvt\.?\b|及物动词/iu, label: "vt." },
  { pattern: /\bphrasal\s+verb\b|短语动词/iu, label: "phr. v." },
  { pattern: /\bnoun\b|\bn\.?\b|名词/iu, label: "n." },
  { pattern: /\bverb\b|\bv\.?\b|动词/iu, label: "v." },
  { pattern: /\badjective\b|\badj\.?\b|\ba\b\.?|\bs\b\.?|形容词/iu, label: "adj." },
  { pattern: /\badverb\b|\badv\.?\b|\br\b\.?|副词/iu, label: "adv." },
  { pattern: /\bpronoun\b|\bpron\.?\b|代词/iu, label: "pron." },
  { pattern: /\bpreposition\b|\bprep\.?\b|介词/iu, label: "prep." },
  { pattern: /\bconjunction\b|\bconj\.?\b|连词/iu, label: "conj." },
  { pattern: /\bdeterminer\b|\bdet\.?\b|限定词/iu, label: "det." },
  { pattern: /\binterjection\b|\binterj\.?\b|感叹词/iu, label: "interj." },
  { pattern: /\bauxiliary\b|\baux\.?\b|助动词/iu, label: "aux." },
] as const

const verifiedMeanings: Record<string, DictionaryMeaning[]> = {
  conceive: [
    {
      partOfSpeech: "v.",
      definition:
        "to form an idea or plan in the mind; to become pregnant or cause conception",
      translation: "构思，设想；怀孕，使受孕",
      example: "",
      exampleTranslation: "",
    },
  ],
  consider: [
    {
      partOfSpeech: "v.",
      definition: "to think carefully about something; to regard in a certain way",
      translation: "考虑，仔细思考；认为，把……看作",
      example: "",
      exampleTranslation: "",
    },
  ],
  continue: [
    {
      partOfSpeech: "v.",
      definition: "to keep happening or doing something without stopping",
      translation: "继续，持续；延续",
      example: "",
      exampleTranslation: "",
    },
  ],
  crowd: [
    {
      partOfSpeech: "n.",
      definition: "a large number of people gathered closely together",
      translation: "人群；一群人",
      example: "",
      exampleTranslation: "",
    },
    {
      partOfSpeech: "v.",
      definition: "to gather closely together or fill a place",
      translation: "聚集；拥挤；挤满",
      example: "",
      exampleTranslation: "",
    },
  ],
  decades: [
    {
      partOfSpeech: "n.",
      definition: "plural of decade; periods of ten years",
      translation: "十年期（decade 的复数）；数十年",
      example: "",
      exampleTranslation: "",
    },
  ],
  dejected: [
    {
      partOfSpeech: "adj.",
      definition: "sad and dispirited; discouraged",
      translation: "沮丧的，灰心的；情绪低落的",
      example: "",
      exampleTranslation: "",
    },
  ],
  dinner: [
    {
      partOfSpeech: "n.",
      definition: "the main meal of the day, usually eaten in the evening",
      translation: "正餐；晚餐",
      example: "",
      exampleTranslation: "",
    },
  ],
  frontier: [
    {
      partOfSpeech: "n.",
      definition:
        "a border or the leading edge of knowledge, technology, or development",
      translation: "边界，边疆；（知识、技术等的）前沿",
      example: "",
      exampleTranslation: "",
    },
  ],
  "self-improving": [
    {
      partOfSpeech: "adj.",
      definition: "becoming better through one's own efforts or processes",
      translation: "自我改进的；能自主提升的",
      example: "",
      exampleTranslation: "",
    },
  ],
}

export function hasChineseText(value: string): boolean {
  return chineseCharacterPattern.test(value)
}

export function getVocabularyChineseDefinition(
  word: VocabularyDefinitionSource,
): string {
  const meanings = getVocabularyMeanings(word)
  const combinedMeanings = Array.from(
    new Set(meanings.map((meaning) => meaning.translation.trim()).filter(Boolean)),
  ).join("；")
  const candidates = [
    combinedMeanings,
    word.definitionTranslation,
    word.aiAnalysis?.explanation.zh,
    ...(word.aiAnalysis?.partsOfSpeech.map((item) => item.zh) ?? []),
  ]

  return (
    candidates
      .find(
        (candidate) =>
          typeof candidate === "string" &&
          candidate.trim() &&
          hasChineseText(candidate),
      )
      ?.trim() ?? ""
  )
}

export function getVocabularyMeanings(
  word: VocabularyDefinitionSource,
): DictionaryMeaning[] {
  const dictionaryMeanings = word.meanings ?? []
  const aiMeanings =
    word.aiAnalysis?.meanings.flatMap((item) => {
      if (!item.en && !item.zh) {
        return []
      }
      return [
        {
          partOfSpeech: item.term,
          definition: item.en,
          translation: item.zh,
          example: "",
          exampleTranslation: "",
        },
      ]
    }) ?? []
  const verifiedWordMeanings = getVerifiedVocabularyMeanings(word.word ?? "")
  const source =
    verifiedWordMeanings.length > 0
      ? verifiedWordMeanings
      : aiMeanings.length > 0
        ? aiMeanings
        : dictionaryMeanings
  if (source.length > 0) {
    const seen = new Set<string>()
    return source.filter((meaning) => {
      const key =
        `${meaning.partOfSpeech}|${meaning.definition}|${meaning.translation}`.toLocaleLowerCase(
          "en",
        )
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }
  return word.definition || word.definitionTranslation
    ? [
        {
          partOfSpeech: "",
          definition: word.definition ?? "",
          translation: word.definitionTranslation,
          example: "",
          exampleTranslation: "",
        },
      ]
    : []
}

export function getVerifiedVocabularyMeanings(word: string): DictionaryMeaning[] {
  return verifiedMeanings[word.trim().toLocaleLowerCase("en")] ?? []
}

export function getVocabularyDefinitionLines(
  word: VocabularyDefinitionLineSource,
): VocabularyDefinitionLine[] {
  const definitionsByPartOfSpeech = new Map<string, string[]>()
  const fallbackPartOfSpeech =
    normalizePartOfSpeechAbbreviation(word.partOfSpeech) ||
    normalizePartOfSpeechAbbreviation(getVocabularyPartOfSpeech(word)?.label ?? "")

  for (const meaning of getVocabularyMeanings(word)) {
    const translation = meaning.translation.trim()
    if (!translation) {
      continue
    }
    const partOfSpeech =
      normalizePartOfSpeechAbbreviation(meaning.partOfSpeech) || fallbackPartOfSpeech
    const definitions = definitionsByPartOfSpeech.get(partOfSpeech) ?? []
    for (const definition of translation.split(/[;；]+/u)) {
      const normalized = normalizeChineseDefinition(definition)
      if (normalized && !definitions.includes(normalized)) {
        definitions.push(normalized)
      }
    }
    definitionsByPartOfSpeech.set(partOfSpeech, definitions)
  }

  const lines = Array.from(
    definitionsByPartOfSpeech,
    ([partOfSpeech, definitions]) => ({
      partOfSpeech,
      translation: definitions.join("；"),
    }),
  ).filter((line) => line.translation)
  if (lines.length > 0) {
    return lines
  }

  const translation = normalizeChineseDefinition(getVocabularyChineseDefinition(word))
  if (!translation) {
    return []
  }
  return [{ partOfSpeech: fallbackPartOfSpeech, translation }]
}

export function getVocabularyContextItems(
  word: VocabularyContextSource,
): VocabularyContextItem[] {
  const usefulCommonPhrases = word.commonPhrases.filter((phrase) =>
    isUsefulVocabularyPhrase(phrase.text, word.word),
  )
  const phraseCandidates = [
    ...usefulCommonPhrases.map((phrase) => ({
      text: phrase.text,
      translation: phrase.translation,
    })),
    ...(word.aiAnalysis?.collocations.map((item) => ({
      text: item.term,
      translation: item.zh,
    })) ?? []),
    ...(word.aiAnalysis?.phrases.map((item) => ({
      text: item.term,
      translation: item.zh,
    })) ?? []),
  ].filter((item) => isUsefulVocabularyPhrase(item.text, word.word))
  const rawExampleCandidates = [
    ...usefulCommonPhrases.flatMap((phrase) =>
      phrase.example
        ? [
            {
              text: phrase.example,
              translation: phrase.exampleTranslation,
            },
          ]
        : [],
    ),
    ...word.exampleTranslations,
    ...word.meanings.flatMap((meaning) =>
      meaning.example
        ? [
            {
              text: meaning.example,
              translation: meaning.exampleTranslation,
            },
          ]
        : [],
    ),
    ...(word.aiAnalysis?.examples.map((example) => ({
      text: example.term,
      translation: example.translation,
    })) ?? []),
    ...word.examples.map((text) => ({ text, translation: "" })),
  ].filter((item) =>
    isUsefulVocabularyExample(item.text, word.word, word.sourceSentence),
  )
  const exampleCandidates = rawExampleCandidates.toSorted(
    (left, right) =>
      normalizeVocabularyContextText(left.text).length -
      normalizeVocabularyContextText(right.text).length,
  )
  const result: VocabularyContextItem[] = []
  const seen = new Set<string>()

  addVocabularyContextItem(result, seen, "phrase", phraseCandidates[0])
  addVocabularyContextItem(result, seen, "example", exampleCandidates[0])

  for (const phrase of phraseCandidates.slice(1)) {
    if (result.length >= maximumVocabularyContextItems) {
      break
    }
    addVocabularyContextItem(result, seen, "phrase", phrase)
  }
  for (const example of exampleCandidates.slice(1)) {
    if (result.length >= maximumVocabularyContextItems) {
      break
    }
    addVocabularyContextItem(result, seen, "example", example)
  }

  return result.slice(0, maximumVocabularyContextItems)
}

export function normalizePartOfSpeechAbbreviation(value: string): string {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return ""
  }
  const labels: string[] = []
  const parts = trimmedValue
    .split(/\s*(?:[,，/;；]|\bor\b|\band\b)\s*/iu)
    .map((part) => part.trim())
    .filter(Boolean)

  for (const part of parts.length > 0 ? parts : [trimmedValue]) {
    const normalized = partOfSpeechAbbreviations.find((item) => item.pattern.test(part))
    if (normalized && !labels.includes(normalized.label)) {
      labels.push(normalized.label)
    }
  }

  if (labels.length === 0) {
    const normalized = partOfSpeechAbbreviations.find((item) =>
      item.pattern.test(trimmedValue),
    )
    if (normalized) {
      labels.push(normalized.label)
    }
  }

  return labels.length > 0 ? labels.join(" / ") : trimmedValue
}

export function getVocabularyPartOfSpeech(
  word: VocabularyPartOfSpeechSource,
): { inferred: boolean; label: string } | null {
  const explicit = word.partOfSpeech || word.aiAnalysis?.partsOfSpeech[0]?.term || ""
  if (explicit) {
    return {
      inferred: false,
      label: normalizePartOfSpeechAbbreviation(explicit),
    }
  }

  const definition = word.definition.trim()
  if (/^(to|used to)\s+[a-z]/iu.test(definition)) {
    return { inferred: true, label: "v." }
  }
  if (
    /^(a|an|the|someone|somebody|something|one who|the act of|the state of)\b/iu.test(
      definition,
    )
  ) {
    return { inferred: true, label: "n." }
  }
  if (
    /^(having|showing|feeling|causing|characterized by|of or relating to|relating to)\b/iu.test(
      definition,
    )
  ) {
    return { inferred: true, label: "adj." }
  }
  if (/\b(in|with) (an? )?[^.]*manner\b/iu.test(definition)) {
    return { inferred: true, label: "adv." }
  }
  return null
}

function normalizeChineseDefinition(value: string): string {
  return value
    .trim()
    .replace(
      /^(?:(?:phr\.?\s*v\.?|vi\.?|vt\.?|n\.|v\.|adj\.?|adv\.?|a\.|s\.|r\.|prep\.?|conj\.?|pron\.?|det\.?|interj\.?|aux\.?|noun|verb|adjective|adverb|preposition|conjunction|pronoun|determiner|interjection|auxiliary)\s*)+/iu,
      "",
    )
    .replace(/\s*[,，]\s*/gu, "，")
    .replace(/\s*[;；]\s*/gu, "；")
    .replace(/[。.;；]+$/gu, "")
}

function addVocabularyContextItem(
  result: VocabularyContextItem[],
  seen: Set<string>,
  kind: VocabularyContextItem["kind"],
  item?: { text: string; translation: string },
) {
  const text = normalizeVocabularyContextText(item?.text ?? "")
  const key = text.toLocaleLowerCase("en")
  if (!text || seen.has(key)) {
    return
  }
  seen.add(key)
  result.push({
    kind,
    text,
    translation: normalizeVocabularyContextText(item?.translation ?? ""),
  })
}

export function isUsefulVocabularyPhrase(value: string, word: string): boolean {
  const normalized = normalizeVocabularyContextText(value)
  const wordCount = normalized.split(/\s+/u).length
  return (
    wordCount >= 2 &&
    wordCount <= 6 &&
    includesVocabularyWord(normalized, word) &&
    !ignoredPhrasePattern.test(normalized)
  )
}

function isVideoDerivedVocabularyExample(value: string, sourceSentence: string) {
  const normalizedValue = normalizeVocabularyContextText(value).toLocaleLowerCase("en")
  const normalizedSource =
    normalizeVocabularyContextText(sourceSentence).toLocaleLowerCase("en")
  if (!normalizedValue || !normalizedSource) {
    return false
  }
  if (normalizedValue === normalizedSource) {
    return true
  }

  const valueWords = normalizedValue.match(/[a-z']+/gu) ?? []
  const sourceWords = normalizedSource.match(/[a-z']+/gu) ?? []
  if (valueWords.length < 4 || sourceWords.length < 4) {
    return false
  }
  if (
    normalizedSource.includes(normalizedValue) ||
    normalizedValue.includes(normalizedSource)
  ) {
    return true
  }

  const sourceWordSet = new Set(sourceWords)
  const sharedWordCount = valueWords.filter((word) => sourceWordSet.has(word)).length
  return sharedWordCount / valueWords.length >= 0.7
}

export function isUsefulVocabularyExample(
  value: string,
  word: string,
  sourceSentence = "",
): boolean {
  const normalized = normalizeVocabularyContextText(value)
  const wordCount = normalized.split(/\s+/u).length
  return (
    normalized.length <= maximumVocabularyExampleLength &&
    wordCount <= maximumVocabularyExampleWords &&
    includesVocabularyWord(normalized, word) &&
    !isVideoDerivedVocabularyExample(normalized, sourceSentence) &&
    !ignoredExamplePattern.test(normalized)
  )
}

function includesVocabularyWord(value: string, word: string): boolean {
  const forms = getVocabularyWordForms(word)
  if (forms.size === 0) {
    return false
  }
  const pattern = Array.from(forms)
    .toSorted((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|")
  return new RegExp(`(^|[^a-z])(?:${pattern})([^a-z]|$)`, "iu").test(value)
}

function normalizeVocabularyContextText(value: string): string {
  return value.trim().replace(/\s+/gu, " ")
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
}
