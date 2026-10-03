import b1Pack from "../../data/vocabulary-packs/b1.json"
import b2Ielts6Pack from "../../data/vocabulary-packs/b2-ielts-6.json"
import c1Pack from "../../data/vocabulary-packs/c1.json"
import commonPhrasesPack from "../../data/vocabulary-packs/common-phrases.json"
import type { VocabularyPackId } from "../../shared/vocabulary-packs"
import type { EnglishLevel } from "../../types/learning"

export interface VocabularyPackEntry {
  word: string
  partOfSpeech: string
  phonetic: string
  definition: string
  definitionTranslation: string
  example: string
  exampleTranslation: string
  cefrLevel: EnglishLevel | ""
}

export interface VocabularyPack {
  version: number
  id: VocabularyPackId
  label: string
  tagNames: string[]
  entries: VocabularyPackEntry[]
}

export const vocabularyPackImportBatchSize = 200

export interface VocabularyPackBatch {
  entries: VocabularyPackEntry[]
  nextOffset: number | null
  totalCount: number
}

const vocabularyPacks: Record<VocabularyPackId, VocabularyPack> = {
  b1: b1Pack as VocabularyPack,
  "b2-ielts-6": b2Ielts6Pack as VocabularyPack,
  c1: c1Pack as VocabularyPack,
  "common-phrases": commonPhrasesPack as VocabularyPack,
}

export function getVocabularyPack(packId: VocabularyPackId): VocabularyPack {
  return vocabularyPacks[packId]
}

export function isVocabularyPackOffset(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}

export function getVocabularyPackBatch(
  packId: VocabularyPackId,
  offset: number,
): VocabularyPackBatch {
  const pack = getVocabularyPack(packId)
  const entries = pack.entries.slice(offset, offset + vocabularyPackImportBatchSize)
  const nextOffsetValue = offset + entries.length
  return {
    entries,
    nextOffset:
      entries.length > 0 && nextOffsetValue < pack.entries.length
        ? nextOffsetValue
        : null,
    totalCount: pack.entries.length,
  }
}
