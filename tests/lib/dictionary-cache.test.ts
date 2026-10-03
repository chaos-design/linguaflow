import { describe, expect, it } from "vitest"
import {
  dictionaryCacheStorageKey,
  readCachedDictionaryEntry,
  writeCachedDictionaryEntry,
} from "@/lib/dictionary-cache"
import type { DictionaryEntry } from "@/types/learning"

const dictionaryEntry: DictionaryEntry = {
  word: "flow",
  phonetic: "/fləʊ/",
  phoneticUk: "/fləʊ/",
  phoneticUs: "/floʊ/",
  partOfSpeech: "noun",
  definition: "A steady continuous movement.",
  translation: "稳定而连续的运动。",
  examLabels: [],
  inflections: [{ label: "第三人称单数", value: "flows" }],
  example: "The flow of a river.",
  audioUrl: null,
  audioUrlUk: null,
  audioUrlUs: null,
  meanings: [
    {
      partOfSpeech: "noun",
      definition: "A steady continuous movement.",
      translation: "稳定而连续的运动。",
      example: "The flow of a river.",
      exampleTranslation: "河水的流动。",
    },
  ],
  sources: [
    {
      id: "free-dictionary",
      label: "FreeDictionaryAPI.com",
      description: "Wiktionary 释义、音标、词形与公开例句",
      url: "https://freedictionaryapi.com/",
      meanings: [],
    },
  ],
  supplementalExamples: [],
  commonPhrases: [],
  wordAnalysis: {
    etymology: "",
    etymologyTranslation: "",
    examLabels: [],
    inflections: [],
    parts: [],
    relatedWords: [],
  },
}

describe("dictionary cache", () => {
  it("normalizes the lookup word and returns a cached entry", () => {
    const { storage } = createStorage()

    writeCachedDictionaryEntry(dictionaryEntry, { now: 1_000, storage })

    expect(readCachedDictionaryEntry(" FLOW ", { now: 2_000, storage })).toEqual(
      dictionaryEntry,
    )
  })

  it("stores and normalizes multi-word phrase lookups", () => {
    const { storage } = createStorage()
    const phraseEntry = { ...dictionaryEntry, word: "look forward to" }

    writeCachedDictionaryEntry(phraseEntry, { now: 1_000, storage })

    expect(
      readCachedDictionaryEntry("  LOOK   FORWARD TO ", {
        now: 2_000,
        storage,
      }),
    ).toEqual(phraseEntry)
  })

  it("removes entries older than thirty days", () => {
    const { values, storage } = createStorage()
    const thirtyOneDays = 31 * 24 * 60 * 60 * 1000

    writeCachedDictionaryEntry(dictionaryEntry, { now: 1_000, storage })

    expect(
      readCachedDictionaryEntry("flow", {
        now: 1_000 + thirtyOneDays,
        storage,
      }),
    ).toBeNull()
    expect(values.has(dictionaryCacheStorageKey)).toBe(false)
  })

  it("discards an incompatible cache payload", () => {
    const { values, storage } = createStorage()
    values.set(dictionaryCacheStorageKey, JSON.stringify({ version: 0, entries: [] }))

    expect(readCachedDictionaryEntry("flow", { storage })).toBeNull()
    expect(values.has(dictionaryCacheStorageKey)).toBe(false)
  })
})

function createStorage() {
  const values = new Map<string, string>()
  const storage = {
    getItem(key: string) {
      return values.get(key) ?? null
    },
    removeItem(key: string) {
      values.delete(key)
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  } satisfies Pick<Storage, "getItem" | "removeItem" | "setItem">

  return { values, storage }
}
