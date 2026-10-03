import type {
  DictionaryEntry,
  DictionaryExample,
  DictionaryInflection,
  DictionaryMeaning,
  DictionaryPhrase,
  DictionarySource,
  DictionaryWordAnalysis,
  DictionaryWordPart,
} from "../types/learning"
import { isValidVocabularyTerm, normalizeVocabularyTerm } from "./vocabulary-term"

export const dictionaryCacheStorageKey = "linguaflow:cache:dictionary:v4"

const dictionaryCacheVersion = 4
const dictionaryCacheMaxEntries = 48
const dictionaryCacheTtlMs = 30 * 24 * 60 * 60 * 1000

type DictionaryCacheStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">

interface DictionaryCacheRecord {
  word: string
  cachedAt: number
  lastAccessedAt: number
  entry: DictionaryEntry
}

interface DictionaryCachePayload {
  version: typeof dictionaryCacheVersion
  entries: DictionaryCacheRecord[]
}

interface DictionaryCacheOptions {
  now?: number
  storage?: DictionaryCacheStorage
}

export function readCachedDictionaryEntry(
  word: string,
  options: DictionaryCacheOptions = {},
): DictionaryEntry | null {
  const storage = options.storage ?? getBrowserStorage()
  if (!storage) {
    return null
  }

  const now = options.now ?? Date.now()
  const entries = readCacheEntries(storage)
  if (!entries) {
    removeCache(storage)
    return null
  }

  const freshEntries = entries.filter(
    (item) => now - item.cachedAt <= dictionaryCacheTtlMs,
  )
  const normalizedWord = normalizeDictionaryWord(word)
  const cachedRecord = freshEntries.find((item) => item.word === normalizedWord)

  if (cachedRecord) {
    cachedRecord.lastAccessedAt = now
  }
  if (cachedRecord || freshEntries.length !== entries.length) {
    writeCacheEntries(storage, freshEntries)
  }

  return cachedRecord?.entry ?? null
}

export function writeCachedDictionaryEntry(
  entry: DictionaryEntry,
  options: DictionaryCacheOptions = {},
): void {
  const storage = options.storage ?? getBrowserStorage()
  const word = normalizeDictionaryWord(entry.word)
  if (!storage || !word || !isDictionaryEntry(entry)) {
    return
  }

  const now = options.now ?? Date.now()
  const currentEntries = readCacheEntries(storage) ?? []
  const freshEntries = currentEntries.filter(
    (item) => item.word !== word && now - item.cachedAt <= dictionaryCacheTtlMs,
  )
  const nextEntries = [
    {
      word,
      cachedAt: now,
      lastAccessedAt: now,
      entry,
    },
    ...freshEntries,
  ]
    .toSorted((left, right) => right.lastAccessedAt - left.lastAccessedAt)
    .slice(0, dictionaryCacheMaxEntries)

  writeCacheEntries(storage, nextEntries)
}

function getBrowserStorage(): DictionaryCacheStorage | null {
  if (typeof window === "undefined") {
    return null
  }
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function readCacheEntries(
  storage: DictionaryCacheStorage,
): DictionaryCacheRecord[] | null {
  try {
    const rawValue = storage.getItem(dictionaryCacheStorageKey)
    if (!rawValue) {
      return []
    }
    const value: unknown = JSON.parse(rawValue)
    if (
      !isRecord(value) ||
      value.version !== dictionaryCacheVersion ||
      !Array.isArray(value.entries)
    ) {
      return null
    }
    return value.entries.filter(isDictionaryCacheRecord)
  } catch {
    return null
  }
}

function writeCacheEntries(
  storage: DictionaryCacheStorage,
  entries: DictionaryCacheRecord[],
): void {
  try {
    if (entries.length === 0) {
      storage.removeItem(dictionaryCacheStorageKey)
      return
    }
    const payload: DictionaryCachePayload = {
      version: dictionaryCacheVersion,
      entries,
    }
    storage.setItem(dictionaryCacheStorageKey, JSON.stringify(payload))
  } catch {
    // Storage can be unavailable or full without blocking dictionary lookup.
  }
}

function removeCache(storage: DictionaryCacheStorage): void {
  try {
    storage.removeItem(dictionaryCacheStorageKey)
  } catch {
    // Ignore unavailable browser storage.
  }
}

function normalizeDictionaryWord(word: string): string {
  const normalizedWord = normalizeVocabularyTerm(word)
  return isValidVocabularyTerm(normalizedWord) ? normalizedWord : ""
}

function isDictionaryCacheRecord(value: unknown): value is DictionaryCacheRecord {
  if (!isRecord(value)) {
    return false
  }
  return (
    typeof value.word === "string" &&
    normalizeDictionaryWord(value.word) === value.word &&
    typeof value.cachedAt === "number" &&
    Number.isFinite(value.cachedAt) &&
    typeof value.lastAccessedAt === "number" &&
    Number.isFinite(value.lastAccessedAt) &&
    isDictionaryEntry(value.entry)
  )
}

function isDictionaryEntry(value: unknown): value is DictionaryEntry {
  if (!isRecord(value)) {
    return false
  }
  return (
    isString(value.word) &&
    isString(value.phonetic) &&
    isString(value.phoneticUk) &&
    isString(value.phoneticUs) &&
    isString(value.partOfSpeech) &&
    isString(value.definition) &&
    isString(value.translation) &&
    isStringArray(value.examLabels) &&
    isArrayOf(value.inflections, isDictionaryInflection) &&
    isString(value.example) &&
    isNullableString(value.audioUrl) &&
    isNullableString(value.audioUrlUk) &&
    isNullableString(value.audioUrlUs) &&
    isArrayOf(value.meanings, isDictionaryMeaning) &&
    isArrayOf(value.sources, isDictionarySource) &&
    isArrayOf(value.supplementalExamples, isDictionaryExample) &&
    isArrayOf(value.commonPhrases, isDictionaryPhrase) &&
    isDictionaryWordAnalysis(value.wordAnalysis)
  )
}

function isDictionaryMeaning(value: unknown): value is DictionaryMeaning {
  return (
    isRecord(value) &&
    isString(value.partOfSpeech) &&
    isString(value.definition) &&
    isString(value.translation) &&
    isString(value.example) &&
    isString(value.exampleTranslation)
  )
}

function isDictionarySource(value: unknown): value is DictionarySource {
  return (
    isRecord(value) &&
    (value.id === "free-dictionary" || value.id === "datamuse") &&
    isString(value.label) &&
    isString(value.description) &&
    isString(value.url) &&
    isArrayOf(value.meanings, isDictionaryMeaning)
  )
}

function isDictionaryExample(value: unknown): value is DictionaryExample {
  return isRecord(value) && isString(value.text) && isString(value.translation)
}

function isDictionaryPhrase(value: unknown): value is DictionaryPhrase {
  return (
    isRecord(value) &&
    isString(value.text) &&
    isString(value.translation) &&
    isString(value.note) &&
    isString(value.example) &&
    isString(value.exampleTranslation)
  )
}

function isDictionaryInflection(value: unknown): value is DictionaryInflection {
  return isRecord(value) && isString(value.label) && isString(value.value)
}

function isDictionaryWordAnalysis(value: unknown): value is DictionaryWordAnalysis {
  return (
    isRecord(value) &&
    isString(value.etymology) &&
    isString(value.etymologyTranslation) &&
    isStringArray(value.examLabels) &&
    isArrayOf(value.inflections, isDictionaryInflection) &&
    isArrayOf(value.parts, isDictionaryWordPart) &&
    isStringArray(value.relatedWords)
  )
}

function isDictionaryWordPart(value: unknown): value is DictionaryWordPart {
  return (
    isRecord(value) &&
    (value.kind === "prefix" ||
      value.kind === "root" ||
      value.kind === "suffix" ||
      value.kind === "base") &&
    isString(value.text) &&
    isString(value.meaning) &&
    isString(value.meaningTranslation) &&
    isString(value.source) &&
    isString(value.phrase) &&
    isString(value.phraseTranslation) &&
    isString(value.example) &&
    isString(value.exampleTranslation)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value)
}

function isStringArray(value: unknown): value is string[] {
  return isArrayOf(value, isString)
}

function isArrayOf<T>(
  value: unknown,
  predicate: (item: unknown) => item is T,
): value is T[] {
  return Array.isArray(value) && value.every(predicate)
}
