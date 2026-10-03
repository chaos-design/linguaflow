import { describe, expect, it } from "vitest"
import {
  hasCurrentVocabularyEnrichment,
  prepareVocabularyEnrichment,
  vocabularyEnrichmentVersion,
} from "@/server/learning/vocabulary-enrichment"
import type { DictionaryEntry } from "@/types/learning"

function makeEntry(overrides: Partial<DictionaryEntry> = {}): DictionaryEntry {
  return {
    word: "consider",
    phonetic: "/kənˈsɪdə/",
    phoneticUk: "/kənˈsɪdə/",
    phoneticUs: "/kənˈsɪdər/",
    partOfSpeech: "verb",
    definition: "To think carefully about something.",
    translation: "考虑",
    examLabels: [],
    inflections: [],
    example: "Please consider the proposal.",
    audioUrl: null,
    audioUrlUk: null,
    audioUrlUs: null,
    meanings: [
      {
        partOfSpeech: "verb",
        definition: "To think carefully about something.",
        translation: "仔细考虑某事",
        example: "Please consider the proposal.",
        exampleTranslation: "请考虑这项提议。",
      },
    ],
    sources: [
      {
        id: "free-dictionary",
        label: "FreeDictionaryAPI.com",
        description: "Dictionary",
        url: "https://freedictionaryapi.com/",
        meanings: [],
      },
    ],
    supplementalExamples: [
      {
        text: "We need to consider every option.",
        translation: "我们需要考虑每一种选择。",
      },
    ],
    commonPhrases: [
      {
        text: "consider the options",
        translation: "考虑各种选择",
        note: "",
        example: "We should consider all the options.",
        exampleTranslation: "我们应该考虑所有选择。",
      },
      {
        text: "consider carefully",
        translation: "仔细考虑",
        note: "",
        example: "",
        exampleTranslation: "",
      },
    ],
    wordAnalysis: {
      etymology: "",
      etymologyTranslation: "",
      examLabels: [],
      inflections: [],
      parts: [],
      relatedWords: [],
    },
    ...overrides,
  }
}

describe("prepareVocabularyEnrichment", () => {
  it("stores queried phrases and examples without the source sentence", () => {
    const sourceSentence = "Please consider the proposal."
    const result = prepareVocabularyEnrichment(makeEntry(), sourceSentence)

    expect(result.commonPhrases.map((phrase) => phrase.text)).toEqual([
      "consider the options",
    ])
    expect(result.exampleTranslations).toEqual([
      {
        text: "We need to consider every option.",
        translation: "我们需要考虑每一种选择。",
      },
      {
        text: "We should consider all the options.",
        translation: "我们应该考虑所有选择。",
      },
    ])
    expect(result.examples).not.toContain(sourceSentence)
    expect(result.wordAnalysis.vocabularyEnrichmentVersion).toBe(
      vocabularyEnrichmentVersion,
    )
    expect(hasCurrentVocabularyEnrichment(result.wordAnalysis)).toBe(true)
  })

  it("applies verified meaning corrections before persistence", () => {
    const result = prepareVocabularyEnrichment(
      makeEntry({
        word: "decades",
        definition: "A 2017 double concept album.",
        translation: "2017 年双概念专辑",
        meanings: [],
      }),
    )

    expect(result).toMatchObject({
      definition: "plural of decade; periods of ten years",
      definitionTranslation: "十年期（decade 的复数）；数十年",
      partOfSpeech: "n.",
    })
    expect(result.dictionarySources[0]?.meanings[0]).toMatchObject({
      definition: "plural of decade; periods of ten years",
    })
  })
})
