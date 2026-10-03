import { describe, expect, it } from "vitest"
import {
  getVocabularyPack,
  getVocabularyPackBatch,
  isVocabularyPackOffset,
  vocabularyPackImportBatchSize,
} from "@/server/learning/vocabulary-packs"
import { vocabularyPackIds, vocabularyPackSummaries } from "@/shared/vocabulary-packs"

const validVocabularyTermPattern = /^[a-z][a-z'-]*(?: [a-z][a-z'-]*){0,5}$/iu

describe("built-in vocabulary packs", () => {
  it("keeps the generated manifest synchronized with every pack", () => {
    expect(vocabularyPackSummaries.map((pack) => pack.id)).toEqual(vocabularyPackIds)

    for (const summary of vocabularyPackSummaries) {
      const pack = getVocabularyPack(summary.id)
      expect(pack.id).toBe(summary.id)
      expect(pack.label).toBe(summary.label)
      expect(pack.tagNames).toEqual(summary.tagNames)
      expect(pack.entries).toHaveLength(summary.itemCount)
    }
  })

  it("contains every requested pack at the expected source-list size", () => {
    expect(getVocabularyPack("b1").entries).toHaveLength(2394)
    expect(getVocabularyPack("b2-ielts-6").entries).toHaveLength(2771)
    expect(getVocabularyPack("c1").entries).toHaveLength(1026)
    expect(getVocabularyPack("common-phrases").entries).toHaveLength(503)
  })

  it("contains unique valid terms with bilingual definitions", () => {
    for (const packId of vocabularyPackIds) {
      const entries = getVocabularyPack(packId).entries
      expect(new Set(entries.map((entry) => entry.word)).size).toBe(entries.length)
      for (const entry of entries) {
        expect(entry.word).toMatch(validVocabularyTermPattern)
        expect(entry.definition.trim()).not.toBe("")
        expect(entry.definitionTranslation.trim()).not.toBe("")
      }
    }
  })

  it("provides complete bilingual examples for common phrases", () => {
    for (const entry of getVocabularyPack("common-phrases").entries) {
      expect(entry.word.split(" ").length).toBeGreaterThan(1)
      expect(entry.example.trim()).not.toBe("")
      expect(entry.exampleTranslation.trim()).not.toBe("")
    }
  })

  it("labels the CEFR packs consistently", () => {
    expect(
      getVocabularyPack("b1").entries.every((entry) => entry.cefrLevel === "B1"),
    ).toBe(true)
    expect(
      getVocabularyPack("b2-ielts-6").entries.every(
        (entry) => entry.cefrLevel === "B2",
      ),
    ).toBe(true)
    expect(
      getVocabularyPack("c1").entries.every((entry) => entry.cefrLevel === "C1"),
    ).toBe(true)
  })

  it("paginates every pack without skipping or repeating entries", () => {
    for (const packId of vocabularyPackIds) {
      const pack = getVocabularyPack(packId)
      const importedWords: string[] = []
      let offset: number | null = 0

      while (offset !== null) {
        const batch = getVocabularyPackBatch(packId, offset)
        expect(batch.entries.length).toBeLessThanOrEqual(vocabularyPackImportBatchSize)
        expect(batch.totalCount).toBe(pack.entries.length)
        importedWords.push(...batch.entries.map((entry) => entry.word))
        offset = batch.nextOffset
      }

      expect(importedWords).toEqual(pack.entries.map((entry) => entry.word))
    }
  })

  it("accepts only non-negative safe integer offsets", () => {
    expect(isVocabularyPackOffset(0)).toBe(true)
    expect(isVocabularyPackOffset(vocabularyPackImportBatchSize)).toBe(true)
    expect(isVocabularyPackOffset(-1)).toBe(false)
    expect(isVocabularyPackOffset(1.5)).toBe(false)
    expect(isVocabularyPackOffset(Number.MAX_SAFE_INTEGER + 1)).toBe(false)
    expect(isVocabularyPackOffset("0")).toBe(false)
  })
})
