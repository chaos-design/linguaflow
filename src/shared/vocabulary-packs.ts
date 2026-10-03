import manifest from "../data/vocabulary-packs/manifest.json"
import type { VocabularyWord } from "../types/learning"

export const vocabularyPackIds = ["b1", "b2-ielts-6", "c1", "common-phrases"] as const

export type VocabularyPackId = (typeof vocabularyPackIds)[number]

export interface VocabularyPackSummary {
  id: VocabularyPackId
  label: string
  shortLabel: string
  description: string
  tagNames: string[]
  itemCount: number
}

export interface VocabularyPackImportResult {
  packId: VocabularyPackId
  words: VocabularyWord[]
  processedCount: number
  insertedCount: number
  existingCount: number
  nextOffset: number | null
  totalCount: number
}

export function isVocabularyPackId(value: unknown): value is VocabularyPackId {
  return (
    typeof value === "string" && vocabularyPackIds.includes(value as VocabularyPackId)
  )
}

export const vocabularyPackSummaries = manifest as VocabularyPackSummary[]
