import { describe, expect, it } from "vitest"
import {
  getVocabularyChineseDefinition,
  getVocabularyContextItems,
  getVocabularyDefinitionLines,
  getVocabularyMeanings,
  getVocabularyPartOfSpeech,
  normalizePartOfSpeechAbbreviation,
} from "../../src/lib/vocabulary-display"
import type { AiVocabularyAnalysis } from "../../src/types/learning"

function makeAnalysis(
  explanationZh: string,
  partOfSpeechZh = "",
): AiVocabularyAnalysis {
  return {
    generatedAt: "2026-08-20T00:00:00.000Z",
    cefrLevel: "B1",
    examLabels: [],
    meanings: [],
    inflections: [],
    explanation: { en: "English explanation.", zh: explanationZh },
    partsOfSpeech: [
      {
        term: "adjective",
        en: "Used as an adjective.",
        zh: partOfSpeechZh,
      },
    ],
    tenses: [],
    etymology: { en: "", zh: "" },
    etymologyTree: [],
    wordParts: [],
    wordPartMemory: { en: "", zh: "" },
    derivatives: [],
    examples: [],
    collocations: [],
    phrases: [],
    idioms: [],
    synonyms: [],
    antonyms: [],
    replacements: [],
    newMeanings: [],
  }
}

describe("getVocabularyChineseDefinition", () => {
  it("prefers the stored dictionary translation", () => {
    expect(
      getVocabularyChineseDefinition({
        definitionTranslation: "沮丧的",
        aiAnalysis: makeAnalysis("情绪低落。"),
      }),
    ).toBe("沮丧的")
  })

  it("falls back to the AI Chinese explanation", () => {
    expect(
      getVocabularyChineseDefinition({
        definitionTranslation: "",
        aiAnalysis: makeAnalysis("遭遇挫折后感到悲伤。"),
      }),
    ).toBe("遭遇挫折后感到悲伤。")
  })

  it("falls back to a Chinese part-of-speech explanation", () => {
    expect(
      getVocabularyChineseDefinition({
        definitionTranslation: "",
        aiAnalysis: makeAnalysis("", "描述悲伤和情绪低落的状态。"),
      }),
    ).toBe("描述悲伤和情绪低落的状态。")
  })

  it("does not present English text as a Chinese definition", () => {
    expect(
      getVocabularyChineseDefinition({
        definitionTranslation: "Sad and dispirited.",
        aiAnalysis: null,
      }),
    ).toBe("")
  })

  it("uses concise verified meanings for vocabulary with known source errors", () => {
    const word = {
      word: "conceive",
      definition: "To form an idea.",
      definitionTranslation: "构思。",
      meanings: [],
      aiAnalysis: null,
    }

    expect(getVocabularyChineseDefinition(word)).toBe("构思，设想；怀孕，使受孕")
    expect(getVocabularyMeanings(word)[0]).toMatchObject({
      partOfSpeech: "v.",
      translation: "构思，设想；怀孕，使受孕",
    })
    expect(
      getVocabularyMeanings({
        ...word,
        word: "continue",
        definition: "an option to resume a video game",
        definitionTranslation: "游戏续关选项",
      })[0],
    ).toMatchObject({
      partOfSpeech: "v.",
      translation: "继续，持续；延续",
    })
    expect(
      getVocabularyMeanings({
        ...word,
        word: "dinner",
        definition: "a midday meal",
        definitionTranslation: "午餐",
      })[0],
    ).toMatchObject({
      partOfSpeech: "n.",
      translation: "正餐；晚餐",
    })
    expect(
      getVocabularyMeanings({
        ...word,
        word: "decades",
        definition: "A 2017 double concept album.",
        definitionTranslation: "2017 年双概念专辑",
      })[0],
    ).toMatchObject({
      partOfSpeech: "n.",
      translation: "十年期（decade 的复数）；数十年",
    })
    expect(
      getVocabularyMeanings({
        ...word,
        word: "self-improving",
        definition: "Present participle and gerund of self-improve.",
        definitionTranslation: "呈现自我完善的分词和 gerund",
      })[0],
    ).toMatchObject({
      partOfSpeech: "adj.",
      translation: "自我改进的；能自主提升的",
    })
  })
})

describe("getVocabularyPartOfSpeech", () => {
  it("normalizes stored part-of-speech labels", () => {
    expect(
      getVocabularyPartOfSpeech({
        partOfSpeech: "verb",
        definition: "To form an idea.",
        aiAnalysis: null,
      }),
    ).toEqual({ inferred: false, label: "v." })
  })

  it("conservatively infers common definition patterns for legacy rows", () => {
    expect(
      getVocabularyPartOfSpeech({
        partOfSpeech: "",
        definition: "To develop an idea in the mind.",
        aiAnalysis: null,
      }),
    ).toEqual({ inferred: true, label: "v." })
    expect(
      getVocabularyPartOfSpeech({
        partOfSpeech: "",
        definition: "A midday meal.",
        aiAnalysis: null,
      }),
    ).toEqual({ inferred: true, label: "n." })
  })

  it("does not invent a label for an ambiguous definition", () => {
    expect(
      getVocabularyPartOfSpeech({
        partOfSpeech: "",
        definition: "Across and beyond.",
        aiAnalysis: null,
      }),
    ).toBeNull()
  })
})

describe("getVocabularyDefinitionLines", () => {
  it("groups Chinese meanings by abbreviated part of speech", () => {
    const word = {
      word: "address",
      partOfSpeech: "verb",
      definition: "To speak to someone.",
      definitionTranslation: "",
      meanings: [
        {
          partOfSpeech: "verb",
          definition: "To speak to someone.",
          translation: "向某人讲话，致辞",
          example: "",
          exampleTranslation: "",
        },
        {
          partOfSpeech: "v.",
          definition: "To deal with a problem.",
          translation: "处理；解决",
          example: "",
          exampleTranslation: "",
        },
        {
          partOfSpeech: "noun",
          definition: "A location.",
          translation: "地址",
          example: "",
          exampleTranslation: "",
        },
      ],
      aiAnalysis: null,
    }

    expect(getVocabularyDefinitionLines(word)).toEqual([
      { partOfSpeech: "v.", translation: "向某人讲话，致辞；处理；解决" },
      { partOfSpeech: "n.", translation: "地址" },
    ])
  })

  it("normalizes common verb and adjective labels", () => {
    expect(normalizePartOfSpeechAbbreviation("transitive verb")).toBe("vt.")
    expect(normalizePartOfSpeechAbbreviation("intransitive verb")).toBe("vi.")
    expect(normalizePartOfSpeechAbbreviation("adjective · 形容词")).toBe("adj.")
    expect(normalizePartOfSpeechAbbreviation("adverb")).toBe("adv.")
    expect(normalizePartOfSpeechAbbreviation("noun")).toBe("n.")
    expect(normalizePartOfSpeechAbbreviation("conjunction")).toBe("conj.")
    expect(normalizePartOfSpeechAbbreviation("preposition")).toBe("prep.")
    expect(normalizePartOfSpeechAbbreviation("noun, adjective")).toBe("n. / adj.")
    expect(normalizePartOfSpeechAbbreviation("a.")).toBe("adj.")
    expect(normalizePartOfSpeechAbbreviation("r.")).toBe("adv.")
  })

  it("uses the word-level part of speech for legacy meanings", () => {
    expect(
      getVocabularyDefinitionLines({
        word: "saddened",
        partOfSpeech: "adjective",
        definition: "Sad and dispirited.",
        definitionTranslation: "",
        meanings: [
          {
            partOfSpeech: "",
            definition: "Sad and dispirited.",
            translation: "让人伤心或沮丧",
            example: "",
            exampleTranslation: "",
          },
        ],
        aiAnalysis: null,
      }),
    ).toEqual([{ partOfSpeech: "adj.", translation: "让人伤心或沮丧" }])
  })

  it("removes duplicated part-of-speech prefixes from translated definitions", () => {
    expect(
      getVocabularyDefinitionLines({
        word: "waterfront",
        partOfSpeech: "noun",
        definition: "A land area next to water.",
        definitionTranslation: "",
        meanings: [
          {
            partOfSpeech: "n.",
            definition: "A land area next to water.",
            translation: "n. 水边，滨水区，滩，海滨，江边",
            example: "",
            exampleTranslation: "",
          },
        ],
        aiAnalysis: null,
      }),
    ).toEqual([{ partOfSpeech: "n.", translation: "水边，滨水区，滩，海滨，江边" }])
  })
})

describe("getVocabularyContextItems", () => {
  const contextWord = {
    word: "consider",
    commonPhrases: [
      {
        text: "consider the options",
        translation: "考虑各种选择",
        note: "",
        example: "We should consider every option.",
        exampleTranslation: "我们应该考虑每一种选择。",
      },
    ],
    examples: ["Please consider the proposal."],
    exampleTranslations: [
      {
        text: "Please consider the proposal.",
        translation: "请考虑这项提议。",
      },
    ],
    meanings: [],
    aiAnalysis: null,
    sourceSentence:
      "In this very long video discussion, the founders carefully consider every possible option before making a final decision.",
    translation: "在这段很长的视频讨论中，创始人仔细考虑了所有可能的选择。",
  }

  it("prefers a concise phrase and non-video example", () => {
    const result = getVocabularyContextItems(contextWord)

    expect(result).toEqual([
      {
        kind: "phrase",
        text: "consider the options",
        translation: "考虑各种选择",
      },
      {
        kind: "example",
        text: "Please consider the proposal.",
        translation: "请考虑这项提议。",
      },
      {
        kind: "example",
        text: "We should consider every option.",
        translation: "我们应该考虑每一种选择。",
      },
    ])
  })

  it("never falls back to the original video sentence", () => {
    const sourceSentence =
      "Before making the final decision, the entire product team should carefully consider every available option and review the likely impact."
    const result = getVocabularyContextItems({
      ...contextWord,
      commonPhrases: [
        {
          ...contextWord.commonPhrases[0],
          text: "consider in context",
          example: "Please consider in context before continuing.",
          exampleTranslation: "继续之前请在上下文中考虑。",
        },
        {
          ...contextWord.commonPhrases[0],
          text: "a clear consider",
          example: "",
          exampleTranslation: "",
        },
        {
          ...contextWord.commonPhrases[0],
          text: "consider whether to continue",
          example: "",
          exampleTranslation: "",
        },
      ],
      examples: [sourceSentence],
      exampleTranslations: [
        { text: sourceSentence, translation: "完整视频原句。" },
        {
          text: "Please consider the context before making a decision.",
          translation: "做决定前请考虑上下文。",
        },
      ],
      sourceSentence,
    })

    expect(result).toEqual([])
  })

  it("keeps the complete queried example and translation", () => {
    const text = `Please consider ${"every available option ".repeat(5)}`.trim()
    const translation = "请仔细考虑所有可能的选项和它们带来的长期影响。".repeat(3)
    const result = getVocabularyContextItems({
      ...contextWord,
      commonPhrases: [],
      examples: [],
      sourceSentence: "",
      translation: "",
      exampleTranslations: [
        {
          text,
          translation,
        },
      ],
    })

    expect(result[0]).toEqual({
      kind: "example",
      text,
      translation,
    })
  })

  it("excludes long reference quotations from common scenarios", () => {
    const result = getVocabularyContextItems({
      ...contextWord,
      commonPhrases: [],
      examples: [],
      sourceSentence: "",
      translation: "",
      exampleTranslations: [
        {
          text: `For decades ${"the quoted article continues with unrelated historical detail ".repeat(8)}`,
          translation: "一段很长的引文。",
        },
      ],
    })

    expect(result).toEqual([])
  })

  it("matches common inflections but excludes examples for another word", () => {
    const result = getVocabularyContextItems({
      ...contextWord,
      word: "study",
      commonPhrases: [],
      examples: [],
      sourceSentence: "",
      translation: "",
      exampleTranslations: [
        {
          text: "She studies English every morning.",
          translation: "她每天早晨学习英语。",
        },
        {
          text: "They read English every morning.",
          translation: "他们每天早晨阅读英语。",
        },
      ],
    })

    expect(result).toEqual([
      {
        kind: "example",
        text: "She studies English every morning.",
        translation: "她每天早晨学习英语。",
      },
    ])
  })

  it("accepts base-form phrases and examples for a plural headword", () => {
    const result = getVocabularyContextItems({
      ...contextWord,
      word: "reinforcements",
      commonPhrases: [
        {
          text: "positive reinforcement",
          translation: "正向强化",
          note: "",
          example: "",
          exampleTranslation: "",
        },
      ],
      examples: [],
      exampleTranslations: [
        {
          text: "Positive reinforcement encourages repeated behavior.",
          translation: "正向强化会鼓励行为重复出现。",
        },
      ],
      sourceSentence: "",
      translation: "",
    })

    expect(result).toEqual([
      {
        kind: "phrase",
        text: "positive reinforcement",
        translation: "正向强化",
      },
      {
        kind: "example",
        text: "Positive reinforcement encourages repeated behavior.",
        translation: "正向强化会鼓励行为重复出现。",
      },
    ])
  })

  it("keeps multiple phrase and example items for the vocabulary list", () => {
    const result = getVocabularyContextItems({
      ...contextWord,
      commonPhrases: [
        {
          text: "consider the options",
          translation: "考虑各种选择",
          note: "",
          example: "We should consider every option.",
          exampleTranslation: "我们应该考虑每一种选择。",
        },
        {
          text: "consider the impact",
          translation: "考虑影响",
          note: "",
          example: "Consider the impact before you decide.",
          exampleTranslation: "决定前先考虑影响。",
        },
      ],
      examples: [],
      exampleTranslations: [
        {
          text: "Please consider the proposal.",
          translation: "请考虑这项提议。",
        },
      ],
      sourceSentence: "",
      translation: "",
    })

    expect(result).toEqual([
      {
        kind: "phrase",
        text: "consider the options",
        translation: "考虑各种选择",
      },
      {
        kind: "example",
        text: "Please consider the proposal.",
        translation: "请考虑这项提议。",
      },
      {
        kind: "phrase",
        text: "consider the impact",
        translation: "考虑影响",
      },
      {
        kind: "example",
        text: "We should consider every option.",
        translation: "我们应该考虑每一种选择。",
      },
    ])
  })
})
