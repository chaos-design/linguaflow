import { getVerifiedVocabularyMeanings } from "../../lib/vocabulary-display"
import {
  isValidVocabularyTerm,
  normalizeVocabularyTerm,
} from "../../lib/vocabulary-term"
import type {
  DictionaryEntry,
  DictionaryExample,
  DictionaryInflection,
  DictionaryMeaning,
  DictionaryPhrase,
  DictionarySource,
  DictionarySourceId,
  DictionarySourceSummary,
  DictionaryWordAnalysis,
} from "../../types/learning"
import { translateEnglishTexts } from "./translation"

const maximumMeanings = 6
const maximumSupplementalExamples = 3
const maximumCommonPhrases = 4
const maximumRelatedWords = 8
const outdatedDefinitionPattern =
  /\b(?:archaic|dated|dialectal|historical|nonstandard|obsolete|rare)\b/iu
const specializedDefinitionPattern = /\b(?:law|poker|slang|video games?)\b/iu
const secondaryDefinitionPattern =
  /\b(?:alternative form|alternative spelling|misspelling|pronunciation spelling)\b/iu

const dictionarySourceSummaries: Record<DictionarySourceId, DictionarySourceSummary> = {
  "free-dictionary": {
    id: "free-dictionary",
    label: "FreeDictionaryAPI.com",
    description: "Wiktionary 释义、音标、词形与公开例句",
    url: "https://freedictionaryapi.com/",
  },
  datamuse: {
    id: "datamuse",
    label: "Datamuse",
    description: "近义词、相关词与词频线索",
    url: "https://www.datamuse.com/api/",
  },
}

export function convertNarrowToBroadIpa(value: string): string {
  const transcription = value.trim()
  if (!transcription.startsWith("[") || !transcription.endsWith("]")) {
    return transcription
  }

  const broadTranscription = transcription
    .slice(1, -1)
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff]/gu, "")
    .replace(/[ʰʷʲˠˤⁿˡ]/gu, "")
    .normalize("NFC")

  return broadTranscription ? `/${broadTranscription}/` : ""
}

interface DictionaryApiPronunciation {
  text: string
  tags: string[]
}

export async function queryDictionary(value: string): Promise<DictionaryEntry> {
  const word = normalizeVocabularyTerm(value)
  if (!isValidVocabularyTerm(word)) {
    throw new Error("请输入一个有效的英文单词、词组或短语进行查询。")
  }

  const [freeDictionary, queriedDatamuse, etymology] = await Promise.all([
    queryFreeDictionary(word).catch(() => null),
    queryDatamuse(word),
    queryWiktionaryEtymology(word),
  ])
  const baseWord = freeDictionary?.baseWords.find((candidate) => candidate !== word)
  const [baseDictionary, baseDatamuse] = baseWord
    ? await Promise.all([
        queryFreeDictionary(baseWord).catch(() => null),
        queryDatamuse(baseWord),
      ])
    : [null, null]
  const datamuse = mergeDatamuseResults(baseDatamuse, queriedDatamuse)
  const contextExamples = Array.from(
    new Set([...(baseDictionary?.examples ?? []), ...(freeDictionary?.examples ?? [])]),
  )
  const inflections =
    freeDictionary && freeDictionary.inflections.length > 0
      ? freeDictionary.inflections
      : (baseDictionary?.inflections ?? [])
  const verifiedMeanings = getVerifiedVocabularyMeanings(word)
  const meanings =
    verifiedMeanings.length > 0
      ? verifiedMeanings
      : rankDictionaryMeanings(
          mergeMeanings([...(freeDictionary?.meanings ?? []), ...datamuse.meanings]),
        )
          .slice(0, maximumMeanings)
          .map(normalizeDictionaryMeaning)
  if (meanings.length === 0) {
    throw new Error(`没有找到 “${word}” 的有效释义。`)
  }

  const definitions = meanings.map((meaning) => meaning.definition)
  const examples = createSupplementalExamples(contextExamples)
  const phrases = createCommonPhrases(datamuse.phrases, contextExamples)
  const relatedWords = Array.from(
    new Set([
      ...(freeDictionary?.relatedWords ?? []),
      ...(baseDictionary?.relatedWords ?? []),
      ...datamuse.relatedWords,
    ]),
  ).slice(0, maximumRelatedWords)
  const wordAnalysis = createWordAnalysis(etymology, relatedWords, inflections)
  const translatableTexts = [
    ...definitions,
    ...meanings.map((meaning) => meaning.example),
    ...examples.map((example) => example.text),
    ...phrases.map((phrase) => phrase.text),
    ...phrases.map((phrase) => phrase.example),
    wordAnalysis.etymology,
  ]
  const translations = await translateEnglishTexts(translatableTexts, "zh-CN")
  let translationIndex = 0
  const translatedMeanings = meanings.map((meaning) => {
    const translation = translations[translationIndex++] ?? ""
    return {
      ...meaning,
      translation: meaning.translation || translation,
    }
  })
  const translatedExampleMeanings = translatedMeanings.map((meaning) => ({
    ...meaning,
    exampleTranslation: translations[translationIndex++] ?? "",
  }))
  const supplementalExamples = examples.map((example) => ({
    ...example,
    translation: translations[translationIndex++] ?? "",
  }))
  const phraseTranslations = phrases.map(() => translations[translationIndex++] ?? "")
  const phraseExampleTranslations = phrases.map(
    () => translations[translationIndex++] ?? "",
  )
  const commonPhrases = phrases.map((phrase, index) => ({
    ...phrase,
    translation: phraseTranslations[index] ?? "",
    exampleTranslation: phraseExampleTranslations[index] ?? "",
  }))
  const translatedWordAnalysis = {
    ...wordAnalysis,
    etymologyTranslation: translations[translationIndex++] ?? "",
  }
  const primaryMeaning = translatedExampleMeanings[0]
  const translatedMeaningByDefinition = new Map(
    translatedExampleMeanings.map((meaning) => [
      meaning.definition.toLocaleLowerCase("en"),
      meaning,
    ]),
  )
  const sources: DictionarySource[] = []
  if (freeDictionary) {
    sources.push({
      ...dictionarySourceSummaries["free-dictionary"],
      meanings:
        verifiedMeanings.length > 0
          ? translatedExampleMeanings
          : translateSourceMeanings(
              freeDictionary.meanings,
              translatedMeaningByDefinition,
            ),
    })
  }
  if (
    datamuse.meanings.length > 0 ||
    datamuse.relatedWords.length > 0 ||
    datamuse.phrases.length > 0
  ) {
    sources.push({
      ...dictionarySourceSummaries.datamuse,
      meanings:
        verifiedMeanings.length > 0
          ? []
          : translateSourceMeanings(datamuse.meanings, translatedMeaningByDefinition),
    })
  }

  return {
    word: freeDictionary?.word ?? word,
    phonetic: freeDictionary?.phonetic ?? "",
    phoneticUk: freeDictionary?.phoneticUk || freeDictionary?.phonetic || "",
    phoneticUs: freeDictionary?.phoneticUs || freeDictionary?.phonetic || "",
    partOfSpeech: primaryMeaning?.partOfSpeech ?? "",
    definition: primaryMeaning?.definition ?? "",
    translation: primaryMeaning?.translation ?? "",
    examLabels: [],
    inflections,
    example: primaryMeaning?.example ?? "",
    audioUrl: freeDictionary?.audioUrl ?? null,
    audioUrlUk: freeDictionary?.audioUrlUk ?? null,
    audioUrlUs: freeDictionary?.audioUrlUs ?? null,
    meanings: translatedExampleMeanings,
    sources,
    supplementalExamples,
    commonPhrases,
    wordAnalysis: translatedWordAnalysis,
  }
}

function translateSourceMeanings(
  meanings: DictionaryMeaning[],
  translatedMeaningByDefinition: ReadonlyMap<string, DictionaryMeaning>,
): DictionaryMeaning[] {
  return meanings.map((meaning) => {
    const normalizedMeaning = normalizeDictionaryMeaning(meaning)
    const translatedMeaning = translatedMeaningByDefinition.get(
      normalizedMeaning.definition.toLocaleLowerCase("en"),
    )
    return translatedMeaning ?? normalizedMeaning
  })
}

async function queryFreeDictionary(word: string): Promise<{
  word: string
  phonetic: string
  phoneticUk: string
  phoneticUs: string
  audioUrl: string | null
  audioUrlUk: string | null
  audioUrlUs: string | null
  meanings: DictionaryMeaning[]
  examples: string[]
  inflections: DictionaryInflection[]
  relatedWords: string[]
  baseWords: string[]
}> {
  const response = await fetch(
    `https://freedictionaryapi.com/api/v1/entries/en/${encodeURIComponent(word)}`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(8_000),
    },
  )
  if (response.status === 404) {
    throw new Error(`没有找到 “${word}” 的词典释义。`)
  }
  if (!response.ok) {
    throw new Error("词典服务暂时不可用，请稍后重试。")
  }

  const payload = asRecord(await response.json())
  if (!payload) {
    throw new Error("词典服务返回了无法识别的数据。")
  }

  const rawEntries = Array.isArray(payload.entries) ? payload.entries : []
  if (rawEntries.length === 0) {
    throw new Error(`没有找到 “${word}” 的词典释义。`)
  }

  const meanings: DictionaryMeaning[] = []
  const examples: string[] = []
  const inflections: DictionaryInflection[] = []
  const pronunciations: DictionaryApiPronunciation[] = []
  const relatedWords: string[] = []
  const baseWords: string[] = []
  const seenDefinitions = new Set<string>()
  const seenExamples = new Set<string>()
  const seenInflections = new Set<string>()
  const seenPronunciations = new Set<string>()
  const seenRelatedWords = new Set<string>()
  const seenBaseWords = new Set<string>()

  for (const rawEntry of rawEntries) {
    const entry = asRecord(rawEntry)
    if (!entry) {
      continue
    }

    for (const rawPronunciation of Array.isArray(entry.pronunciations)
      ? entry.pronunciations
      : []) {
      const pronunciation = asRecord(rawPronunciation)
      if (!pronunciation || readString(pronunciation, "type") !== "ipa") {
        continue
      }
      const text = readString(pronunciation, "text")
      if (!text) {
        continue
      }
      const tags = readStringArray(pronunciation.tags)
      const key = `${text}\u0000${tags.join("\u0000")}`
      if (!seenPronunciations.has(key)) {
        seenPronunciations.add(key)
        pronunciations.push({ text, tags })
      }
    }

    for (const rawForm of Array.isArray(entry.forms) ? entry.forms : []) {
      const form = asRecord(rawForm)
      const inflectedWord = form ? readString(form, "word") : null
      const label = form ? getInflectionLabel(readStringArray(form.tags)) : null
      if (!inflectedWord || inflectedWord.length > 120 || !label) {
        continue
      }
      const key = `${label}\u0000${inflectedWord}`
      if (!seenInflections.has(key)) {
        seenInflections.add(key)
        inflections.push({ label, value: inflectedWord })
      }
    }

    addRelatedWords(entry.synonyms, relatedWords, seenRelatedWords)
    addRelatedWords(entry.antonyms, relatedWords, seenRelatedWords)
    collectDictionaryApiSenses({
      rawSenses: entry.senses,
      partOfSpeech: readString(entry, "partOfSpeech") ?? "",
      meanings,
      seenDefinitions,
      examples,
      seenExamples,
      relatedWords,
      seenRelatedWords,
      baseWords,
      seenBaseWords,
    })
  }

  if (meanings.length === 0) {
    throw new Error(`没有找到 “${word}” 的有效释义。`)
  }

  return {
    word: readString(payload, "word") ?? word,
    phonetic: selectDictionaryApiPronunciation(pronunciations),
    phoneticUk: selectDictionaryApiPronunciation(pronunciations, "uk"),
    phoneticUs: selectDictionaryApiPronunciation(pronunciations, "us"),
    audioUrl: null,
    audioUrlUk: null,
    audioUrlUs: null,
    meanings: meanings.slice(0, maximumMeanings),
    examples: examples.slice(0, 12),
    inflections: inflections.slice(0, 8),
    relatedWords: relatedWords.slice(0, maximumRelatedWords),
    baseWords,
  }
}

function collectDictionaryApiSenses({
  rawSenses,
  partOfSpeech,
  meanings,
  seenDefinitions,
  examples,
  seenExamples,
  relatedWords,
  seenRelatedWords,
  baseWords,
  seenBaseWords,
}: {
  rawSenses: unknown
  partOfSpeech: string
  meanings: DictionaryMeaning[]
  seenDefinitions: Set<string>
  examples: string[]
  seenExamples: Set<string>
  relatedWords: string[]
  seenRelatedWords: Set<string>
  baseWords: string[]
  seenBaseWords: Set<string>
}) {
  if (!Array.isArray(rawSenses)) {
    return
  }

  for (const rawSense of rawSenses) {
    const sense = asRecord(rawSense)
    if (!sense) {
      continue
    }

    const senseExamples = readStringArray(sense.examples).filter(
      (example) => example.length <= 500,
    )
    for (const example of senseExamples) {
      const normalizedExample = example.toLocaleLowerCase("en")
      if (!seenExamples.has(normalizedExample)) {
        seenExamples.add(normalizedExample)
        examples.push(example)
      }
    }

    const definition = readString(sense, "definition")
    const baseWord = readInflectionBaseWord(definition, readStringArray(sense.tags))
    if (baseWord && !seenBaseWords.has(baseWord)) {
      seenBaseWords.add(baseWord)
      baseWords.push(baseWord)
    }
    const normalizedDefinition = definition?.toLocaleLowerCase("en")
    if (
      definition &&
      normalizedDefinition &&
      !seenDefinitions.has(normalizedDefinition)
    ) {
      seenDefinitions.add(normalizedDefinition)
      meanings.push({
        partOfSpeech,
        definition,
        translation: "",
        example: senseExamples[0] ?? "",
        exampleTranslation: "",
      })
    }

    addRelatedWords(sense.synonyms, relatedWords, seenRelatedWords)
    addRelatedWords(sense.antonyms, relatedWords, seenRelatedWords)
    collectDictionaryApiSenses({
      rawSenses: sense.subsenses,
      partOfSpeech,
      meanings,
      seenDefinitions,
      examples,
      seenExamples,
      relatedWords,
      seenRelatedWords,
      baseWords,
      seenBaseWords,
    })
  }
}

function addRelatedWords(
  value: unknown,
  relatedWords: string[],
  seenRelatedWords: Set<string>,
) {
  for (const relatedWord of readStringArray(value)) {
    const normalizedWord = relatedWord.toLocaleLowerCase("en")
    if (
      /^[a-z][a-z' -]{0,119}$/u.test(normalizedWord) &&
      !seenRelatedWords.has(normalizedWord)
    ) {
      seenRelatedWords.add(normalizedWord)
      relatedWords.push(relatedWord)
    }
  }
}

function getInflectionLabel(tags: string[]): string | null {
  const normalizedTags = new Set(tags.map((tag) => tag.toLocaleLowerCase("en")))
  if (normalizedTags.has("third-person") && normalizedTags.has("singular")) {
    return "第三人称单数"
  }
  if (normalizedTags.has("participle") && normalizedTags.has("present")) {
    return "现在分词"
  }
  if (normalizedTags.has("participle") && normalizedTags.has("past")) {
    return "过去分词"
  }
  if (normalizedTags.has("past")) {
    return "过去式"
  }
  if (normalizedTags.has("plural")) {
    return "复数"
  }
  if (normalizedTags.has("comparative")) {
    return "比较级"
  }
  if (normalizedTags.has("superlative")) {
    return "最高级"
  }
  return null
}

function readInflectionBaseWord(
  definition: string | null,
  tags: string[],
): string | null {
  if (!definition) {
    return null
  }
  const normalizedTags = new Set(tags.map((tag) => tag.toLocaleLowerCase("en")))
  const isInflectedForm =
    normalizedTags.has("form of") &&
    [
      "comparative",
      "gerund",
      "participle",
      "past",
      "plural",
      "present",
      "superlative",
    ].some((tag) => normalizedTags.has(tag))
  if (!isInflectedForm) {
    return null
  }
  return (
    /\bof\s+([a-z][a-z'-]{0,119})(?:[.!]|\s)*$/iu
      .exec(definition)?.[1]
      ?.toLocaleLowerCase("en") ?? null
  )
}

function selectDictionaryApiPronunciation(
  pronunciations: DictionaryApiPronunciation[],
  region?: "uk" | "us",
): string {
  const candidates = region
    ? pronunciations.filter((pronunciation) =>
        pronunciation.tags.some((tag) => isPronunciationRegion(tag, region)),
      )
    : pronunciations
  const broad = candidates.find(
    ({ text }) => text.startsWith("/") && text.endsWith("/"),
  )
  if (broad) {
    return broad.text
  }
  const narrow = candidates.find(
    ({ text }) => text.startsWith("[") && text.endsWith("]"),
  )
  return narrow ? convertNarrowToBroadIpa(narrow.text) : ""
}

function isPronunciationRegion(value: string, region: "uk" | "us"): boolean {
  const tag = value.toLocaleLowerCase("en")
  return region === "uk"
    ? /received pronunciation|british|united kingdom|\buk\b/u.test(tag)
    : /general american|american|united states|\bus\b/u.test(tag)
}

async function queryDatamuse(word: string): Promise<{
  meanings: DictionaryMeaning[]
  relatedWords: string[]
  phrases: string[]
}> {
  try {
    const [definitionResponse, relatedResponse, trailingResponse, leadingResponse] =
      await Promise.all([
        fetch(
          `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d&max=1`,
          {
            headers: { Accept: "application/json" },
            next: { revalidate: 86_400 },
            signal: AbortSignal.timeout(8_000),
          },
        ),
        fetch(
          `https://api.datamuse.com/words?ml=${encodeURIComponent(
            word,
          )}&md=p&max=${maximumRelatedWords}`,
          {
            headers: { Accept: "application/json" },
            next: { revalidate: 86_400 },
            signal: AbortSignal.timeout(8_000),
          },
        ),
        fetch(
          `https://api.datamuse.com/words?sp=${encodeURIComponent(`${word} *`)}&md=p&max=12`,
          {
            headers: { Accept: "application/json" },
            next: { revalidate: 86_400 },
            signal: AbortSignal.timeout(8_000),
          },
        ),
        fetch(
          `https://api.datamuse.com/words?sp=${encodeURIComponent(`* ${word}`)}&md=p&max=12`,
          {
            headers: { Accept: "application/json" },
            next: { revalidate: 86_400 },
            signal: AbortSignal.timeout(8_000),
          },
        ),
      ])

    const [definitionPayload, relatedPayload, trailingPayload, leadingPayload] =
      await Promise.all(
        [definitionResponse, relatedResponse, trailingResponse, leadingResponse].map(
          async (response): Promise<unknown> => (response.ok ? response.json() : []),
        ),
      )
    const firstDefinition = Array.isArray(definitionPayload)
      ? asRecord(definitionPayload[0])
      : null
    const defs = Array.isArray(firstDefinition?.defs) ? firstDefinition.defs : []
    const meanings = defs
      .map((item) => (typeof item === "string" ? parseDatamuseDefinition(item) : null))
      .filter((item): item is DictionaryMeaning => item !== null)
      .slice(0, 4)
    const relatedWords = Array.isArray(relatedPayload)
      ? relatedPayload
          .map(asRecord)
          .map((item) => (item ? readString(item, "word") : null))
          .filter((item): item is string => Boolean(item))
          .filter((item) => /^[a-z][a-z'-]{1,119}$/u.test(item))
          .slice(0, maximumRelatedWords)
      : []
    const phrases = readDatamusePhrases(
      [
        ...(Array.isArray(trailingPayload) ? trailingPayload : []),
        ...(Array.isArray(leadingPayload) ? leadingPayload : []),
      ],
      word,
    )
    return { meanings, relatedWords, phrases }
  } catch {
    return { meanings: [], relatedWords: [], phrases: [] }
  }
}

function mergeDatamuseResults(
  preferred: Awaited<ReturnType<typeof queryDatamuse>> | null,
  fallback: Awaited<ReturnType<typeof queryDatamuse>>,
): Awaited<ReturnType<typeof queryDatamuse>> {
  if (!preferred) {
    return fallback
  }
  return {
    meanings: mergeMeanings([...preferred.meanings, ...fallback.meanings]),
    relatedWords: Array.from(
      new Set([...preferred.relatedWords, ...fallback.relatedWords]),
    ).slice(0, maximumRelatedWords),
    phrases: Array.from(new Set([...preferred.phrases, ...fallback.phrases])).slice(
      0,
      maximumCommonPhrases,
    ),
  }
}

function readDatamusePhrases(value: unknown[], word: string): string[] {
  const wordPattern = new RegExp(`(^| )${escapeRegExp(word)}($| )`, "u")
  return Array.from(
    new Set(
      value.flatMap((item) => {
        const record = asRecord(item)
        const phrase = record?.word
        if (typeof phrase !== "string") {
          return []
        }
        const normalizedPhrase = phrase.trim().toLocaleLowerCase("en")
        const wordCount = normalizedPhrase.split(/\s+/u).length
        return wordCount >= 2 &&
          wordCount <= 5 &&
          /^[a-z][a-z' -]{1,179}$/u.test(normalizedPhrase) &&
          wordPattern.test(normalizedPhrase)
          ? [normalizedPhrase]
          : []
      }),
    ),
  ).slice(0, maximumCommonPhrases)
}

async function queryWiktionaryEtymology(word: string): Promise<string> {
  try {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      origin: "*",
      prop: "extracts",
      exintro: "1",
      explaintext: "1",
      titles: word,
    })
    const response = await fetch(
      `https://en.wiktionary.org/w/api.php?${params.toString()}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 604_800 },
        signal: AbortSignal.timeout(8_000),
      },
    )
    if (!response.ok) {
      return ""
    }
    const payload = asRecord(await response.json())
    const query = asRecord(payload?.query)
    const pages = Array.isArray(query?.pages) ? query.pages : []
    const firstPage = asRecord(pages[0])
    const extract = firstPage ? (readString(firstPage, "extract") ?? "") : ""
    return (
      extract
        .split("\n")
        .map((line) => line.trim())
        .find((line) => /etymology|from|derived|borrowed|origin/iu.test(line))
        ?.slice(0, 360) ?? ""
    )
  } catch {
    return ""
  }
}

function parseDatamuseDefinition(value: string): DictionaryMeaning | null {
  const [partOfSpeech, ...definitionParts] = value.split("\t")
  const definition = definitionParts.join("\t").trim()
  if (!definition) {
    return null
  }
  return {
    partOfSpeech: partOfSpeech?.trim() ?? "",
    definition,
    translation: "",
    example: "",
    exampleTranslation: "",
  }
}

function mergeMeanings(meanings: DictionaryMeaning[]): DictionaryMeaning[] {
  const seenDefinitions = new Set<string>()
  const result: DictionaryMeaning[] = []
  for (const meaning of meanings) {
    const normalizedDefinition = meaning.definition.trim().toLocaleLowerCase("en")
    if (!normalizedDefinition || seenDefinitions.has(normalizedDefinition)) {
      continue
    }
    seenDefinitions.add(normalizedDefinition)
    result.push(meaning)
  }
  return result
}

function rankDictionaryMeanings(meanings: DictionaryMeaning[]): DictionaryMeaning[] {
  return meanings
    .map((meaning, index) => ({
      meaning,
      index,
      rank:
        (secondaryDefinitionPattern.test(meaning.definition) ? 4 : 0) +
        (outdatedDefinitionPattern.test(meaning.definition) ? 4 : 0) +
        (specializedDefinitionPattern.test(meaning.definition) ? 2 : 0) +
        (meaning.example ? 0 : 1),
    }))
    .toSorted((left, right) => left.rank - right.rank || left.index - right.index)
    .map(({ meaning }) => meaning)
}

function normalizeDictionaryMeaning(meaning: DictionaryMeaning): DictionaryMeaning {
  const qualifier = meaning.definition.match(/^(?:\(([^)]*)\)\s*)+/u)?.[0] ?? ""
  const definition = meaning.definition.replace(/^(?:\([^)]*\)\s*)+/u, "").trim()
  const partOfSpeech =
    /\bintransitive\b/iu.test(qualifier) && /\bverb\b/iu.test(meaning.partOfSpeech)
      ? "intransitive verb"
      : /\btransitive\b/iu.test(qualifier) && /\bverb\b/iu.test(meaning.partOfSpeech)
        ? "transitive verb"
        : meaning.partOfSpeech

  return {
    ...meaning,
    partOfSpeech,
    definition: definition || meaning.definition,
  }
}

function createSupplementalExamples(examples: string[]): DictionaryExample[] {
  return Array.from(new Set(examples))
    .filter((example) => example.length <= 500)
    .slice(0, maximumSupplementalExamples)
    .map((text) => ({ text, translation: "" }))
}

function createCommonPhrases(
  phrases: string[],
  examples: string[],
): DictionaryPhrase[] {
  return Array.from(new Set(phrases))
    .slice(0, maximumCommonPhrases)
    .map((text) => {
      const normalizedPhrase = text.toLocaleLowerCase("en")
      const example =
        examples.find((candidate) =>
          candidate.toLocaleLowerCase("en").includes(normalizedPhrase),
        ) ?? ""
      return {
        text,
        translation: "",
        note: "",
        example,
        exampleTranslation: "",
      }
    })
}

function createWordAnalysis(
  etymology: string,
  relatedWords: string[],
  inflections: DictionaryInflection[],
): DictionaryWordAnalysis {
  return {
    etymology,
    etymologyTranslation: "",
    examLabels: [],
    inflections,
    parts: [],
    relatedWords: Array.from(new Set(relatedWords)).slice(0, maximumRelatedWords),
  }
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

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        if (typeof item !== "string") {
          return []
        }
        const text = item.trim()
        return text ? [text] : []
      })
    : []
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
}
