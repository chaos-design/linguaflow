import type { LearningTag, VocabularyWord } from "../types/learning"

const builtInVocabularySourcePrefix = "内置词库 · "

type VocabularySourceWord = Pick<VocabularyWord, "sourceTitle"> & {
  tags: Pick<LearningTag, "name">[]
}

export function getVocabularySourceValues(word: VocabularySourceWord): string[] {
  if (!word.sourceTitle.startsWith(builtInVocabularySourcePrefix)) {
    return [word.sourceTitle]
  }

  const packLabel = word.sourceTitle.slice(builtInVocabularySourcePrefix.length)
  const sourceValues = new Set([packLabel])
  for (const tag of word.tags) {
    sourceValues.add(tag.name)
  }
  return Array.from(sourceValues)
}
