import {
  getVocabularyChineseDefinition,
  getVocabularyMeanings,
  isUsefulVocabularyExample,
  isUsefulVocabularyPhrase,
} from "../../lib/vocabulary-display"
import type {
  DictionaryEntry,
  DictionaryExample,
  DictionaryPhrase,
  DictionarySource,
  DictionaryWordAnalysis,
} from "../../types/learning"

export const vocabularyEnrichmentVersion = 2

export interface VocabularyEnrichmentData {
  word: string
  phonetic: string
  phoneticUk: string
  phoneticUs: string
  partOfSpeech: string
  definition: string
  definitionTranslation: string
  examples: string[]
  exampleTranslations: DictionaryExample[]
  commonPhrases: DictionaryPhrase[]
  wordAnalysis: DictionaryWordAnalysis & {
    vocabularyEnrichmentVersion: number
  }
  dictionarySources: DictionarySource[]
}

export function prepareVocabularyEnrichment(
  entry: DictionaryEntry,
  sourceSentence = "",
): VocabularyEnrichmentData {
  const meanings = getVocabularyMeanings({
    word: entry.word,
    definition: entry.definition,
    definitionTranslation: entry.translation,
    meanings: entry.meanings,
    aiAnalysis: null,
  })
  const definition = meanings[0]?.definition.trim() || entry.definition.trim()
  const definitionTranslation = getVocabularyChineseDefinition({
    word: entry.word,
    definition,
    definitionTranslation: entry.translation,
    meanings,
    aiAnalysis: null,
  })
  const commonPhrases = entry.commonPhrases
    .filter((phrase) => isUsefulVocabularyPhrase(phrase.text, entry.word))
    .slice(0, 4)
    .map((phrase) => {
      const keepExample = isUsefulVocabularyExample(
        phrase.example,
        entry.word,
        sourceSentence,
      )
      return {
        text: phrase.text.trim().slice(0, 180),
        translation: phrase.translation.trim().slice(0, 300),
        note: phrase.note.trim().slice(0, 300),
        example: keepExample ? phrase.example.trim().slice(0, 500) : "",
        exampleTranslation: keepExample
          ? phrase.exampleTranslation.trim().slice(0, 500)
          : "",
      }
    })
  const exampleCandidates = [
    ...entry.meanings.flatMap((meaning) =>
      meaning.example
        ? [
            {
              text: meaning.example,
              translation: meaning.exampleTranslation,
            },
          ]
        : [],
    ),
    ...entry.supplementalExamples,
    ...commonPhrases.flatMap((phrase) =>
      phrase.example
        ? [
            {
              text: phrase.example,
              translation: phrase.exampleTranslation,
            },
          ]
        : [],
    ),
  ]
  const exampleByText = new Map<string, DictionaryExample>()
  for (const example of exampleCandidates) {
    const text = example.text.trim().slice(0, 500)
    if (!isUsefulVocabularyExample(text, entry.word, sourceSentence)) {
      continue
    }
    const key = text.toLocaleLowerCase("en")
    const current = exampleByText.get(key)
    if (!current || (!current.translation && example.translation)) {
      exampleByText.set(key, {
        text,
        translation: example.translation.trim().slice(0, 500),
      })
    }
  }
  const exampleTranslations = Array.from(exampleByText.values()).slice(0, 3)
  const selectedDefinitions = new Set(
    meanings.map((meaning) => meaning.definition.toLocaleLowerCase("en")),
  )
  const dictionarySources = entry.sources.map((source) => ({
    ...source,
    meanings: source.meanings.filter((meaning) =>
      selectedDefinitions.has(meaning.definition.toLocaleLowerCase("en")),
    ),
  }))
  if (
    dictionarySources.length > 0 &&
    dictionarySources.every((source) => source.meanings.length === 0)
  ) {
    const firstSource = dictionarySources[0]
    if (firstSource) {
      dictionarySources[0] = { ...firstSource, meanings }
    }
  }

  return {
    word: entry.word.trim().toLocaleLowerCase("en").slice(0, 120),
    phonetic: entry.phonetic.trim().slice(0, 200),
    phoneticUk: entry.phoneticUk.trim().slice(0, 200),
    phoneticUs: entry.phoneticUs.trim().slice(0, 200),
    partOfSpeech: (meanings[0]?.partOfSpeech || entry.partOfSpeech).trim().slice(0, 80),
    definition: definition.slice(0, 4000),
    definitionTranslation: definitionTranslation.slice(0, 4000),
    examples: exampleTranslations.map((example) => example.text),
    exampleTranslations,
    commonPhrases,
    wordAnalysis: {
      ...entry.wordAnalysis,
      vocabularyEnrichmentVersion,
    },
    dictionarySources,
  }
}

export function hasCurrentVocabularyEnrichment(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }
  return (
    (value as Record<string, unknown>).vocabularyEnrichmentVersion ===
    vocabularyEnrichmentVersion
  )
}
